import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, getAuthenticatedUser } from "@/infrastructure/supabase/server";

// ---------------------------------------------------------------------------
// GET /api/reports/export?schoolSlug=...&format=csv
// Ministry reporting endpoint — requires school_admin or super_admin
// ---------------------------------------------------------------------------

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCsvCell).join(",");
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const schoolSlug = searchParams.get("schoolSlug");
  const format = searchParams.get("format") ?? "csv";

  if (format !== "csv") {
    return NextResponse.json({ error: "Only format=csv is supported" }, { status: 400 });
  }

  if (!schoolSlug) {
    return NextResponse.json({ error: "schoolSlug query parameter is required" }, { status: 400 });
  }

  // Auth check
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();

  // Resolve school
  const { data: school } = await supabase
    .from("schools")
    .select("id, name_ar, slug, governorate, directorate")
    .eq("slug", schoolSlug)
    .single();

  if (!school) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  // Authorize: school_admin of this school OR super_admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();

  const isSchoolAdmin = profile?.role === "school_admin" && profile.school_id === school.id;
  const isSuperAdmin = profile?.role === "super_admin";

  if (!isSchoolAdmin && !isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch all bookings for the school with related data
  const { data: bookingsData, error: bookingsError } = await supabase
    .from("bookings")
    .select(`
      id, status, seat_number, waitlist_position, booked_at, checked_in_at,
      sessions!bookings_session_id_fkey (
        title_ar, starts_at, ends_at,
        halls!sessions_hall_id_fkey ( code, name_ar ),
        subjects!sessions_subject_id_fkey ( code, name_ar ),
        teacher_profiles!sessions_teacher_id_fkey ( teacher_code )
      ),
      profiles!bookings_student_id_fkey ( student_national_code, role )
    `)
    .eq("school_id", school.id)
    .order("booked_at", { ascending: false })
    .limit(10000);

  if (bookingsError) {
    return NextResponse.json({ error: bookingsError.message }, { status: 500 });
  }

  // Build CSV with UTF-8 BOM for proper Arabic display in Excel/Ministry tools
  const BOM = "\uFEFF";

  const headers = [
    "Reference Code",
    "Booking Status",
    "Student Code",
    "Seat Number",
    "Waitlist Position",
    "Subject Code",
    "Subject Name (AR)",
    "Session Title (AR)",
    "Session Starts At",
    "Session Ends At",
    "Hall Code",
    "Hall Name (AR)",
    "Teacher Code",
    "Booked At",
    "Checked In At",
  ];

  const rows: string[] = [buildCsvRow(headers)];

  for (const b of bookingsData ?? []) {
    const session = b.sessions as unknown as {
      title_ar: string;
      starts_at: string;
      ends_at: string;
      halls: { code: string; name_ar: string } | null;
      subjects: { code: string; name_ar: string } | null;
      teacher_profiles: { teacher_code: string } | null;
    } | null;

    const studentProfile = b.profiles as unknown as {
      student_national_code: string | null;
    } | null;

    const shortId = b.id.replace(/-/g, "").slice(0, 8).toUpperCase();
    const referenceCode = `MDRG-2026-${shortId}`;
    const studentCode = studentProfile?.student_national_code ?? b.id.slice(0, 8).toUpperCase();

    rows.push(
      buildCsvRow([
        referenceCode,
        b.status,
        studentCode,
        b.seat_number,
        b.waitlist_position,
        session?.subjects?.code ?? "",
        session?.subjects?.name_ar ?? "",
        session?.title_ar ?? "",
        session?.starts_at ?? "",
        session?.ends_at ?? "",
        session?.halls?.code ?? "",
        session?.halls?.name_ar ?? "",
        session?.teacher_profiles?.teacher_code ?? "",
        b.booked_at,
        b.checked_in_at ?? "",
      ])
    );
  }

  const csv = BOM + rows.join("\r\n");
  const filename = `modarrag-report-${school.slug}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
