import type { Metadata } from "next";
import { getTeacherLecturesData } from "@/application/lectures/actions";
import { TeacherAccessNotice, TeacherSubNav } from "@/components/teacher/TeacherDashboardClient";
import { TeacherLecturesClient } from "@/components/teacher/TeacherLecturesClient";

export const metadata: Metadata = {
  title: "رفع وإدارة المحاضرات المسجلة",
};

export const dynamic = "force-dynamic";

export interface TeacherLecturesPageProps {
  readonly params: Promise<{ readonly schoolSlug: string }>;
}

export default async function TeacherLecturesPage({
  params,
}: TeacherLecturesPageProps) {
  const { schoolSlug } = await params;
  const result = await getTeacherLecturesData(schoolSlug);

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
      <TeacherLecturesClient data={result.data} />
    </div>
  );
}
