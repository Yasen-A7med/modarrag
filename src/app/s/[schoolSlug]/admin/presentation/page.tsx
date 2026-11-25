import { getSchoolAdminDashboardData } from "@/application/academic/actions";
import { getHallOccupancyData } from "@/application/halls/actions";
import {
  AdminAccessNotice,
  AdminPortalNav,
} from "@/components/admin/AdminOverviewClient";
import { MinistryPresentationClient } from "@/components/admin/MinistryPresentationClient";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

export interface MinistryPresentationPageProps {
  readonly params: Promise<{ readonly schoolSlug: string }>;
}

export default async function MinistryPresentationPage({
  params,
}: MinistryPresentationPageProps) {
  const { schoolSlug } = await params;

  const [dashboardResult, occupancyResult] = await Promise.all([
    getSchoolAdminDashboardData(schoolSlug),
    getHallOccupancyData(schoolSlug),
  ]);

  if (!dashboardResult.ok) {
    return (
      <AdminAccessNotice
        schoolSlug={schoolSlug}
        errorCode={dashboardResult.error.code}
        errorMessage={dashboardResult.error.message}
      />
    );
  }

  const supabase = await createSupabaseServerClient();
  const schoolId = dashboardResult.data.school.id;

  const [totalBookings, checkedInBookings] = await Promise.all([
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .in("status", ["confirmed", "waitlisted", "checked_in", "no_show"]),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "checked_in"),
  ]);

  const occupancy = occupancyResult.ok ? occupancyResult.data : { halls: [] };

  return (
    <div>
      <AdminPortalNav
        schoolSlug={schoolSlug}
        pendingCount={dashboardResult.data.pendingTeachers.length}
      />
      <MinistryPresentationClient
        schoolSlug={schoolSlug}
        dashboard={dashboardResult.data}
        occupancy={occupancy}
        totalBookingsCount={totalBookings.count ?? 0}
        checkedInCount={checkedInBookings.count ?? 0}
      />
    </div>
  );
}
