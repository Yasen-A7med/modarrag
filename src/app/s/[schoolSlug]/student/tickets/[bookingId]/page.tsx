import type { Metadata } from "next";
import { getCurrentUserContext } from "@/application/auth/actions";
import { getBookingTicketData } from "@/application/bookings/actions";
import { DigitalQrPass } from "@/components/student/DigitalQrPass";
import { StudentAccessGuard } from "@/components/student/StudentAccessGuard";
import { StudentSubNav } from "@/components/student/StudentSubNav";
import { getSchoolBySlug } from "@/infrastructure/supabase/catalog";

export const metadata: Metadata = {
  title: "تذكرة الدخول الرقمية",
};

export const dynamic = "force-dynamic";

export interface StudentTicketPageProps {
  readonly params: Promise<{
    readonly schoolSlug: string;
    readonly bookingId: string;
  }>;
}

export default async function StudentTicketPage({
  params,
}: StudentTicketPageProps) {
  const { schoolSlug, bookingId } = await params;

  const [ticketResult, school, userCtx] = await Promise.all([
    getBookingTicketData(schoolSlug, bookingId),
    getSchoolBySlug(schoolSlug).catch(() => null),
    getCurrentUserContext().catch(() => null),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <StudentSubNav schoolSlug={schoolSlug} activeTab="ticket" />

      {!ticketResult.ok ? (
        <StudentAccessGuard
          error={ticketResult.error}
          schoolSlug={schoolSlug}
          userRole={userCtx?.role ?? null}
        />
      ) : (
        <DigitalQrPass
          ticket={ticketResult.data}
          schoolSlug={schoolSlug}
          schoolNameAr={school?.name_ar ?? schoolSlug}
        />
      )}
    </div>
  );
}
