import type { Metadata } from "next";
import { getCurrentUserContext } from "@/application/auth/actions";
import { getStudentPortalData } from "@/application/bookings/actions";
import { StudentAccessGuard } from "@/components/student/StudentAccessGuard";
import { StudentPortalClient } from "@/components/student/StudentPortalClient";
import {
  getSchoolCatalogBySlug,
  type SchoolCatalogBundle,
} from "@/infrastructure/supabase/catalog";

export const metadata: Metadata = {
  title: "بوابة الطالب — الحصص المتاحة",
};

export const dynamic = "force-dynamic";

export interface StudentPortalPageProps {
  readonly params: Promise<{ readonly schoolSlug: string }>;
}

export default async function StudentPortalPage({
  params,
}: StudentPortalPageProps) {
  const { schoolSlug } = await params;

  const [portalResult, catalog, userCtx] = await Promise.all([
    getStudentPortalData(schoolSlug),
    getSchoolCatalogBySlug(schoolSlug).catch(
      (): SchoolCatalogBundle | null => null
    ),
    getCurrentUserContext().catch(() => null),
  ]);

  if (!portalResult.ok) {
    return (
      <StudentAccessGuard
        error={portalResult.error}
        schoolSlug={schoolSlug}
        userRole={userCtx?.role ?? null}
      />
    );
  }

  const enrollmentTrackId = portalResult.data.enrollment?.trackId;
  const matchedTrack = enrollmentTrackId
    ? catalog?.tracks.find((t) => t.id === enrollmentTrackId)
    : undefined;

  return (
    <StudentPortalClient
      schoolSlug={schoolSlug}
      schoolNameAr={catalog?.school.name_ar ?? schoolSlug}
      initialData={portalResult.data}
      userRole={userCtx?.role ?? null}
      trackCode={matchedTrack?.code ?? null}
    />
  );
}
