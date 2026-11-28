"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Laptop,
  MapPin,
  Sparkles,
  Users,
  Video,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  bookStudentSeatAction,
  cancelStudentBookingAction,
  markNotificationReadAction,
  type StudentPortalBooking,
  type StudentPortalData,
  type StudentPortalSession,
} from "@/application/bookings/actions";
import { TrackArtwork } from "@/components/brand/TrackIcon";
import { RadialGauge } from "@/components/charts/RadialGauge";
import {
  AnimatedFilterTabs,
  MotionReveal,
  MotionStaggerCard,
  MotionStaggerGrid,
  TACTILE_SPRING,
} from "@/components/motion/MotionPrimitives";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { calculateSessionRevenueBreakdown } from "@/domain/finance/revenue";
import type { UserRole } from "@/infrastructure/supabase/database.types";
import {
  formatArabicNumber,
  formatCairoDate,
  formatCairoTimeRange,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";

type StudentTab = "book" | "my-bookings";
type DeliveryFilter = "all" | "in_person" | "online";

export interface StudentPortalClientProps {
  readonly schoolSlug: string;
  readonly schoolNameAr: string;
  readonly initialData: StudentPortalData;
  readonly userRole?: UserRole | null;
  readonly trackCode?: string | null;
}

/**
 * Slide 8 Blueprint: Mobile-first Student Workspace with real Arabic name greeting,
 * instant green confirmation banner, scrollable subject filter, live SVG occupancy donuts,
 * dual in-person/online delivery badges, and transparent VAT pricing.
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

  const [portalData, setPortalData] = React.useState<StudentPortalData>(initialData);
  const [activeTab, setActiveTab] = React.useState<StudentTab>("book");
  const [selectedSubjectId, setSelectedSubjectId] = React.useState<string>("all");
  const [deliveryFilter, setDeliveryFilter] = React.useState<DeliveryFilter>("all");
  const [busySessionId, setBusySessionId] = React.useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<StudentPortalBooking | null>(null);
  const [cancelling, setCancelling] = React.useState(false);
  const [showNotifs, setShowNotifs] = React.useState(false);

  const isPrivilegedPreview =
    userRole === "school_admin" ||
    userRole === "super_admin" ||
    userRole === "teacher";

  const activeBookings = React.useMemo(
    () =>
      portalData.bookings.filter(
        (b) =>
          b.status === "confirmed" ||
          b.status === "waitlisted" ||
          b.status === "checked_in"
      ),
    [portalData.bookings]
  );

  const activeBookingBySessionId = React.useMemo(() => {
    const map = new Map<string, StudentPortalBooking>();
    for (const b of activeBookings) {
      map.set(b.sessionId, b);
    }
    return map;
  }, [activeBookings]);

  const eligibleSessions = React.useMemo(
    () => portalData.sessions.filter((s) => s.isEligible),
    [portalData.sessions]
  );

  const subjectsForFilter = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const s of eligibleSessions) {
      map.set(s.subjectId, s.subjectNameAr);
    }
    return Array.from(map.entries()).map(([id, nameAr]) => ({ id, nameAr }));
  }, [eligibleSessions]);

  const filteredSessions = React.useMemo(
    () =>
      eligibleSessions.filter((s) => {
        if (selectedSubjectId !== "all" && s.subjectId !== selectedSubjectId) {
          return false;
        }
        if (deliveryFilter !== "all" && s.deliveryMode !== deliveryFilter) {
          return false;
        }
        return true;
      }),
    [eligibleSessions, selectedSubjectId, deliveryFilter]
  );

  const unreadNotifsCount = portalData.notifications.filter((n) => !n.isRead).length;

  const handleBookSeat = async (session: StudentPortalSession) => {
    if (userRole && userRole !== "student") {
      toast({
        title: "وضع المعاينة",
        description: "الحجز متاح لحسابات الطلاب فقط — يمكنك تجربة حساب طالب من صفحة الدخول.",
        variant: "info",
      });
      return;
    }

    setBusySessionId(session.id);
    try {
      const res = await bookStudentSeatAction({
        sessionId: session.id,
        schoolSlug,
      });

      if (!res.ok) {
        toast({
          title: "تعذر إتمام الحجز",
          description: res.error.message,
          variant: "error",
        });
        return;
      }

      const bookingStatus = res.data.status;
      const newBooking: StudentPortalBooking = {
        id: res.data.bookingId,
        sessionId: session.id,
        status: bookingStatus,
        attendanceFlag: "on_time",
        lateMinutes: 0,
        deductionEgp: 0,
        seatNumber: res.data.seatNumber,
        waitlistPosition: res.data.waitlistPosition,
        bookedAt: new Date().toISOString(),
        sessionTitleAr: session.titleAr,
        sessionStartsAt: session.startsAt,
        sessionEndsAt: session.endsAt,
        deliveryMode: session.deliveryMode,
        meetingUrl: session.meetingUrl,
        priceEgp: session.priceEgp,
        hallNameAr: session.hallNameAr,
        subjectNameAr: session.subjectNameAr,
        teacherSpecialtyAr: session.teacherSpecialtyAr,
      };

      setPortalData((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) => {
          if (s.id !== session.id) return s;
          const nextCount =
            bookingStatus === "confirmed"
              ? Math.min(s.maxCapacity, s.bookedSeatsCount + 1)
              : s.bookedSeatsCount;
          return {
            ...s,
            bookedSeatsCount: nextCount,
            status: nextCount >= s.maxCapacity ? "full" : s.status,
          };
        }),
        bookings: [newBooking, ...prev.bookings],
      }));

      toast({
        title:
          bookingStatus === "confirmed"
            ? "تم تأكيد مقعدك ✓"
            : "تم إدراجك في قائمة الانتظار",
        description: `${session.subjectNameAr} — ${session.hallNameAr}`,
        variant: bookingStatus === "confirmed" ? "success" : "warning",
      });
      router.refresh();
    } finally {
      setBusySessionId(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const res = await cancelStudentBookingAction({
        bookingId: cancelTarget.id,
        schoolSlug,
      });

      if (!res.ok) {
        toast({
          title: "تعذر إلغاء الحجز",
          description: res.error.message,
          variant: "error",
        });
        return;
      }

      setPortalData((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) =>
          b.id === cancelTarget.id
            ? { ...b, status: "cancelled_by_student" }
            : b
        ),
        sessions: prev.sessions.map((s) =>
          s.id === cancelTarget.sessionId && cancelTarget.status === "confirmed"
            ? {
                ...s,
                bookedSeatsCount: Math.max(0, s.bookedSeatsCount - 1),
                status: s.status === "full" ? "scheduled" : s.status,
              }
            : s
        ),
      }));

      toast({ title: "تم إلغاء حجزك", variant: "info" });
      setCancelTarget(null);
      router.refresh();
    } finally {
      setCancelling(false);
    }
  };

  const handleMarkNotifRead = async (notificationId: string) => {
    setPortalData((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.id === notificationId ? { ...n, isRead: true } : n
      ),
    }));
    await markNotificationReadAction(notificationId);
  };

  if (!portalData.enrollment && !isPrivilegedPreview) {
    return (
      <MotionReveal>
        <Card className="mx-auto max-w-lg rounded-3xl p-8 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-[#2563EB] dark:text-cyan-400" />
          <h1 className="mt-3 text-xl font-extrabold text-[var(--text-primary)]">
            أكمل اختيار صفك ومسارك أولاً
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            حدد مدرستك وصفك الدراسي لتظهر لك الحصص المناسبة مباشرةً.
          </p>
          <div className="mt-5">
            <Link
              href="/onboarding"
              className={buttonVariants({ variant: "primary", size: "lg" })}
            >
              تحديد المسار الدراسي
            </Link>
          </div>
        </Card>
      </MotionReveal>
    );
  }

  const latestConfirmed = activeBookings.find((b) => b.status === "confirmed");

  return (
    <div className="flex flex-col gap-5">
      {/* Slide 8 Top Greeting Header */}
      <MotionReveal className="rounded-[2rem] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 hairline-lift">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <TrackArtwork trackCode={trackCode} size="md" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="primary" size="sm">
                  {portalData.enrollment
                    ? `${portalData.enrollment.gradeNameAr} · ${portalData.enrollment.trackNameAr}`
                    : `${schoolNameAr} · معاينة`}
                </Badge>
                {portalData.notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowNotifs((v) => !v)}
                    className="inline-flex min-h-[30px] items-center gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <Bell className="h-3.5 w-3.5 text-[#2563EB] dark:text-cyan-300" />
                    <span className="tabular-nums">
                      {unreadNotifsCount > 0
                        ? `${formatArabicNumber(unreadNotifsCount)} إشعار جديد`
                        : "الإشعارات"}
                    </span>
                  </button>
                )}
              </div>

              <h1 className="mt-1.5 text-xl font-extrabold text-[var(--text-primary)] sm:text-2xl">
                أهلاً، {portalData.studentName}
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                احجز حصتك بالاسم داخل المدرج أو أونلاين بضغطة واحدة
              </p>
            </div>
          </div>

          <Link
            href={`/s/${schoolSlug}/lectures`}
            className={buttonVariants({
              variant: "outline",
              size: "md",
              className: "shrink-0",
            })}
          >
            <Video className="h-4 w-4 text-[#2563EB] dark:text-cyan-300" />
            <span>المحاضرات المسجلة</span>
          </Link>
        </div>

        {/* Collapsible Notifications Drawer */}
        <AnimatePresence initial={false}>
          {showNotifs && portalData.notifications.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 overflow-hidden border-t border-[var(--border-hairline)] pt-3"
            >
              <div className="flex flex-col gap-2">
                {portalData.notifications.slice(0, 4).map((notif) => (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => handleMarkNotifRead(notif.id)}
                    className={cn(
                      "flex items-start justify-between gap-2 rounded-xl border px-3 py-2 text-start text-xs transition-colors cursor-pointer",
                      notif.isRead
                        ? "border-[var(--border-hairline)] bg-[var(--bg-sunken)] text-[var(--text-muted)]"
                        : "border-[#2563EB]/30 bg-blue-50/70 text-[var(--text-primary)] dark:bg-blue-500/15"
                    )}
                  >
                    <div>
                      <p className="font-bold">{notif.titleAr}</p>
                      <p className="mt-0.5 text-[var(--text-secondary)]">{notif.bodyAr}</p>
                    </div>
                    {!notif.isRead && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#2563EB]" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </MotionReveal>

      {/* Slide 8 Instant Green Confirmation Banner */}
      {latestConfirmed && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50/90 px-4 py-3.5 text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-100"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#16A34A] text-white shadow-xs">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold">
                تم تأكيد مقعدك ✓ — {latestConfirmed.subjectNameAr}
              </p>
              <p className="mt-0.5 truncate text-xs text-emerald-800 dark:text-emerald-200">
                {latestConfirmed.sessionTitleAr} · {latestConfirmed.hallNameAr} ·{" "}
                {formatCairoTimeRange(
                  latestConfirmed.sessionStartsAt,
                  latestConfirmed.sessionEndsAt
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {latestConfirmed.deliveryMode === "online" && latestConfirmed.meetingUrl && (
              <a
                href={latestConfirmed.meetingUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "primary", size: "sm" })}
              >
                <Laptop className="h-4 w-4" />
                <span>دخول البث</span>
              </a>
            )}
            <Button
              variant="outline"
              size="sm"
              className="border-emerald-300 bg-white/80 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100"
              onClick={() => setActiveTab("my-bookings")}
            >
              حجوزاتي ({formatArabicNumber(activeBookings.length)})
            </Button>
          </div>
        </motion.div>
      )}

      {/* Primary Section Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex max-w-full overflow-x-auto no-scrollbar rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab("book")}
            className={cn(
              "relative min-h-[44px] rounded-xl px-4 text-sm font-bold transition-colors cursor-pointer",
              activeTab === "book"
                ? "text-white"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            {activeTab === "book" && (
              <motion.span
                layoutId="student-main-tab-pill"
                transition={TACTILE_SPRING}
                className="absolute inset-0 rounded-xl bg-[#0A1F44] dark:bg-blue-600"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              <span>الحصص المتاحة ({formatArabicNumber(eligibleSessions.length)})</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("my-bookings")}
            className={cn(
              "relative min-h-[44px] rounded-xl px-4 text-sm font-bold transition-colors cursor-pointer",
              activeTab === "my-bookings"
                ? "text-white"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            {activeTab === "my-bookings" && (
              <motion.span
                layoutId="student-main-tab-pill"
                transition={TACTILE_SPRING}
                className="absolute inset-0 rounded-xl bg-[#0A1F44] dark:bg-blue-600"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              <CalendarCheck className="h-4 w-4" />
              <span>جدولي ({formatArabicNumber(activeBookings.length)})</span>
            </span>
          </button>
        </div>

        {activeTab === "book" && (
          <div className="inline-flex rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-1 text-xs">
            {(
              [
                { id: "all", label: "الكل" },
                { id: "in_person", label: "في المدرسة" },
                { id: "online", label: "أونلاين" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDeliveryFilter(opt.id)}
                className={cn(
                  "min-h-[36px] rounded-lg px-3 font-bold transition-colors cursor-pointer",
                  deliveryFilter === opt.id
                    ? "bg-[#2563EB] text-white"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeTab === "book" ? (
        <div className="flex flex-col gap-4">
          {subjectsForFilter.length > 1 && (
            <AnimatedFilterTabs
              layoutId="student-subject-filter"
              ariaLabel="تصفية الحصص حسب المادة"
              value={selectedSubjectId}
              onChange={setSelectedSubjectId}
              options={[
                { id: "all", label: "كل المواد" },
                ...subjectsForFilter.map((s) => ({ id: s.id, label: s.nameAr })),
              ]}
            />
          )}

          {filteredSessions.length === 0 ? (
            <Card className="rounded-3xl p-10 text-center">
              <Users className="mx-auto h-10 w-10 text-[var(--text-muted)]" />
              <h2 className="mt-3 text-lg font-bold text-[var(--text-primary)]">
                لا توجد حصص متاحة في هذا التصنيف حالياً
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                جرّب اختيار «الكل» أو تصفح المحاضرات المسجلة للمدرسة.
              </p>
            </Card>
          ) : (
            <MotionStaggerGrid className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredSessions.map((session) => {
                const existingBooking = activeBookingBySessionId.get(session.id);
                const isFull =
                  session.bookedSeatsCount >= session.maxCapacity ||
                  session.status === "full";
                const isOnline = session.deliveryMode === "online";
                const priceInfo =
                  session.priceEgp > 0
                    ? calculateSessionRevenueBreakdown({
                        priceEgp: session.priceEgp,
                        seatCount: 1,
                        vatRatePct: portalData.vatRatePct,
                      })
                    : null;

                return (
                  <MotionStaggerCard key={session.id}>
                    <Card
                      variant="interactive"
                      className={cn(
                        "flex h-full flex-col justify-between gap-4 p-5",
                        existingBooking?.status === "confirmed" &&
                          "border-emerald-300 dark:border-emerald-500/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="primary" size="sm">
                              {session.subjectNameAr}
                            </Badge>
                            <Badge
                              variant={isOnline ? "info" : "neutral"}
                              size="sm"
                            >
                              {isOnline ? (
                                <span className="inline-flex items-center gap-1">
                                  <Laptop className="h-3 w-3" /> أونلاين
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="h-3 w-3" /> {session.hallNameAr}
                                </span>
                              )}
                            </Badge>
                            {priceInfo ? (
                              <Badge variant="warning" size="sm">
                                <Wallet className="h-3 w-3" />
                                <span className="tabular-nums">
                                  {formatArabicNumber(priceInfo.studentPayablePerSeatEgp)} ج.م
                                </span>
                              </Badge>
                            ) : (
                              <Badge variant="success" size="sm">
                                مجانية
                              </Badge>
                            )}
                          </div>

                          <h2 className="mt-2.5 text-lg font-extrabold text-[var(--text-primary)] leading-snug">
                            {session.titleAr}
                          </h2>
                          <p className="mt-0.5 text-xs font-semibold text-[var(--text-secondary)]">
                            {session.teacherSpecialtyAr}
                          </p>
                        </div>

                        {/* Live Radial Seat Occupancy Ring (Slide 8: 5/40, 38/40) */}
                        <RadialGauge
                          value={session.bookedSeatsCount}
                          max={session.maxCapacity}
                          size={60}
                          strokeWidth={5}
                          mode="ratio"
                          tone={isOnline ? "cyan" : "auto"}
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-3.5 py-2.5 text-xs text-[var(--text-secondary)] tabular-nums">
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          <Clock className="h-3.5 w-3.5 text-[#2563EB] dark:text-cyan-300" />
                          {formatCairoDate(session.startsAt)}
                        </span>
                        <span className="font-bold text-[var(--text-primary)]">
                          {formatCairoTimeRange(session.startsAt, session.endsAt)}
                        </span>
                      </div>

                      <div className="flex flex-col gap-2">
                        {existingBooking ? (
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                "inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold",
                                existingBooking.status === "waitlisted"
                                  ? "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200"
                                  : "bg-emerald-600 text-white"
                              )}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              <span>
                                {existingBooking.status === "waitlisted"
                                  ? `قائمة الانتظار (#${formatArabicNumber(existingBooking.waitlistPosition ?? 1)})`
                                  : "مقعدك مؤكد ✓"}
                              </span>
                            </span>

                            {existingBooking.deliveryMode === "online" &&
                              existingBooking.meetingUrl && (
                                <a
                                  href={existingBooking.meetingUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={buttonVariants({
                                    variant: "primary",
                                    size: "md",
                                  })}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  <span>دخول البث</span>
                                </a>
                              )}
                          </div>
                        ) : (
                          <Button
                            variant={isFull ? "secondary" : "primary"}
                            size="lg"
                            fullWidth
                            loading={busySessionId === session.id}
                            onClick={() => handleBookSeat(session)}
                          >
                            {isFull ? "انضمام لقائمة الانتظار" : "احجز مقعدك"}
                          </Button>
                        )}
                      </div>
                    </Card>
                  </MotionStaggerCard>
                );
              })}
            </MotionStaggerGrid>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {activeBookings.length === 0 ? (
            <Card className="rounded-3xl p-10 text-center">
              <CalendarCheck className="mx-auto h-10 w-10 text-[var(--text-muted)]" />
              <h2 className="mt-3 text-lg font-bold text-[var(--text-primary)]">
                لم تحجز أي حصة بعد
              </h2>
              <div className="mt-4">
                <Button
                  variant="primary"
                  onClick={() => setActiveTab("book")}
                >
                  استعرض الحصص المتاحة
                </Button>
              </div>
            </Card>
          ) : (
            activeBookings.map((booking) => (
              <Card key={booking.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          booking.status === "checked_in" || booking.status === "confirmed"
                            ? "success"
                            : "warning"
                        }
                        dot
                      >
                        {booking.status === "checked_in"
                          ? "تم الحضور ✓"
                          : booking.status === "confirmed"
                            ? "حجز مؤكد ✓"
                            : `انتظار #${formatArabicNumber(booking.waitlistPosition ?? 1)}`}
                      </Badge>
                      <Badge variant="primary">{booking.subjectNameAr}</Badge>
                      {booking.seatNumber && (
                        <Badge variant="mono" dir="ltr">
                          {booking.seatNumber}
                        </Badge>
                      )}
                      {booking.deductionEgp > 0 && (
                        <Badge variant="danger">
                          خصم تأخير/التزام: {formatArabicNumber(booking.deductionEgp)} ج.م
                        </Badge>
                      )}
                    </div>

                    <h3 className="mt-2 text-base font-extrabold text-[var(--text-primary)]">
                      {booking.sessionTitleAr}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--text-secondary)] tabular-nums">
                      {booking.hallNameAr} · {formatCairoDate(booking.sessionStartsAt)} ·{" "}
                      {formatCairoTimeRange(
                        booking.sessionStartsAt,
                        booking.sessionEndsAt
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {booking.deliveryMode === "online" && booking.meetingUrl && (
                      <a
                        href={booking.meetingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonVariants({ variant: "primary", size: "sm" })}
                      >
                        <Laptop className="h-4 w-4" />
                        <span>فتح البث الأونلاين</span>
                      </a>
                    )}
                    {booking.status !== "checked_in" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCancelTarget(booking)}
                        leftIcon={<XCircle className="h-4 w-4 text-red-500" />}
                      >
                        إلغاء الحجز
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Cancel Booking Confirmation Dialog */}
      <Dialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد إلغاء الحجز</DialogTitle>
            <DialogDescription>
              هل تريد إلغاء مقعدك في «{cancelTarget?.sessionTitleAr}»؟ سيتم ترقية أول طالب
              في قائمة الانتظار تلقائياً.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelTarget(null)}
              disabled={cancelling}
            >
              تراجع
            </Button>
            <Button
              variant="danger"
              loading={cancelling}
              onClick={handleConfirmCancel}
            >
              نعم، إلغاء الحجز
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
