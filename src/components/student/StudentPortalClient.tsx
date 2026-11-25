"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  Lock,
  MapPin,
  QrCode,
  ShieldCheck,
  Ticket,
  UserCheck,
} from "lucide-react";
import {
  bookStudentSeatAction,
  type StudentPortalData,
} from "@/application/bookings/actions";
import { TrackIcon } from "@/components/brand/TrackIcon";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import type {
  SessionStatus,
  UserRole,
} from "@/infrastructure/supabase/database.types";
import {
  getTrackStyle,
  SESSION_STATUS_TONES,
} from "@/lib/design-tokens";
import {
  formatArabicNumber,
  formatCairoDate,
  formatCairoTime,
  formatCairoTimeRange,
  getUserRoleLabel,
  SESSION_STATUS_LABELS,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { SeatGauge } from "./SeatGauge";
import { StudentSubNav } from "./StudentSubNav";

export interface StudentPortalClientProps {
  readonly schoolSlug: string;
  readonly schoolNameAr: string;
  readonly initialData: StudentPortalData;
  readonly userRole: UserRole | null;
  readonly trackCode?: string | null;
}

interface BookingModalState {
  readonly status: "confirmed" | "waitlisted";
  readonly bookingId: string;
  readonly sessionTitleAr: string;
  readonly seatNumber: string | null;
  readonly waitlistPosition: number | null;
  readonly referenceCode: string;
}

function inferTrackCodeFromName(
  trackNameAr?: string | null,
  explicitCode?: string | null
): string {
  if (explicitCode) {
    return explicitCode;
  }
  const name = trackNameAr ?? "";
  if (name.includes("طب")) return "MED_TRACK";
  if (name.includes("أعمال")) return "BUS_TRACK";
  if (name.includes("آداب") || name.includes("فنون")) return "ART_TRACK";
  return "ENG_TRACK";
}

function getSessionStatusMeta(status: string) {
  if (status in SESSION_STATUS_LABELS) {
    const key = status as SessionStatus;
    return {
      labelAr: SESSION_STATUS_LABELS[key].ar,
      tone: SESSION_STATUS_TONES[key],
    };
  }
  return { labelAr: status, tone: "neutral" as const };
}

function formatCountdownParts(diffMs: number): string {
  if (diffMs <= 0) {
    return "تبدأ الآن";
  }
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  if (days > 0) {
    return `${formatArabicNumber(days)} يوم · ${clock}`;
  }
  return clock;
}

function buildLocalReferenceCode(bookingId: string): string {
  return `MDRG-2026-${bookingId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/**
 * Interactive Student Portal client workspace:
 * - Live countdown hero strip + track emblem + notifications drawer
 * - Horizontal subject pills & eligibility lock filter
 * - Real-time SeatGauge cards & 1-tap booking / waitlist flow
 */
export function StudentPortalClient({
  schoolSlug,
  schoolNameAr,
  initialData,
  userRole,
  trackCode,
}: StudentPortalClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [optimisticBookings, setOptimisticBookings] = React.useState<
    StudentPortalData["bookings"]
  >([]);
  const bookings = React.useMemo(() => {
    const seen = new Set(initialData.bookings.map((b) => b.id));
    const pending = optimisticBookings.filter((b) => !seen.has(b.id));
    return [...pending, ...initialData.bookings];
  }, [initialData.bookings, optimisticBookings]);

  const sessions = React.useMemo(() => {
    const serverBookingIds = new Set(initialData.bookings.map((b) => b.id));
    const newlyConfirmedSessionIds = new Set(
      optimisticBookings
        .filter((b) => !serverBookingIds.has(b.id) && b.status === "confirmed")
        .map((b) => b.sessionId)
    );
    if (newlyConfirmedSessionIds.size === 0) {
      return initialData.sessions;
    }
    return initialData.sessions.map((item) => {
      if (!newlyConfirmedSessionIds.has(item.id)) {
        return item;
      }
      const nextCount = item.bookedSeatsCount + 1;
      return {
        ...item,
        bookedSeatsCount: nextCount,
        status: nextCount >= item.maxCapacity ? "full" : item.status,
      };
    });
  }, [initialData.sessions, initialData.bookings, optimisticBookings]);

  const [selectedSubjectId, setSelectedSubjectId] = React.useState<string>("all");
  const [eligibleOnly, setEligibleOnly] = React.useState<boolean>(false);
  const [notifOpen, setNotifOpen] = React.useState<boolean>(false);
  const [pendingSessionId, setPendingSessionId] = React.useState<string | null>(null);
  const [confirmModal, setConfirmModal] = React.useState<BookingModalState | null>(null);
  const [nowMs, setNowMs] = React.useState<number | null>(null);

  React.useEffect(() => {
    const immediateTimer = window.setTimeout(() => {
      setNowMs(Date.now());
    }, 0);
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      window.clearTimeout(immediateTimer);
      window.clearInterval(interval);
    };
  }, []);

  const enrollment = initialData.enrollment;
  const resolvedTrackCode = inferTrackCodeFromName(enrollment?.trackNameAr, trackCode);
  const trackStyle = getTrackStyle(resolvedTrackCode);
  const isStudentAccount = !userRole || userRole === "student";

  const bookingBySessionId = React.useMemo(() => {
    const map = new Map<string, (typeof bookings)[number]>();
    for (const booking of bookings) {
      if (
        booking.status === "confirmed" ||
        booking.status === "waitlisted" ||
        booking.status === "checked_in"
      ) {
        map.set(booking.sessionId, booking);
      }
    }
    return map;
  }, [bookings]);

  const activeBookingsCount = React.useMemo(
    () =>
      bookings.filter((b) => b.status === "confirmed" || b.status === "waitlisted")
        .length,
    [bookings]
  );

  const nextConfirmedBooking = React.useMemo(() => {
    const confirmed = bookings
      .filter((b) => b.status === "confirmed" && b.sessionStartsAt)
      .slice()
      .sort(
        (a, b) =>
          new Date(a.sessionStartsAt).getTime() - new Date(b.sessionStartsAt).getTime()
      );

    if (nowMs === null) {
      return confirmed[0] ?? null;
    }

    return (
      confirmed.find((b) => new Date(b.sessionStartsAt).getTime() > nowMs) ??
      confirmed[0] ??
      null
    );
  }, [bookings, nowMs]);

  const subjectOptions = React.useMemo(() => {
    const map = new Map<string, { readonly id: string; readonly nameAr: string }>();
    for (const s of sessions) {
      if (!map.has(s.subjectId)) {
        map.set(s.subjectId, { id: s.subjectId, nameAr: s.subjectNameAr });
      }
    }
    return Array.from(map.values());
  }, [sessions]);

  const filteredSessions = React.useMemo(() => {
    return sessions.filter((s) => {
      if (selectedSubjectId !== "all" && s.subjectId !== selectedSubjectId) {
        return false;
      }
      if (eligibleOnly && enrollment !== null && !s.isEligible) {
        return false;
      }
      return true;
    });
  }, [sessions, selectedSubjectId, eligibleOnly, enrollment]);

  const handleBookSession = async (session: (typeof sessions)[number]) => {
    setPendingSessionId(session.id);
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

      const data = result.data;
      const referenceCode = buildLocalReferenceCode(data.bookingId);

      setOptimisticBookings((prev) => [
        {
          id: data.bookingId,
          sessionId: session.id,
          status: data.status,
          seatNumber: data.seatNumber,
          waitlistPosition: data.waitlistPosition,
          qrToken: data.qrToken,
          referenceCode,
          bookedAt: new Date().toISOString(),
          sessionTitleAr: session.titleAr,
          sessionStartsAt: session.startsAt,
        },
        ...prev,
      ]);

      toast({
        title:
          data.status === "confirmed"
            ? `تم حجز المقعد ${data.seatNumber ?? ""}`
            : `تمت إضافتك لقائمة الانتظار (#${data.waitlistPosition ?? 1})`,
        description: session.titleAr,
        variant: data.status === "confirmed" ? "success" : "info",
      });

      setConfirmModal({
        status: data.status,
        bookingId: data.bookingId,
        sessionTitleAr: session.titleAr,
        seatNumber: data.seatNumber,
        waitlistPosition: data.waitlistPosition,
        referenceCode,
      });

      router.refresh();
    } catch {
      toast({
        title: "خطأ في الاتصال",
        description: "يرجى المحاولة مرة أخرى بعد لحظات.",
        variant: "error",
      });
    } finally {
      setPendingSessionId(null);
    }
  };

  const nextDiffMs =
    nextConfirmedBooking && nowMs !== null
      ? new Date(nextConfirmedBooking.sessionStartsAt).getTime() - nowMs
      : null;

  return (
    <div className="flex flex-col gap-5">
      <StudentSubNav
        schoolSlug={schoolSlug}
        activeTab="sessions"
        activeBookingsCount={activeBookingsCount}
      />

      {/* Role or Missing-Enrollment Guidance Banner */}
      {!isStudentAccount && userRole ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100">
          <div className="flex items-start gap-3 min-w-0">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0">
              <p className="text-sm font-bold">
                وضع المعاينة — الحساب الحالي ({getUserRoleLabel(userRole, "ar")})
              </p>
              <p className="mt-0.5 text-xs opacity-90">
                يمكنك استعراض جدول الحصص بالمدرسة، بينما حجز المقاعد وإصدار تذاكر QR متاح لحسابات الطلاب فقط.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/s/${schoolSlug}`}
              className={buttonVariants({ variant: "outline", size: "md" })}
            >
              بوابة المدرسة
            </Link>
            <Link
              href="/login"
              className={buttonVariants({ variant: "primary", size: "md" })}
            >
              تبديل الحساب
            </Link>
          </div>
        </div>
      ) : enrollment === null ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/75 p-4 text-slate-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-slate-100">
          <div className="flex items-start gap-3 min-w-0">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#1E3A8A] dark:text-blue-400" />
            <div className="min-w-0">
              <p className="text-sm font-bold">لم يتم استكمال تحديد المسار الدراسي بعد</p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                يمكنك معاينة الحصص المتاحة في {schoolNameAr} الآن، ثم تحديد الصف والمسار لتفعيل الحجز الفوري.
              </p>
            </div>
          </div>
          <Link
            href="/onboarding"
            className={buttonVariants({ variant: "primary", size: "md" })}
          >
            تحديد المسار الآن
          </Link>
        </div>
      ) : null}

      {/* Hero Strip: Next Confirmed Session Countdown / Track Overview + Notifications Drawer */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardContent className="flex flex-col justify-between gap-4 p-4 sm:p-5">
            {nextConfirmedBooking ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="success" dot>
                      حجزك القادم المؤكد
                    </Badge>
                    {nextConfirmedBooking.seatNumber && (
                      <Badge variant="mono" dir="ltr">
                        {nextConfirmedBooking.seatNumber}
                      </Badge>
                    )}
                    <Badge variant="mono" dir="ltr">
                      {nextConfirmedBooking.referenceCode}
                    </Badge>
                  </div>
                  <h2 className="mt-2.5 text-lg font-bold text-[var(--text-primary)]">
                    {nextConfirmedBooking.sessionTitleAr}
                  </h2>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                      {formatCairoDate(nextConfirmedBooking.sessionStartsAt, {
                        includeWeekday: true,
                      })}
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                      {formatCairoTime(nextConfirmedBooking.sessionStartsAt)}
                    </span>
                  </p>
                </div>

                <div className="flex flex-col items-stretch gap-2.5 sm:items-end shrink-0">
                  <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-3.5 py-2 text-center">
                    <p className="text-[11px] text-[var(--text-muted)]">العد التنازلي للحصة</p>
                    <p
                      className="mt-0.5 font-mono text-base font-bold text-[#1E3A8A] tabular-nums dark:text-blue-400"
                      dir="ltr"
                    >
                      {nextDiffMs !== null ? formatCountdownParts(nextDiffMs) : "--:--:--"}
                    </p>
                  </div>
                  <Link
                    href={`/s/${schoolSlug}/student/tickets/${nextConfirmedBooking.id}`}
                    className={buttonVariants({ variant: "primary", size: "md" })}
                  >
                    <QrCode className="h-4 w-4 shrink-0" />
                    <span>فتح تذكرة الدخول</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <TrackIcon trackCode={resolvedTrackCode} size="lg" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {enrollment ? (
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-[11px] font-medium",
                            trackStyle.badgeClass
                          )}
                        >
                          {enrollment.trackNameAr}
                        </span>
                      ) : (
                        <Badge variant="neutral">معاينة عامة</Badge>
                      )}
                      <Badge variant="mono" dir="ltr">
                        {schoolSlug}
                      </Badge>
                    </div>
                    <h1 className="mt-2 text-lg font-bold text-[var(--text-primary)]">
                      {enrollment ? enrollment.gradeNameAr : schoolNameAr}
                    </h1>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {enrollment
                        ? "استعرض الحصص المتاحة لمسارك واحجز مقعدك بضغطة واحدة مع ضمان سعة القاعة."
                        : "حدد مسارك الدراسي لتفعيل أهلية الحجز التلقائي في المدرجات."}
                    </p>
                  </div>
                </div>

                <Link
                  href={`/s/${schoolSlug}/student/schedule`}
                  className={buttonVariants({ variant: "outline", size: "md" })}
                >
                  <Ticket className="h-4 w-4 shrink-0" />
                  <span>جدولي وتذاكري</span>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Unread Notifications Drawer / Strip */}
        <Card className="lg:col-span-4">
          <CardHeader className="p-4 pb-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-[#1E3A8A] dark:text-blue-400" />
                <CardTitle className="text-sm">الإشعارات</CardTitle>
                <Badge
                  variant={initialData.notifications.length > 0 ? "warning" : "neutral"}
                  size="sm"
                >
                  {formatArabicNumber(initialData.notifications.length)}
                </Badge>
              </div>
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer lg:hidden"
                aria-expanded={notifOpen}
              >
                <span>{notifOpen ? "إخفاء" : "عرض"}</span>
                {notifOpen ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </CardHeader>
          <CardContent className={cn("px-4 pb-4", notifOpen ? "block" : "hidden lg:block")}>
            {initialData.notifications.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-3 text-xs text-[var(--text-muted)]">
                لا توجد تنبيهات جديدة غير مقروءة حالياً.
              </p>
            ) : (
              <div className="flex max-h-36 flex-col gap-2 overflow-y-auto pe-1">
                {initialData.notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                        {notif.titleAr}
                      </p>
                      <span className="shrink-0 text-[10px] text-[var(--text-muted)] tabular-nums">
                        {formatCairoTime(notif.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                      {notif.bodyAr}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Subject Filter Horizontal Bar + Eligibility Filter Toggle */}
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 hairline-lift sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 sm:pb-0"
          role="tablist"
          aria-label="تصفية حسب المادة"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedSubjectId === "all"}
            onClick={() => setSelectedSubjectId("all")}
            className={cn(
              "inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg border px-3.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap",
              selectedSubjectId === "all"
                ? "border-[#1E3A8A] bg-[#1E3A8A] text-white dark:border-blue-500 dark:bg-blue-600"
                : "border-[var(--border-hairline)] bg-[var(--bg-sunken)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            )}
          >
            <span>جميع المواد</span>
            <Badge
              variant={selectedSubjectId === "all" ? "mono" : "neutral"}
              size="sm"
              className={
                selectedSubjectId === "all"
                  ? "border-white/25 bg-white/15 text-white"
                  : ""
              }
            >
              {formatArabicNumber(sessions.length)}
            </Badge>
          </button>

          {subjectOptions.map((subject) => {
            const active = selectedSubjectId === subject.id;
            return (
              <button
                key={subject.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedSubjectId(subject.id)}
                className={cn(
                  "inline-flex min-h-[44px] shrink-0 items-center rounded-lg border px-3.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap",
                  active
                    ? "border-[#1E3A8A] bg-[#1E3A8A] text-white dark:border-blue-500 dark:bg-blue-600"
                    : "border-[var(--border-hairline)] bg-[var(--bg-sunken)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                )}
              >
                {subject.nameAr}
              </button>
            );
          })}
        </div>

        {enrollment !== null && (
          <button
            type="button"
            onClick={() => setEligibleOnly((prev) => !prev)}
            aria-pressed={eligibleOnly}
            className={cn(
              "inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg border px-3.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap",
              eligibleOnly
                ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200"
                : "border-[var(--border-hairline)] bg-[var(--bg-sunken)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
            )}
          >
            <Filter className="h-3.5 w-3.5 shrink-0" />
            <span>{eligibleOnly ? "مواد مساري فقط" : "تصفية: مواد مساري"}</span>
          </button>
        )}
      </div>

      {/* Sessions Grid */}
      {filteredSessions.length === 0 ? (
        <Card variant="sunken" className="p-8 text-center">
          <Calendar className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
          <p className="mt-3 text-sm font-bold text-[var(--text-primary)]">
            لا توجد حصص مطابقة للتصفية الحالية
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            جرب اختيار &quot;جميع المواد&quot; أو إلغاء تصفية المسار لمعاينة بقية الحصص المجدولة بالمدرسة.
          </p>
          {(selectedSubjectId !== "all" || eligibleOnly) && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  setSelectedSubjectId("all");
                  setEligibleOnly(false);
                }}
              >
                عرض جميع الحصص
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredSessions.map((session) => {
            const existingBooking = bookingBySessionId.get(session.id);
            const statusMeta = getSessionStatusMeta(session.status);
            const isFull =
              session.bookedSeatsCount >= session.maxCapacity || session.status === "full";
            const isLockedOutOfTrack = enrollment !== null && !session.isEligible;

            return (
              <Card
                key={session.id}
                variant={isLockedOutOfTrack ? "sunken" : "default"}
                className={cn(
                  "flex flex-col justify-between",
                  isLockedOutOfTrack && "opacity-90"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="primary" size="sm">
                        {session.subjectNameAr}
                      </Badge>
                      <Badge variant={statusMeta.tone} size="sm" dot>
                        {statusMeta.labelAr}
                      </Badge>
                    </div>

                    {existingBooking ? (
                      <Badge
                        variant={
                          existingBooking.status === "waitlisted" ? "warning" : "success"
                        }
                        size="sm"
                      >
                        {existingBooking.status === "waitlisted"
                          ? `انتظار #${formatArabicNumber(existingBooking.waitlistPosition ?? 1)}`
                          : `محجوز · ${existingBooking.seatNumber ?? ""}`}
                      </Badge>
                    ) : isLockedOutOfTrack ? (
                      <Badge variant="neutral" size="sm" className="gap-1">
                        <Lock className="h-3 w-3 shrink-0" />
                        <span>خارج المسار</span>
                      </Badge>
                    ) : null}
                  </div>

                  <CardTitle className="mt-2 text-base">{session.titleAr}</CardTitle>
                </CardHeader>

                <CardContent className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 gap-2 text-xs text-[var(--text-secondary)] sm:grid-cols-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                      <span className="truncate">
                        {formatCairoDate(session.startsAt, { includeWeekday: true })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0 tabular-nums">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                      <span className="truncate">
                        {formatCairoTimeRange(session.startsAt, session.endsAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                      <span className="truncate">{session.hallNameAr}</span>
                      <span
                        className="rounded border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-muted)]"
                        dir="ltr"
                      >
                        {session.hallCode}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <UserCheck className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                      <span className="truncate">
                        معلم المادة · كود{" "}
                        <span className="font-mono" dir="ltr">
                          {session.teacherCode}
                        </span>
                      </span>
                    </div>
                  </div>

                  <SeatGauge
                    bookedSeatsCount={session.bookedSeatsCount}
                    maxCapacity={session.maxCapacity}
                    bufferMinutes={session.bufferMinutes}
                    status={session.status}
                  />
                </CardContent>

                <CardFooter className="bg-[var(--bg-surface)]">
                  {existingBooking ? (
                    existingBooking.status === "waitlisted" ? (
                      <Link
                        href={`/s/${schoolSlug}/student/schedule`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "lg",
                          fullWidth: true,
                        })}
                      >
                        <Clock className="h-4 w-4 shrink-0" />
                        <span>
                          في قائمة الانتظار (رقم{" "}
                          {formatArabicNumber(existingBooking.waitlistPosition ?? 1)}) — عرض الجدول
                        </span>
                      </Link>
                    ) : (
                      <Link
                        href={`/s/${schoolSlug}/student/tickets/${existingBooking.id}`}
                        className={buttonVariants({
                          variant: "primary",
                          size: "lg",
                          fullWidth: true,
                        })}
                      >
                        <QrCode className="h-4 w-4 shrink-0" />
                        <span>عرض التذكرة</span>
                      </Link>
                    )
                  ) : !isStudentAccount ? (
                    <Button variant="secondary" size="lg" fullWidth disabled>
                      الحجز متاح لحسابات الطلاب فقط
                    </Button>
                  ) : enrollment === null ? (
                    <Link
                      href="/onboarding"
                      className={buttonVariants({
                        variant: "outline",
                        size: "lg",
                        fullWidth: true,
                      })}
                    >
                      أكمل تحديد المسار لتفعيل الحجز
                    </Link>
                  ) : isLockedOutOfTrack ? (
                    <Button
                      variant="secondary"
                      size="lg"
                      fullWidth
                      disabled
                      leftIcon={<Lock className="h-4 w-4" />}
                    >
                      مادة غير مدرجة ضمن مسارك الدراسي
                    </Button>
                  ) : isFull ? (
                    <Button
                      variant="secondary"
                      size="lg"
                      fullWidth
                      loading={pendingSessionId === session.id}
                      onClick={() => handleBookSession(session)}
                      leftIcon={<Clock className="h-4 w-4" />}
                    >
                      انضمام لقائمة الانتظار
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="lg"
                      fullWidth
                      loading={pendingSessionId === session.id}
                      onClick={() => handleBookSession(session)}
                      leftIcon={<ShieldCheck className="h-4 w-4" />}
                    >
                      حجز مقعد
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Instant Booking Confirmation Modal */}
      <Dialog
        open={confirmModal !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmModal(null);
        }}
      >
        <DialogContent>
          {confirmModal && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
                      confirmModal.status === "confirmed"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300"
                    )}
                  >
                    {confirmModal.status === "confirmed" ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Clock className="h-5 w-5" />
                    )}
                  </span>
                  <div>
                    <DialogTitle>
                      {confirmModal.status === "confirmed"
                        ? "تم تأكيد حجز مقعدك"
                        : "تم تسجيلك في قائمة الانتظار"}
                    </DialogTitle>
                    <DialogDescription>{confirmModal.sessionTitleAr}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-3.5">
                <div>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {confirmModal.status === "confirmed" ? "رقم المقعد" : "الترتيب في الانتظار"}
                  </p>
                  <p className="mt-0.5 font-mono text-base font-bold text-[var(--text-primary)] tabular-nums">
                    {confirmModal.status === "confirmed"
                      ? confirmModal.seatNumber ?? "S-001"
                      : `#${formatArabicNumber(confirmModal.waitlistPosition ?? 1)}`}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[var(--text-muted)]">رقم المرجع</p>
                  <p
                    className="mt-0.5 font-mono text-xs font-bold text-[var(--text-primary)] tabular-nums"
                    dir="ltr"
                  >
                    {confirmModal.referenceCode}
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmModal(null)}>
                  إغلاق
                </Button>
                {confirmModal.status === "confirmed" ? (
                  <Link
                    href={`/s/${schoolSlug}/student/tickets/${confirmModal.bookingId}`}
                    className={buttonVariants({ variant: "primary", size: "md" })}
                  >
                    <QrCode className="h-4 w-4 shrink-0" />
                    <span>عرض تذكرة QR</span>
                  </Link>
                ) : (
                  <Link
                    href={`/s/${schoolSlug}/student/schedule`}
                    className={buttonVariants({ variant: "primary", size: "md" })}
                  >
                    <Ticket className="h-4 w-4 shrink-0" />
                    <span>متابعة جدولي</span>
                  </Link>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
