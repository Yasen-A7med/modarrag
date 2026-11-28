import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSchoolLecturesCatalog } from "@/application/lectures/actions";
import { SchoolLecturesClient } from "@/components/lectures/SchoolLecturesClient";

export const metadata: Metadata = {
  title: "المحاضرات المسجلة",
};

export const dynamic = "force-dynamic";

export interface SchoolLecturesPageProps {
  readonly params: Promise<{ readonly schoolSlug: string }>;
}

export default async function SchoolLecturesPage({
  params,
}: SchoolLecturesPageProps) {
  const { schoolSlug } = await params;
  const result = await getSchoolLecturesCatalog(schoolSlug);

  if (!result.ok) {
    notFound();
  }

  return <SchoolLecturesClient data={result.data} />;
}
