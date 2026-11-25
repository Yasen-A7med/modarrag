"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  Clock,
  GraduationCap,
  MapPin,
  Trash2,
  UserCheck,
} from "lucide-react";
import {
  bookStudentSeatAction,
  cancelStudentBookingAction,
  type StudentPortalBooking,
  type StudentPortalData,
  type StudentPortalSession,
} from "@/application/bookings/actions";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import type { UserRole } from "@/infrastructure/supabase/database.types";
import {
  BOOKING_STATUS_LABELS,
  formatArabicNumber,
  formatCairoDate,
  formatCairoTimeRange,
  formatSeatOccupancyAr,
} from "@/lib/formatters";
import { BOOKING_STATUS_TONES } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

export interface StudentPortalClientProps {
  readonly schoolSlug: string;
  readonly schoolNameAr: string;
  readonly initialData: StudentPortalData;
  readonly userRole: UserRole | null;
  readonly trackCode?: string | null;
}

interface BookingSuccessModal {
  readonly status: "confirmed" | "waitlisted";
  readonly sessionTitleAr: string;
  readonly subjectNameAr: string;
  readonly hallNameAr: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly seatNumber: string | null;
  readonly waitlistPosition: number | null;
}

/**
 * Ultra-clear single-screen Student Portal:
 * (1) Greeting + next booked session reassurance banner ("أنت مسجل بالاسم ✓"),
 * (2) My Booked Sessions with 1-tap cancel dialog,
 * (3) Subject pill filters + large colorful Session Cards with 1-tap name-based reservation.
 */
