import { getSchoolAdminDashboardData } from "@/application/academic/actions";
import { getHallOccupancyData } from "@/application/halls/actions";
import {
  AdminAccessNotice,
  AdminOverviewClient,
  AdminPortalNav,
} from "@/components/admin/AdminOverviewClient";

export interface SchoolAdminOverviewPageProps {
  readonly params: Promise<{ readonly schoolSlug: string }>;
}

export default async function SchoolAdminOverviewPage({
  params,
}: SchoolAdminOverviewPageProps) {
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

  const occupancy = occupancyResult.ok ? occupancyResult.data : { halls: [] };

  return (
    <div>
      <AdminPortalNav
        schoolSlug={schoolSlug}
        pendingCount={dashboardResult.data.pendingTeachers.length}
      />
      <AdminOverviewClient
        schoolSlug={schoolSlug}
        dashboard={dashboardResult.data}
        occupancy={occupancy}
      />
    </div>
  );
}
