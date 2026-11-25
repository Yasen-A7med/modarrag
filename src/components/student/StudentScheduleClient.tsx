"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  History,
  QrCode,
  Ticket,
  Trash2,
} from "lucide-react";
import {
  cancelStudentBookingAction,
  type StudentPortalData,
} from "@/application/bookings/actions";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import type { BookingStatus, UserRole } from "@/infrastructure/supabase/database.types";
import { BOOKING_STATUS_TONES } from "@/lib/design-tokens";
import {
  BOOKING_STATUS_LABELS,
  formatArabicNumber,
  formatCairoDate,
  formatCairoTime,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { StudentSubNav } from "./StudentSubNav";

export interface StudentScheduleClientProps {
  readonly schoolSlug: string;
  readonly initialBookings: StudentPortalData["bookings"];
  readonly hasEnrollment: boolean;
  readonly userRole: UserRole | null;
}

type ScheduleTab = "confirmed" | "waitlisted" | "history";

function getBookingStatusMeta(status: string) {
  if (status in BOOKING_STATUS_LABELS) {
    const key = status as BookingStatus;
    return {
      labelAr: BOOKING_STATUS_LABELS[key].ar,
      tone: BOOKING_STATUS_TONES[key],
    };
  }
  return { labelAr: status, tone: "neutral" as const };
}

/**
 * Grouped student bookings & passes manager:
 * - Tabs: الحصص المؤكدة / قائمة الانتظار / الإلغاء والسجل
 * - Instant cancellation confirmation dialog with automatic waitlist promotion feedback
 */
export function StudentScheduleClient({
  schoolSlug,
  initialBookings,
  hasEnrollment,
  userRole,
}: StudentScheduleClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [cancelledRecords, setCancelledRecords] = React.useState<
    StudentPortalData["bookings"]
  >([]);
  const bookings = React.useMemo(() => {
    const cancelledById = new Map(cancelledRecords.map((c) => [c.id, c]));
    const serverIds = new Set(initialBookings.map((b) => b.id));
    const merged = initialBookings.map((item) =>
      cancelledById.has(item.id)
        ? { ...item, status: "cancelled_by_student", qrToken: null }
        : item
    );
    const localOnly = cancelledRecords.filter((c) => !serverIds.has(c.id));
    return [...localOnly, ...merged];
  }, [initialBookings, cancelledRecords]);

  const [activeTab, setActiveTab] = React.useState<ScheduleTab>("confirmed");
  const [cancelTarget, setCancelTarget] = React.useState<
    StudentPortalData["bookings"][number] | null
  >(null);
  const [cancelling, setCancelling] = React.useState(false);

  const confirmedBookings = React.useMemo(
    () => bookings.filter((b) => b.status === "confirmed"),
    [bookings]
  );

  const waitlistedBookings = React.useMemo(
    () => bookings.filter((b) => b.status === "waitlisted"),
    [bookings]
  );

  const historyBookings = React.useMemo(
    () =>
      bookings.filter(
        (b) =>
          b.status === "checked_in" ||
          b.status === "cancelled_by_student" ||
          b.status === "cancelled_by_system" ||
          b.status === "no_show"
      ),
    [bookings]
  );

  const activeBookingsCount = confirmedBookings.length + waitlistedBookings.length;

  const visibleList =
    activeTab === "confirmed"
      ? confirmedBookings
      : activeTab === "waitlisted"
        ? waitlistedBookings
        : historyBookings;

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

      const cancelledEntry: StudentPortalData["bookings"][number] = {
        ...cancelTarget,
        status: "cancelled_by_student",
        qrToken: null,
      };
      setCancelledRecords((prev) => [
        cancelledEntry,
        ...prev.filter((item) => item.id !== cancelTarget.id),
      ]);

      toast({
        title: "تم إلغاء الحجز بنجاح",
        description: result.data.promotedBookingId
          ? "تمت ترقية الطالب التالي في قائمة الانتظار تلقائياً."
          : cancelTarget.sessionTitleAr,
        variant: "success",
      });

      setCancelTarget(null);
      router.refresh();
    } catch {
      toast({
        title: "خطأ في الاتصال",
        description: "يرجى المحاولة مرة أخرى.",
        variant: "error",
      });
    } finally {
      setCancelling(false);
    }
  };

  const tabItems: readonly {
    readonly key: ScheduleTab;
    readonly label: string;
    readonly count: number;
    readonly icon: React.ComponentType<{ readonly className?: string }>;
  }[] = [
    {
      key: "confirmed",
      label: "الحصص المؤكدة",
      count: confirmedBookings.length,
      icon: CheckCircle2,
    },
    {
      key: "waitlisted",
      label: "قائمة الانتظار",
      count: waitlistedBookings.length,
      icon: Clock,
    },
    {
      key: "history",
      label: "الإلغاء والسجل",
      count: historyBookings.length,
      icon: History,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <StudentSubNav
        schoolSlug={schoolSlug}
        activeTab="schedule"
        activeBookingsCount={activeBookingsCount}
      />

      {!hasEnrollment && (!userRole || userRole === "student") && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/75 p-4 text-slate-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-slate-100">
          <p className="text-xs sm:text-sm font-medium">
            قم باستكمال اختيار المسار الدراسي لعرض الحصص المؤهلة وحجز مقعدك الأول.
          </p>
          <Link
            href="/onboarding"
            className={buttonVariants({ variant: "primary", size: "md", className: "min-h-[44px]" })}
          >
            تحديد المسار
          </Link>
        </div>
      )}

      {/* Grouped Schedule Tabs */}
      <div
        className="grid grid-cols-1 gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-1.5 hairline-lift sm:grid-cols-3"
        role="tablist"
        aria-label="تصنيف الحجوزات"
      >
        {tabItems.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex min-h-[44px] items-center justify-between gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer",
                isActive
                  ? "bg-[#1E3A8A] text-white dark:bg-blue-600"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-sunken)] hover:text-[var(--text-primary)]"
              )}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </span>
              <Badge
                variant={isActive ? "mono" : "neutral"}
                size="sm"
                className={isActive ? "border-white/25 bg-white/15 text-white" : ""}
              >
                {formatArabicNumber(tab.count)}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Bookings List */}
      {visibleList.length === 0 ? (
        <Card variant="sunken" className="p-8 text-center">
          <Ticket className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
          <p className="mt-3 text-sm font-bold text-[var(--text-primary)]">
            {activeTab === "confirmed"
              ? "لا توجد حجوزات مؤكدة حالياً"
              : activeTab === "waitlisted"
                ? "لا توجد حجوزات في قائمة الانتظار"
                : "لا توجد سجلات حضور أو إلغاء مسجلة بعد"}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            يمكنك استعراض الحصص المتاحة وحجز مقعدك من بوابة الحصص.
          </p>
          <div className="mt-4">
            <Link
              href={`/s/${schoolSlug}/student`}
              className={buttonVariants({ variant: "primary", size: "md" })}
            >
              استعراض الحصص المتاحة
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visibleList.map((booking) => {
            const statusMeta = getBookingStatusMeta(booking.status);
            const canViewTicket =
              booking.status === "confirmed" || booking.status === "checked_in";
            const canCancel =
              booking.status === "confirmed" || booking.status === "waitlisted";

            return (
              <Card key={booking.id} className="flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant={statusMeta.tone} size="sm" dot>
                      {statusMeta.labelAr}
                    </Badge>
                    <Badge variant="mono" dir="ltr">
                      {booking.referenceCode}
                    </Badge>
                  </div>
                  <CardTitle className="mt-2 text-base">
                    {booking.sessionTitleAr || "حصة مجدولة"}
                  </CardTitle>
                </CardHeader>

                <CardContent className="flex flex-col gap-2.5 text-xs text-[var(--text-secondary)]">
                  {booking.sessionStartsAt && (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        {formatCairoDate(booking.sessionStartsAt, {
                          includeWeekday: true,
                        })}
                      </span>
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        {formatCairoTime(booking.sessionStartsAt)}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-2.5">
                    {booking.status === "waitlisted" ? (
                      <span className="font-medium text-amber-800 dark:text-amber-300 tabular-nums">
                        الترتيب في قائمة الانتظار: #
                        {formatArabicNumber(booking.waitlistPosition ?? 1)}
                      </span>
                    ) : (
                      <span>
                        رقم المقعد:{" "}
                        <strong
                          className="font-mono text-sm text-[var(--text-primary)] tabular-nums"
                          dir="ltr"
                        >
                          {booking.seatNumber ?? "—"}
                        </strong>
                      </span>
                    )}

                    <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                      تاريخ الحجز: {formatCairoDate(booking.bookedAt)}
                    </span>
                  </div>
                </CardContent>

                <CardFooter className="flex-wrap">
                  {canViewTicket && (
                    <Link
                      href={`/s/${schoolSlug}/student/tickets/${booking.id}`}
                      className={buttonVariants({
                        variant: "primary",
                        size: "md",
                        className: "flex-1 min-h-[44px]",
                      })}
                    >
                      <QrCode className="h-4 w-4 shrink-0" />
                      <span>عرض تذكرة QR</span>
                    </Link>
                  )}

                  {canCancel && (
                    <Button
                      variant="outline"
                      size="md"
                      className="min-h-[44px] border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10"
                      onClick={() => setCancelTarget(booking)}
                      leftIcon={<Trash2 className="h-4 w-4" />}
                    >
                      {booking.status === "waitlisted"
                        ? "مغادرة الانتظار"
                        : "إلغاء الحجز"}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Cancellation Confirmation Dialog */}
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
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-400">
                    <AlertTriangle className="h-5 w-5" />
                  </span>
                  <div>
                    <DialogTitle>تأكيد إلغاء الحجز</DialogTitle>
                    <DialogDescription>{cancelTarget.sessionTitleAr}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="mt-4 flex flex-col gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-3.5 text-xs text-[var(--text-secondary)]">
                <p>
                  رقم المرجع:{" "}
                  <span className="font-mono font-semibold text-[var(--text-primary)]" dir="ltr">
                    {cancelTarget.referenceCode}
                  </span>
                </p>
                <p className="leading-relaxed">
                  عند الإلغاء، يتم إبطال رمز QR فوراً وترقية أول طالب في قائمة الانتظار تلقائياً. الحد الأقصى للإلغاء اليومي هو ٣ مرات فقط.
                </p>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={cancelling}
                  onClick={() => setCancelTarget(null)}
                >
                  تراجع
                </Button>
                <Button
                  variant="danger"
                  loading={cancelling}
                  onClick={handleConfirmCancel}
                >
                  تأكيد الإلغاء
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
