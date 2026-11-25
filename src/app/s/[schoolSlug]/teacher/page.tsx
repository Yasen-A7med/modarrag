import { getTeacherConsoleData } from "@/application/sessions/actions";
import {
  TeacherAccessNotice,
  TeacherDashboardClient,
  TeacherSubNav,
} from "@/components/teacher/TeacherDashboardClient";

export interface TeacherPortalPageProps {
  readonly params: Promise<{ readonly schoolSlug: string }>;
}

export default async function TeacherPortalPage({
  params,
}: TeacherPortalPageProps) {
  const { schoolSlug } = await params;
  const result = await getTeacherConsoleData(schoolSlug);

  if (!result.ok) {
    return (
      <TeacherAccessNotice
        schoolSlug={schoolSlug}
        errorCode={result.error.code}
        errorMessage={result.error.message}
      />
    );
  }

  return (
    <div>
      <TeacherSubNav schoolSlug={schoolSlug} />
      <TeacherDashboardClient schoolSlug={schoolSlug} data={result.data} />
    </div>
  );
}
