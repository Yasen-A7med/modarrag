import { getTeacherConsoleData } from "@/application/sessions/actions";
import { CalHallBookingGrid } from "@/components/teacher/CalHallBookingGrid";
import {
  TeacherAccessNotice,
  TeacherSubNav,
} from "@/components/teacher/TeacherDashboardClient";

export interface BookHallPageProps {
  readonly params: Promise<{ readonly schoolSlug: string }>;
}

export default async function BookHallPage({ params }: BookHallPageProps) {
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
      <CalHallBookingGrid schoolSlug={schoolSlug} data={result.data} />
    </div>
  );
}
