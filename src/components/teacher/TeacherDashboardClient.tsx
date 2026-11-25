"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertCircle,
  BookOpen,
  Building2,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  QrCode,
  ShieldAlert,
  Users,
  XCircle,
} from "lucide-react";
import {
  cancelSessionAction,
  type TeacherConsoleData,
} from "@/application/sessions/actions";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { SessionStatus } from "@/infrastructure/supabase/database.types";
import { SESSION_STATUS_TONES, type BadgeTone } from "@/lib/design-tokens";
import {
  formatArabicNumber,
  formatCairoDate,
  formatCairoTimeRange,
  SESSION_STATUS_LABELS,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";

const CANCEL_PRESET_REASONS = [
  "تعارض طارئ في الجدول المدرسي",
  "إعادة جدولة الحصة لموعد آخر",
  "أعمال صيانة طارئة بالقاعة",
] as const;

function resolveSessionMeta(status: string): {
  readonly label: string;
  readonly tone: BadgeTone;
} {
  if (status in SESSION_STATUS_LABELS) {
    const typed = status as SessionStatus;
    return {
      label: SESSION_STATUS_LABELS[typed].ar,
      tone: SESSION_STATUS_TONES[typed],
    };
  }
  return { label: status, tone: "neutral" };
}

export interface TeacherSubNavProps {
  readonly schoolSlug: string;
}

/**
 * Compact RTL workspace navigation tabs for Teacher Console sub-routes.
 */
export function TeacherSubNav({ schoolSlug }: TeacherSubNavProps) {
  const pathname = usePathname();
  const base = `/s/${schoolSlug}/teacher`;

  const tabs = [
    {
      href: base,
      label: "لوحة المعلم",
      icon: LayoutDashboard,
      active: pathname === base,
    },
    {
      href: `${base}/book-hall`,
      label: "حجز مدرج وجدولة",
      icon: CalendarPlus,
      active: pathname.startsWith(`${base}/book-hall`),
    },
    {
      href: `/s/${schoolSlug}/scanner`,
      label: "ماسح البوابة",
      icon: QrCode,
      active: false,
    },
  ] as const;

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-3">
      <nav
        className="flex max-w-full items-center gap-1.5 overflow-x-auto pb-0.5"
        aria-label="أقسام بوابة المعلم"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg border px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap",
                tab.active
                  ? "border-[#1E3A8A] bg-[#1E3A8A] text-white dark:border-blue-500 dark:bg-blue-600"
                  : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export interface TeacherAccessNoticeProps {
  readonly schoolSlug: string;
  readonly errorCode: string;
  readonly errorMessage: string;
}

/**
 * Clean RTL access notice rendered when the current session lacks approved teacher privileges.
 */
export function TeacherAccessNotice({
  schoolSlug,
  errorCode,
  errorMessage,
}: TeacherAccessNoticeProps) {
  const isPending = errorMessage.toLowerCase().includes("pending approval");
  const isUnauth = errorCode === "UNAUTHORIZED";

  const title = isUnauth
    ? "يتطلب تسجيل الدخول للوصول لبوابة المعلم"
    : isPending
      ? "حساب المعلم بانتظار اعتماد إدارة المدرسة"
      : "صلاحية معلم معتمد مطلوبة لهذه المدرسة";

  const description = isUnauth
    ? "قم بتسجيل الدخول بحساب معلم المادة أو استخدم الحساب التجريبي T-101 لاستعراض جدول القاعات."
    : isPending
      ? "تم تسجيل ملفك بنجاح، وبمجرد اعتمادك من منسق المدرسة ستتمكن من حجز المدرجات ومتابعة كشوف الحضور."
      : "هذا القسم مخصص لحسابات المعلمين المعتمدين المرتبطين بهذه المدرسة فقط.";

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]" dir="ltr">
              {errorCode}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/login"
            className={buttonVariants({ variant: "primary", size: "md", className: "min-h-[44px]" })}
          >
            تسجيل الدخول / تبديل الحساب
          </Link>
          <Link
            href={`/s/${schoolSlug}`}
            className={buttonVariants({ variant: "outline", size: "md", className: "min-h-[44px]" })}
          >
            العودة لبوابة المدرسة
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export interface TeacherDashboardClientProps {
  readonly schoolSlug: string;
  readonly data: TeacherConsoleData;
}

/**
 * Teacher Console overview: approval status, upcoming sessions, roster links, and cancellation dialog.
 */
export function TeacherDashboardClient({
  schoolSlug,
  data,
}: TeacherDashboardClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [scope, setScope] = React.useState<"own" | "school">("own");
  const [cancelTarget, setCancelTarget] = React.useState<
    TeacherConsoleData["sessions"][number] | null
  >(null);
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelError, setCancelError] = React.useState<string | null>(null);
  const [cancelling, setCancelling] = React.useState(false);

  const ownSessions = React.useMemo(
    () => data.sessions.filter((s) => s.isOwnSession),
    [data.sessions]
  );

  const visibleSessions = scope === "own" ? ownSessions : data.sessions;
  const totalSeatsCapacity = React.useMemo(
    () => data.halls.reduce((sum, hall) => sum + hall.maxCapacity, 0),
    [data.halls]
  );

  const handleOpenCancel = (session: TeacherConsoleData["sessions"][number]) => {
    setCancelTarget(session);
    setCancelReason("");
    setCancelError(null);
  };

  const handleConfirmCancel = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cancelTarget) return;

    const trimmed = cancelReason.trim();
    if (!trimmed) {
      setCancelError("يرجى كتابة سبب الإلغاء لإبلاغ الطلاب المسجلين.");
      return;
    }

    setCancelling(true);
    setCancelError(null);
    try {
      const result = await cancelSessionAction({
        schoolSlug,
        sessionId: cancelTarget.id,
        reason: trimmed,
      });

      if (!result.ok) {
        setCancelError(result.error.message);
        toast({
          title: "تعذر إلغاء الحصة",
          description: result.error.message,
          variant: "error",
        });
        return;
      }

      toast({
        title: "تم إلغاء الحصة بنجاح",
        description:
          result.data.notifiedCount > 0
            ? `تم إلغاء الحجوزات وإرسال إشعار إلى ${formatArabicNumber(result.data.notifiedCount)} طالب.`
            : "تم تحديث حالة الحصة وإتاحة المدرج.",
        variant: "success",
      });
      setCancelTarget(null);
      router.refresh();
    } catch {
      setCancelError("حدث خطأ غير متوقع أثناء إلغاء الحصة.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header Identity & Primary Booking CTA */}
      <Card>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={data.isApproved ? "success" : "warning"} dot>
                {data.isApproved ? "معلم معتمد" : "قيد الاعتماد"}
              </Badge>
              <Badge variant="mono" dir="ltr">
                {data.teacherCode}
              </Badge>
            </div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
              لوحة تحكم المعلم
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
              التخصص: <span className="font-semibold text-[var(--text-primary)]">{data.specialtyAr}</span>
              {" · "}
              <span className="tabular-nums">
                {formatArabicNumber(data.subjects.length)} مواد مصرح بتدريسها
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/s/${schoolSlug}/teacher/book-hall`}
              className={buttonVariants({
                variant: "primary",
                size: "md",
                className: "min-h-[44px]",
              })}
            >
              <CalendarPlus className="h-4 w-4 shrink-0" />
              <span>حجز مدرج لحصة جديدة</span>
            </Link>
          </div>
        </div>

        {data.subjects.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-4 py-3 sm:px-5">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
              <BookOpen className="h-3.5 w-3.5" />
              المواد المسندة:
            </span>
            {data.subjects.map((subj) => (
              <Badge key={subj.id} variant="primary" size="md">
                <span>{subj.nameAr}</span>
                <span className="font-mono text-[10px] opacity-80" dir="ltr">
                  {subj.code}
                </span>
              </Badge>
            ))}
          </div>
        )}
      </Card>

      {/* 3 Summary Telemetry Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">حالة الاعتماد</span>
            <CheckCircle2
              className={cn(
                "h-4 w-4",
                data.isApproved
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400"
              )}
            />
          </div>
          <p className="mt-2 text-lg font-bold text-[var(--text-primary)]">
            {data.isApproved ? "نشط ومعتمد" : "بانتظار الاعتماد"}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            كود المعلم:{" "}
            <span className="font-mono font-semibold text-[var(--text-secondary)]" dir="ltr">
              {data.teacherCode}
            </span>
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">حصصي القادمة</span>
            <Calendar className="h-4 w-4 text-[#1E3A8A] dark:text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(ownSessions.length)}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            خلال نافذة ١٤ يوماً القادمة
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">القاعات النشطة</span>
            <Building2 className="h-4 w-4 text-[var(--text-muted)]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(data.halls.length)}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)] tabular-nums">
            إجمالي السعة: {formatArabicNumber(totalSeatsCapacity)} مقعد
          </p>
        </Card>
      </div>

      {/* Upcoming Sessions Section */}
      <Card>
        <CardHeader className="border-b border-[var(--border-hairline)] pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">جدول الحصص القادمة</CardTitle>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                متابعة كشوف الطلاب الحاضرين أو إلغاء الحصة مع إخطار فوري للطلاب
              </p>
            </div>

            <div
              className="inline-flex rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-1"
              role="group"
              aria-label="نطاق الحصص"
            >
              <button
                type="button"
                onClick={() => setScope("own")}
                className={cn(
                  "min-h-[36px] rounded-md px-3 text-xs font-medium transition-colors cursor-pointer",
                  scope === "own"
                    ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                )}
              >
                حصصي ({formatArabicNumber(ownSessions.length)})
              </button>
              <button
                type="button"
                onClick={() => setScope("school")}
                className={cn(
                  "min-h-[36px] rounded-md px-3 text-xs font-medium transition-colors cursor-pointer",
                  scope === "school"
                    ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                )}
              >
                كل جدول المدرسة ({formatArabicNumber(data.sessions.length)})
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {visibleSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
              <Calendar className="h-8 w-8 text-[var(--text-muted)]" strokeWidth={1.5} />
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  لا توجد حصص مجدولة في هذا النطاق حالياً
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  يمكنك حجز مدرج لحصة مفردة أو سلسلة أسبوعية خلال ثوانٍ مع فحص التعارضات التلقائي.
                </p>
              </div>
              <Link
                href={`/s/${schoolSlug}/teacher/book-hall`}
                className={buttonVariants({ variant: "primary", size: "md", className: "min-h-[44px]" })}
              >
                <CalendarPlus className="h-4 w-4" />
                <span>الانتقال إلى مخطط حجز المدرجات</span>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-hairline)]">
              {visibleSessions.map((session) => {
                const statusMeta = resolveSessionMeta(session.status);
                const occupancyPct =
                  session.maxCapacity > 0
                    ? Math.min(
                        100,
                        Math.round((session.bookedSeatsCount / session.maxCapacity) * 100)
                      )
                    : 0;
                const canCancel =
                  session.isOwnSession &&
                  session.status !== "cancelled" &&
                  session.status !== "completed";

                return (
                  <div
                    key={session.id}
                    className="flex flex-col gap-3 p-4 transition-colors hover:bg-[var(--bg-sunken)]/50 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={statusMeta.tone} dot>
                          {statusMeta.label}
                        </Badge>
                        <Badge variant="mono" dir="ltr">
                          {session.hallCode}
                        </Badge>
                        <Badge variant="mono" dir="ltr">
                          {session.subjectCode}
                        </Badge>
                        <Badge variant="neutral" dir="ltr">
                          {session.teacherCode}
                        </Badge>
                      </div>

                      <h3 className="mt-2 text-sm sm:text-base font-bold text-[var(--text-primary)]">
                        {session.titleAr}
                      </h3>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                          <span>{formatCairoDate(session.startsAt, { includeWeekday: true })}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 tabular-nums">
                          <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                          <span>{formatCairoTimeRange(session.startsAt, session.endsAt)}</span>
                        </span>
                        <span className="text-[var(--text-muted)] tabular-nums">
                          فاصل +{formatArabicNumber(session.bufferMinutes)} د
                        </span>
                      </div>
                    </div>

                    {/* Occupancy Meter & Actions */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:shrink-0">
                      <div className="min-w-[140px] rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-3 py-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--text-muted)]">الإشغال</span>
                          <span className="font-mono font-semibold text-[var(--text-primary)] tabular-nums">
                            {formatArabicNumber(session.bookedSeatsCount)} /{" "}
                            {formatArabicNumber(session.maxCapacity)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                          <div
                            className={cn(
                              "h-full transition-all",
                              occupancyPct >= 95
                                ? "bg-red-500"
                                : occupancyPct >= 75
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                            )}
                            style={{ width: `${occupancyPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {session.isOwnSession && (
                          <Link
                            href={`/s/${schoolSlug}/teacher/sessions/${session.id}`}
                            className={buttonVariants({
                              variant: "outline",
                              size: "md",
                              className: "min-h-[44px]",
                            })}
                          >
                            <Users className="h-4 w-4" />
                            <span>كشف الطلاب</span>
                          </Link>
                        )}
                        <Link
                          href={`/s/${schoolSlug}/scanner`}
                          className={buttonVariants({
                            variant: "secondary",
                            size: "md",
                            className: "min-h-[44px]",
                          })}
                        >
                          <QrCode className="h-4 w-4" />
                          <span>التحضير</span>
                        </Link>
                        {canCancel && (
                          <Button
                            variant="danger"
                            size="md"
                            className="min-h-[44px]"
                            onClick={() => handleOpenCancel(session)}
                            leftIcon={<XCircle className="h-4 w-4" />}
                          >
                            إلغاء
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Session Dialog */}
      <Dialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open && !cancelling) {
            setCancelTarget(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد إلغاء الحصة</DialogTitle>
            <DialogDescription>
              {cancelTarget
                ? `سيتم إلغاء "${cancelTarget.titleAr}" وإلغاء كافة الحجوزات النشطة (${formatArabicNumber(cancelTarget.bookedSeatsCount)}) مع إرسال إشعار فوري للطلاب.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmCancel} className="mt-4 flex flex-col gap-3">
            {cancelError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{cancelError}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {CANCEL_PRESET_REASONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCancelReason(preset)}
                  className="min-h-[34px] rounded-md border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>

            <Input
              label="سبب الإلغاء (إلزامي)"
              required
              maxLength={500}
              placeholder="اكتب سبب الإلغاء الذي سيظهر في إشعار الطلاب..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={cancelling}
                className="min-h-[44px]"
                onClick={() => setCancelTarget(null)}
              >
                تراجع
              </Button>
              <Button
                type="submit"
                variant="danger"
                loading={cancelling}
                className="min-h-[44px]"
                leftIcon={<XCircle className="h-4 w-4" />}
              >
                تأكيد الإلغاء وإشعار الطلاب
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
