import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, getAuthenticatedUser } from "@/infrastructure/supabase/server";

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

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: school } = await supabase
    .from("schools")
    .select("id, name_ar, slug")
    .eq("slug", schoolSlug)
    .single();

  if (!school) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

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

  const { data: bookingsData, error: bookingsError } = await supabase
    .from("bookings")
    .select(`
      id, status, seat_number, waitlist_position, booked_at, checked_in_at,
      sessions!bookings_session_id_fkey (
        title_ar, starts_at, ends_at,
        halls!sessions_hall_id_fkey ( name_ar ),
        subjects!sessions_subject_id_fkey ( name_ar ),
        teacher_profiles!sessions_teacher_id_fkey ( specialty_ar )
      ),
      profiles!bookings_student_id_fkey ( full_name, phone )
    `)
    .eq("school_id", school.id)
    .order("booked_at", { ascending: false })
    .limit(10000);

  if (bookingsError) {
    return NextResponse.json({ error: bookingsError.message }, { status: 500 });
  }

  const BOM = "\uFEFF";

  const headers = [
    "Student Name",
    "Phone",
    "Attendance Status",
    "Seat Number",
    "Waitlist Position",
    "Subject (AR)",
    "Session Title (AR)",
    "Session Starts At",
    "Hall Name (AR)",
    "Teacher Specialty (AR)",
    "Booked At",
    "Checked In At",
  ];

  const rows: string[] = [buildCsvRow(headers)];

  for (const b of bookingsData ?? []) {
    const session = b.sessions as unknown as {
      title_ar: string;
      starts_at: string;
      ends_at: string;
      halls: { name_ar: string } | null;
      subjects: { name_ar: string } | null;
      teacher_profiles: { specialty_ar: string } | null;
    } | null;

    const studentProfile = b.profiles as unknown as {
      full_name: string | null;
      phone: string | null;
    } | null;

    rows.push(
      buildCsvRow([
        studentProfile?.full_name ?? "",
        studentProfile?.phone ?? "",
        b.status,
        b.seat_number,
        b.waitlist_position,
        session?.subjects?.name_ar ?? "",
        session?.title_ar ?? "",
        session?.starts_at ?? "",
        session?.halls?.name_ar ?? "",
        session?.teacher_profiles?.specialty_ar ?? "",
        b.booked_at,
        b.checked_in_at ?? "",
      ])
    );
  }

  const csv = BOM + rows.join("\r\n");
  const filename = `modarrag-attendance-${school.slug}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