export function StudentPortalClient({
  schoolSlug,
  schoolNameAr,
  initialData,
  userRole,
}: StudentPortalClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [optimisticBookings, setOptimisticBookings] = React.useState<
    readonly StudentPortalBooking[]
  >([]);
  const [cancelledIds, setCancelledIds] = React.useState<readonly string[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = React.useState<string>("all");
  const [bookingSessionId, setBookingSessionId] = React.useState<string | null>(null);
  const [successModal, setSuccessModal] = React.useState<BookingSuccessModal | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<StudentPortalBooking | null>(null);
  const [cancelling, setCancelling] = React.useState(false);

  const bookings = React.useMemo(() => {
    const cancelledSet = new Set(cancelledIds);
    const serverIds = new Set(initialData.bookings.map((b) => b.id));
    const mergedExtra = optimisticBookings.filter(
      (b) => !serverIds.has(b.id) && !cancelledSet.has(b.id)
    );
    const updatedServer = initialData.bookings.map((b) =>
      cancelledSet.has(b.id)
        ? { ...b, status: "cancelled_by_student" as const }
        : b
    );
    return [...mergedExtra, ...updatedServer];
  }, [cancelledIds, initialData.bookings, optimisticBookings]);

  const sessions = React.useMemo(() => {
    const serverBookedIds = new Set(
      initialData.bookings
        .filter((b) => b.status === "confirmed")
        .map((b) => b.sessionId)
    );
    const addedConfirmedSessionIds = new Set(
      optimisticBookings
        .filter((b) => b.status === "confirmed" && !cancelledIds.includes(b.id))
        .map((b) => b.sessionId)
    );
    const cancelledConfirmedSessionIds = new Set(
      initialData.bookings
        .filter((b) => b.status === "confirmed" && cancelledIds.includes(b.id))
        .map((b) => b.sessionId)
    );

    return initialData.sessions.map((s) => {
      let delta = 0;
      if (addedConfirmedSessionIds.has(s.id) && !serverBookedIds.has(s.id)) {
        delta += 1;
      }
      if (cancelledConfirmedSessionIds.has(s.id)) {
        delta -= 1;
      }
      return delta === 0
        ? s
        : { ...s, bookedSeatsCount: Math.max(0, s.bookedSeatsCount + delta) };
    });
  }, [cancelledIds, initialData.bookings, initialData.sessions, optimisticBookings]);

  const isStudentAccount = userRole === "student";
  const hasEnrollment = initialData.enrollment !== null;

  const activeBookings = React.useMemo(
    () =>
      bookings.filter(
        (b) =>
          b.status === "confirmed" ||
          b.status === "waitlisted" ||
          b.status === "checked_in"
      ),
    [bookings]
  );

  const nextUpcomingBooking = React.useMemo(
    () =>
      activeBookings.find(
        (b) => b.status === "confirmed" || b.status === "checked_in"
      ) ?? null,
    [activeBookings]
  );

  const activeBookingBySessionId = React.useMemo(() => {
    const map = new Map<string, StudentPortalBooking>();
    for (const b of activeBookings) {
      map.set(b.sessionId, b);
    }
    return map;
  }, [activeBookings]);

  const subjectFilterOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of sessions) {
      if (s.isEligible && s.subjectNameAr && !seen.has(s.subjectId)) {
        seen.set(s.subjectId, s.subjectNameAr);
      }
    }
    return Array.from(seen.entries()).map(([id, nameAr]) => ({ id, nameAr }));
  }, [sessions]);

  const visibleSessions = React.useMemo(() => {
    const eligible = hasEnrollment ? sessions.filter((s) => s.isEligible) : sessions;
    if (selectedSubjectId === "all") {
      return eligible;
    }
    return eligible.filter((s) => s.subjectId === selectedSubjectId);
  }, [hasEnrollment, selectedSubjectId, sessions]);

  const handleReserve = async (session: StudentPortalSession) => {
    if (!isStudentAccount || !hasEnrollment) return;

    setBookingSessionId(session.id);
    try {
      const result = await bookStudentSeatAction({
        sessionId: session.id,
        schoolSlug,
      });

      if (!result.ok) {
        toast({
          title: "تعذر إتمام الحجز",
          description: result.error.message,
          variant: "error",
        });
        return;
      }

      const newBooking: StudentPortalBooking = {
        id: result.data.bookingId,
        sessionId: session.id,
        status: result.data.status,
        seatNumber: result.data.seatNumber,
        waitlistPosition: result.data.waitlistPosition,
        bookedAt: new Date().toISOString(),
        sessionTitleAr: session.titleAr,
        sessionStartsAt: session.startsAt,
        sessionEndsAt: session.endsAt,
        hallNameAr: session.hallNameAr,
        subjectNameAr: session.subjectNameAr,
        teacherSpecialtyAr: session.teacherSpecialtyAr,
      };

      setOptimisticBookings((prev) => [newBooking, ...prev]);

      setSuccessModal({
        status: result.data.status,
        sessionTitleAr: session.titleAr,
        subjectNameAr: session.subjectNameAr,
        hallNameAr: session.hallNameAr,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        seatNumber: result.data.seatNumber,
        waitlistPosition: result.data.waitlistPosition,
      });

      router.refresh();
    } catch {
      toast({
        title: "خطأ غير متوقع",
        description: "تعذر الاتصال بالخادم الآن. يرجى المحاولة مرة أخرى.",
        variant: "error",
      });
    } finally {
      setBookingSessionId(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);

    try {
      const result = await cancelStudentBookingAction({
        bookingId: cancelTarget.id,
        schoolSlug,
      });

      if (!result.ok) {
        toast({
          title: "تعذر إلغاء الحجز",
          description: result.error.message,
          variant: "error",
        });
        return;
      }

      setCancelledIds((prev) => [...prev, cancelTarget.id]);

      toast({
        title: "تم إلغاء حجزك",
        description: "تم فتح المقعد لطالب آخر في قائمة المدرسة.",
        variant: "info",
      });

      setCancelTarget(null);
      router.refresh();
    } catch {
      toast({
        title: "خطأ أثناء الإلغاء",
        description: "يرجى المحاولة مرة أخرى.",
        variant: "error",
      });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Greeting Header Card */}
      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 hairline-lift">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#0B63CE] dark:text-blue-400">
              {schoolNameAr}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
              أهلاً، {initialData.studentName}
            </h1>
            {initialData.enrollment && (
              <p className="mt-1 text-base text-[var(--text-secondary)]">
                مسارك المسجل:{" "}
                <strong className="font-bold text-[var(--text-primary)]">
                  {initialData.enrollment.trackNameAr}
                </strong>
              </p>
            )}
          </div>

          {initialData.enrollment ? (
            <Link
              href="/onboarding"
              className={buttonVariants({ variant: "outline", size: "md" })}
            >
              تغيير المسار أو البيانات
            </Link>
          ) : isStudentAccount ? (
            <Link
              href="/onboarding"
              className={buttonVariants({ variant: "emerald", size: "lg" })}
            >
              اختر مسارك الدراسي أولاً
            </Link>
          ) : null}
        </div>

        {!isStudentAccount && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-base text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            أنت تتصفح الجدول للمعاينة فقط. الحجز الفعلي متاح لحسابات الطلاب.
          </div>
        )}
      </div>

      {/* Prominent Next Booking Banner ("أنت مسجل بالاسم ✓") */}
      {nextUpcomingBooking && (
        <div className="rounded-2xl border-2 border-[#16A34A]/40 bg-emerald-50/75 p-5 sm:p-6 dark:border-emerald-500/40 dark:bg-emerald-500/10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#16A34A] text-white">
                <UserCheck className="h-6 w-6" />
              </span>
              <div>
                <p className="text-base font-bold text-emerald-900 dark:text-emerald-200">
                  أنت مسجل بالاسم ✓ — {nextUpcomingBooking.subjectNameAr}
                </p>
                <p className="mt-1 text-base text-emerald-900/90 dark:text-emerald-100">
                  {nextUpcomingBooking.hallNameAr} ·{" "}
                  {formatCairoDate(nextUpcomingBooking.sessionStartsAt, {
                    includeWeekday: true,
                  })}{" "}
                  {" · "}
                  <span className="whitespace-nowrap tabular-nums">
                    {formatCairoTimeRange(
                      nextUpcomingBooking.sessionStartsAt,
                      nextUpcomingBooking.sessionEndsAt
                    )}
                  </span>
                </p>
                <p className="mt-1 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  لا تحتاج تذكرة أو باركود — اذكر اسمك فقط للمعلم عند دخول القاعة.
                </p>
              </div>
            </div>

            {nextUpcomingBooking.seatNumber && (
              <div className="shrink-0 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-center dark:border-emerald-500/40 dark:bg-emerald-950/60">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  رقم المقعد
                </p>
                <p className="font-mono text-lg font-bold text-emerald-900 dark:text-white tabular-nums" dir="ltr">
                  {nextUpcomingBooking.seatNumber}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section 1: Student's Active Bookings */}
      {activeBookings.length > 0 && (
        <section aria-labelledby="my-bookings-heading" className="flex flex-col gap-3">
          <h2 id="my-bookings-heading" className="text-xl font-bold text-[var(--text-primary)]">
            حصصي المحجوزة ({formatArabicNumber(activeBookings.length)})
          </h2>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {activeBookings.map((booking) => {
              const statusInfo = BOOKING_STATUS_LABELS[booking.status];
              const tone = BOOKING_STATUS_TONES[booking.status];
              return (
                <Card key={booking.id}>
                  <CardContent className="flex flex-col gap-3 pt-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[#0B63CE] dark:text-blue-400">
                          {booking.subjectNameAr}
                        </p>
                        <h3 className="mt-0.5 text-lg font-bold text-[var(--text-primary)]">
                          {booking.sessionTitleAr}
                        </h3>
                      </div>
                      <Badge variant={tone} size="md">
                        {booking.status === "confirmed"
                          ? "مسجل بالاسم ✓"
                          : booking.status === "waitlisted"
                            ? `انتظار (${formatArabicNumber(booking.waitlistPosition ?? 1)})`
                            : statusInfo.ar}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[var(--text-secondary)]">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-[var(--text-muted)]" />
                        {booking.hallNameAr}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-[var(--text-muted)]" />
                        {formatCairoDate(booking.sessionStartsAt, {
                          includeWeekday: true,
                        })}
                      </span>
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <Clock className="h-4 w-4 text-[var(--text-muted)]" />
                        {formatCairoTimeRange(
                          booking.sessionStartsAt,
                          booking.sessionEndsAt
                        )}
                      </span>
                    </div>

                    {(booking.status === "confirmed" ||
                      booking.status === "waitlisted") && (
                      <div className="flex justify-end border-t border-[var(--border-hairline)] pt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCancelTarget(booking)}
                          leftIcon={<Trash2 className="h-4 w-4 text-red-600" />}
                        >
                          إلغاء الحجز
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Section 2: Available Sessions */}
      <section aria-labelledby="available-sessions-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="available-sessions-heading" className="text-xl font-bold text-[var(--text-primary)]">
            الحصص المتاحة للحجز
          </h2>
          <span className="text-sm font-medium text-[var(--text-muted)]">
            اضغط «احجز مكانك الآن» فيسجل اسمك فوراً عند المعلم
          </span>
        </div>

        {/* Big Subject Filter Pills */}
        {subjectFilterOptions.length > 1 && (
          <div
            className="flex items-center gap-2 overflow-x-auto pb-1"
            role="group"
            aria-label="تصفية حسب المادة"
          >
            <button
              type="button"
              onClick={() => setSelectedSubjectId("all")}
              className={cn(
                "min-h-[44px] shrink-0 rounded-xl border px-4 text-sm font-bold transition-colors cursor-pointer",
                selectedSubjectId === "all"
                  ? "border-[#0B63CE] bg-[#0B63CE] text-white dark:border-blue-500 dark:bg-blue-600"
                  : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
              )}
            >
              كل المواد
            </button>
            {subjectFilterOptions.map((subj) => {
              const active = selectedSubjectId === subj.id;
              return (
                <button
                  key={subj.id}
                  type="button"
                  onClick={() => setSelectedSubjectId(subj.id)}
                  className={cn(
                    "min-h-[44px] shrink-0 rounded-xl border px-4 text-sm font-bold transition-colors cursor-pointer",
                    active
                      ? "border-[#0B63CE] bg-[#0B63CE] text-white dark:border-blue-500 dark:bg-blue-600"
                      : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                  )}
                >
                  {subj.nameAr}
                </button>
              );
            })}
          </div>
        )}

        {visibleSessions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <GraduationCap className="h-10 w-10 text-[var(--text-muted)]" />
              <p className="text-lg font-bold text-[var(--text-primary)]">
                لا توجد حصص متاحة في هذه المادة حالياً
              </p>
              <p className="text-base text-[var(--text-secondary)]">
                جرّب اختيار «كل المواد» أو راجع الصفحة لاحقاً عند إضافة مواعيد جديدة.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {visibleSessions.map((session) => {
              const existingBooking = activeBookingBySessionId.get(session.id);
              const sessionStartMs = Date.parse(session.startsAt);
              const sessionEndMs = Date.parse(session.endsAt);
              const conflictingBooking = !existingBooking
                ? activeBookings.find(
                    (b) =>
                      b.sessionId !== session.id &&
                      (b.status === "confirmed" || b.status === "checked_in") &&
                      Date.parse(b.sessionStartsAt) < sessionEndMs &&
                      Date.parse(b.sessionEndsAt) > sessionStartMs
                  )
                : undefined;
              const isFull =
                session.bookedSeatsCount >= session.maxCapacity ||
                session.status === "full";
              const remainingSeats = Math.max(
                0,
                session.maxCapacity - session.bookedSeatsCount
              );
              const fillPct =
                session.maxCapacity > 0
                  ? Math.min(
                      100,
                      Math.round((session.bookedSeatsCount / session.maxCapacity) * 100)
                    )
                  : 0;
              const isBusy = bookingSessionId === session.id;

              return (
                <div
                  key={session.id}
                  className={cn(
                    "flex flex-col justify-between rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 hairline-lift",
                    existingBooking
                      ? "border-t-4 border-t-[#16A34A]"
                      : conflictingBooking
                        ? "border-t-4 border-t-slate-400"
                        : isFull
                          ? "border-t-4 border-t-[#D97706]"
                          : "border-t-4 border-t-[#0B63CE]"
                  )}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-block rounded-lg bg-[#EEF5FF] px-3 py-1 text-sm font-bold text-[#0B63CE] dark:bg-blue-500/15 dark:text-blue-300">
                          {session.subjectNameAr}
                        </span>
                        <h3 className="mt-2.5 text-lg font-bold text-[var(--text-primary)]">
                          {session.titleAr}
                        </h3>
                        <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                          {session.teacherSpecialtyAr}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 text-base text-[var(--text-secondary)]">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                        <span className="font-semibold text-[var(--text-primary)]">
                          {session.hallNameAr}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                        <span>
                          {formatCairoDate(session.startsAt, { includeWeekday: true })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 whitespace-nowrap tabular-nums">
                        <Clock className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                        <span>
                          {formatCairoTimeRange(session.startsAt, session.endsAt)}
                        </span>
                      </div>
                    </div>

                    {/* Clear Remaining Seats Bar */}
                    <div className="mt-4 rounded-xl bg-[var(--bg-sunken)] p-3">
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span
                          className={
                            remainingSeats === 0
                              ? "text-amber-700 dark:text-amber-300"
                              : "text-[var(--text-primary)]"
                          }
                        >
                          {formatSeatOccupancyAr(
                            session.bookedSeatsCount,
                            session.maxCapacity
                          )}
                        </span>
                        <span className="text-[var(--text-muted)] tabular-nums">
                          {formatArabicNumber(fillPct)}%
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div
                          className={cn(
                            "h-full rounded-full transition-[width] duration-150",
                            remainingSeats === 0
                              ? "bg-amber-500"
                              : fillPct >= 80
                                ? "bg-amber-500"
                                : "bg-[#16A34A]"
                          )}
                          style={{ width: `${fillPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Single Unambiguous Primary Action */}
                  <div className="mt-5">
                    {existingBooking ? (
                      <div className="flex min-h-[50px] items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-base font-bold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200">
                        <CheckCircle2 className="h-5 w-5" />
                        <span>
                          {existingBooking.status === "waitlisted"
                            ? `أنت في قائمة الانتظار (رقم ${formatArabicNumber(
                                existingBooking.waitlistPosition ?? 1
                              )})`
                            : "أنت مسجل بالاسم في هذه الحصة ✓"}
                        </span>
                      </div>
                    ) : conflictingBooking ? (
                      <div className="flex min-h-[50px] items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-4 text-center text-sm font-semibold text-[var(--text-secondary)]">
                        نفس موعد حجزك في «{conflictingBooking.subjectNameAr}»
                      </div>
                    ) : (
                      <Button
                        variant={isFull ? "secondary" : "emerald"}
                        size="lg"
                        fullWidth
                        loading={isBusy}
                        disabled={!isStudentAccount || !hasEnrollment || bookingSessionId !== null}
                        onClick={() => handleReserve(session)}
                      >
                        {!isStudentAccount
                          ? "متاح لحسابات الطلاب"
                          : !hasEnrollment
                            ? "اختر مسارك أولاً للحجز"
                            : isFull
                              ? "انضم لقائمة الانتظار"
                              : "احجز مكانك الآن"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Booking Success Confirmation Modal (Native <dialog closedby="any">) */}
      <Dialog
        open={successModal !== null}
        onOpenChange={(open) => {
          if (!open) setSuccessModal(null);
        }}
      >
        <DialogContent>
          {successModal && (
            <>
              <DialogHeader>
                <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-[#16A34A] dark:bg-emerald-500/15 dark:text-emerald-300">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <DialogTitle>
                  {successModal.status === "confirmed"
                    ? "تم تسجيل اسمك في الحصة بنجاح!"
                    : "تم تسجيلك في قائمة الانتظار"}
                </DialogTitle>
                <DialogDescription>
                  {successModal.status === "confirmed"
                    ? `اسمك مسجل الآن باسم «${initialData.studentName}» لدى المعلم. لا تحتاج لأي تذكرة أو باركود.`
                    : `ترتيبك في قائمة الانتظار هو رقم ${formatArabicNumber(
                        successModal.waitlistPosition ?? 1
                      )} وسيتم تثبيت مقعدك تلقائياً فور توفر مكان.`}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 flex flex-col gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-4 text-base">
                <p className="font-bold text-[var(--text-primary)]">
                  {successModal.subjectNameAr} — {successModal.sessionTitleAr}
                </p>
                <p className="text-[var(--text-secondary)]">{successModal.hallNameAr}</p>
                <p className="text-[var(--text-secondary)] tabular-nums">
                  {formatCairoDate(successModal.startsAt, { includeWeekday: true })} ·{" "}
                  {formatCairoTimeRange(successModal.startsAt, successModal.endsAt)}
                </p>
                {successModal.seatNumber && (
                  <p className="font-semibold text-[#16A34A] dark:text-emerald-400">
                    رقم المقعد: {successModal.seatNumber}
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="emerald"
                  size="lg"
                  fullWidth
                  onClick={() => setSuccessModal(null)}
                >
                  حسناً، فهمت
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Booking Confirmation Modal */}
      <Dialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open && !cancelling) setCancelTarget(null);
        }}
      >
        <DialogContent>
          {cancelTarget && (
            <>
              <DialogHeader>
                <DialogTitle>هل تريد إلغاء حجزك؟</DialogTitle>
                <DialogDescription>
                  سيتم إلغاء حجزك في «{cancelTarget.subjectNameAr} —{" "}
                  {cancelTarget.sessionTitleAr}» وإتاحة المقعد لزميل آخر بالمدرسة.
                </DialogDescription>
              </DialogHeader>

              <DialogFooter>
                <Button
                  variant="outline"
                  size="md"
                  disabled={cancelling}
                  onClick={() => setCancelTarget(null)}
                >
                  تراجع، سأحضر
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  loading={cancelling}
                  onClick={handleConfirmCancel}
                >
                  تأكيد إلغاء الحجز
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
