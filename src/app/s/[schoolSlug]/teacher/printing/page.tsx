import type { Metadata } from "next";
import { getPrintCenterData } from "@/application/printing/actions";
import { PrintCenterClient } from "@/components/printing/PrintCenterClient";
import { TeacherAccessNotice } from "@/components/teacher/TeacherDashboardClient";

export const metadata: Metadata = {
  title: "المطبعة أونلاين وطباعة المذكرات",
};

export const dynamic = "force-dynamic";

export interface TeacherPrintingPageProps {
  readonly params: Promise<{ readonly schoolSlug: string }>;
}

export default async function TeacherPrintingPage({
  params,
}: TeacherPrintingPageProps) {
  const { schoolSlug } = await params;
  const result = await getPrintCenterData(schoolSlug);

  if (!result.ok) {
    return (
      <TeacherAccessNotice
        schoolSlug={schoolSlug}
        errorCode={result.error.code}
        errorMessage={result.error.message}
      />
    );
  }

  return <PrintCenterClient schoolSlug={schoolSlug} data={result.data} />;
}
