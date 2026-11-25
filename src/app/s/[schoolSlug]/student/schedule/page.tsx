import type { Metadata } from "next";
import { getCurrentUserContext } from "@/application/auth/actions";
import { getStudentPortalData } from "@/application/bookings/actions";
import { StudentAccessGuard } from "@/components/student/StudentAccessGuard";
import { StudentScheduleClient } from "@/components/student/StudentScheduleClient";

export const metadata: Metadata = {
  title: "جدولي وتذاكري",
};

export const dynamic = "force-dynamic";

export interface StudentSchedulePageProps {
  readonly params: Promise<{ readonly schoolSlug: string }>;
}

export default async function StudentSchedulePage({
  params,
}: StudentSchedulePageProps) {
  const { schoolSlug } = await params;

  const [portalResult, userCtx] = await Promise.all([
    getStudentPortalData(schoolSlug),
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

  return (
    <StudentScheduleClient
      schoolSlug={schoolSlug}
      initialBookings={portalResult.data.bookings}
      hasEnrollment={portalResult.data.enrollment !== null}
      userRole={userCtx?.role ?? null}
    />
  );
}
