import { getSchoolAdminDashboardData } from "@/application/academic/actions";
import { AcademicCmsClient } from "@/components/admin/AcademicCmsClient";
import {
  AdminAccessNotice,
  AdminPortalNav,
} from "@/components/admin/AdminOverviewClient";

export interface SchoolAdminAcademicPageProps {
  readonly params: Promise<{ readonly schoolSlug: string }>;
}

export default async function SchoolAdminAcademicPage({
  params,
}: SchoolAdminAcademicPageProps) {
  const { schoolSlug } = await params;
  const result = await getSchoolAdminDashboardData(schoolSlug);

  if (!result.ok) {
    return (
      <AdminAccessNotice
        schoolSlug={schoolSlug}
        errorCode={result.error.code}
        errorMessage={result.error.message}
      />
    );
  }

  return (
    <div>
      <AdminPortalNav
        schoolSlug={schoolSlug}
        pendingCount={result.data.pendingTeachers.length}
      />
      <AcademicCmsClient schoolSlug={schoolSlug} data={result.data} />
    </div>
  );
}
