import { getSchoolAdminDashboardData } from "@/application/academic/actions";
import { computeSchoolFinancialSummary } from "@/application/finance/actions";
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

  const [occupancy, financialSummary] = await Promise.all([
    Promise.resolve(occupancyResult.ok ? occupancyResult.data : { halls: [] }),
    computeSchoolFinancialSummary({
      schoolId: dashboardResult.data.school.id,
    }).catch(() => undefined),
  ]);

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
        financialSummary={financialSummary}
      />
    </div>
  );
}
