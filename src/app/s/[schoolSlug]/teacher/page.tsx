import { getCurrentUserContext } from "@/application/auth/actions";
import { computeSchoolFinancialSummary } from "@/application/finance/actions";
import { getTeacherConsoleData } from "@/application/sessions/actions";
import {
  TeacherAccessNotice,
  TeacherDashboardClient,
  TeacherSubNav,
} from "@/components/teacher/TeacherDashboardClient";
import { getSchoolCatalogBySlug } from "@/infrastructure/supabase/catalog";

export interface TeacherPortalPageProps {
  readonly params: Promise<{ readonly schoolSlug: string }>;
}

export default async function TeacherPortalPage({
  params,
}: TeacherPortalPageProps) {
  const { schoolSlug } = await params;
  const [result, catalog, userCtx] = await Promise.all([
    getTeacherConsoleData(schoolSlug),
    getSchoolCatalogBySlug(schoolSlug).catch(() => null),
    getCurrentUserContext().catch(() => null),
  ]);

  if (!result.ok) {
    return (
      <TeacherAccessNotice
        schoolSlug={schoolSlug}
        errorCode={result.error.code}
        errorMessage={result.error.message}
      />
    );
  }

  const financialSummary =
    catalog && userCtx
      ? await computeSchoolFinancialSummary({
          schoolId: catalog.school.id,
          teacherId: userCtx.userId,
        }).catch(() => undefined)
      : undefined;

  return (
    <div>
      <TeacherSubNav schoolSlug={schoolSlug} />
      <TeacherDashboardClient
        schoolSlug={schoolSlug}
        data={result.data}
        financialSummary={financialSummary}
      />
    </div>
  );
}
