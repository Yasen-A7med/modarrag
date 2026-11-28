import { getHallOccupancyData } from "@/application/halls/actions";
import {
  AdminAccessNotice,
  AdminPortalNav,
} from "@/components/admin/AdminOverviewClient";
import {
  HallsManagerClient,
  type ReallocatableSession,
} from "@/components/admin/HallsManagerClient";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

export interface SchoolAdminHallsPageProps {
  readonly params: Promise<{ readonly schoolSlug: string }>;
}

export default async function SchoolAdminHallsPage({
  params,
}: SchoolAdminHallsPageProps) {
  const { schoolSlug } = await params;
  const occupancyResult = await getHallOccupancyData(schoolSlug);

  if (!occupancyResult.ok) {
    return (
      <AdminAccessNotice
        schoolSlug={schoolSlug}
        errorCode={occupancyResult.error.code}
        errorMessage={occupancyResult.error.message}
      />
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: school } = await supabase
    .from("schools")
    .select("id")
    .eq("slug", schoolSlug)
    .maybeSingle();

  let activeSessions: readonly ReallocatableSession[] = [];
  if (school) {
    const nowIso = new Date().toISOString();
    const { data: rows } = await supabase
      .from("sessions")
      .select(
        `
        id, title_ar, hall_id, starts_at, ends_at, booked_seats_count,
        halls!sessions_hall_id_fkey ( code )
      `
      )
      .eq("school_id", school.id)
      .not("hall_id", "is", null)
      .in("status", ["scheduled", "ongoing"])
      .gte("ends_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(50);

    activeSessions = (rows ?? [])
      .filter((row) => Boolean(row.hall_id))
      .map((row) => {
        const hall = row.halls as unknown as { code: string } | null;
        return {
          id: row.id,
          titleAr: row.title_ar,
          hallId: row.hall_id ?? "",
          hallCode: hall?.code ?? "",
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          bookedSeatsCount: row.booked_seats_count,
        };
      });
  }

  return (
    <div>
      <AdminPortalNav schoolSlug={schoolSlug} />
      <HallsManagerClient
        schoolSlug={schoolSlug}
        halls={occupancyResult.data.halls}
        activeSessions={activeSessions}
      />
    </div>
  );
}
