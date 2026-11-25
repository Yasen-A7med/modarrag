"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Building2,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  Clock,
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
  "ظرف طارئ للمعلم",
  "إعادة جدولة الحصة لموعد آخر",
  "صيانة في القاعة",
] as const;

function resolveSessionMeta(status: string): {
  readonly label: string;
  readonly tone: BadgeTone;
} {
  if (status === "scheduled") {
    return { label: "حصة مجدولة", tone: "success" };
  }
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
 * Simple 2-button Teacher Workspace switcher (My Classes & Attendance | Book Hall).
 */
export function TeacherSubNav({ schoolSlug }: TeacherSubNavProps) {
  const pathname = usePathname();
  const base = `/s/${schoolSlug}/teacher`;

  const tabs = [
    {
      href: base,
      label: "حصصي وكشوف الحضور",
      icon: ClipboardCheck,
      active: pathname === base || pathname.startsWith(`${base}/sessions/`),
    },
    {
      href: `${base}/book-hall`,
      label: "حجز قاعة لحصة جديدة",
      icon: CalendarPlus,
      active: pathname.startsWith(`${base}/book-hall`),
    },
  ] as const;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
      <nav
        className="flex max-w-full items-center gap-2 overflow-x-auto pb-0.5"
        aria-label="أقسام بوابة المعلم"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "inline-flex min-h-[46px] shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-bold transition-colors whitespace-nowrap",
                tab.active
                  ? "border-[#0B63CE] bg-[#0B63CE] text-white dark:border-blue-500 dark:bg-blue-600"
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
 * Welcoming Arabic access notice for unauthenticated or pending teacher accounts.
 */
export function TeacherAccessNotice({
  schoolSlug,
  errorCode,
  errorMessage,
}: TeacherAccessNoticeProps) {
  const isPending = errorMessage.toLowerCase().includes("pending approval");
  const isUnauth = errorCode === "UNAUTHORIZED";

  const title = isUnauth
    ? "سجّل دخولك لفتح بوابة المعلم"
    : isPending
      ? "حسابك بانتظار اعتماد إدارة المدرسة"
      : "هذه الصفحة خاصة بمعلمي المدرسة";

  const description = isUnauth
    ? "ادخل بحساب المعلم لاستعراض حصصك، فتح كشف الأسماء، وتسجيل حضور الطلاب بضغطة واحدة."
    : isPending
      ? "بمجرد اعتماد حسابك من إدارة المدرسة ستتمكن من حجز القاعات وفتح كشوف الحضور."
      : errorMessage;

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <CardTitle className="text-xl">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-base text-[var(--text-secondary)] leading-relaxed">{description}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/login"
            className={buttonVariants({ variant: "emerald", size: "lg" })}
          >
            تسجيل الدخول
          </Link>
          <Link
            href={`/s/${schoolSlug}`}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            العودة لصفحة المدرسة
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
 * Simple Teacher Dashboard focused on opening the name-based attendance checklist in 1 tap.
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
        title: "تم إلغاء الحصة",
        description: "تم تحديث الجدول وإشعار الطلاب المسجلين.",
        variant: "info",
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
      {/* Header Summary Card */}
      <Card>
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge variant={data.isApproved ? "success" : "warning"} size="md" dot>
                {data.isApproved ? "معلم معتمد بالمدرسة" : "بانتظار اعتماد الإدارة"}
              </Badge>
            </div>
            <h1 className="mt-2.5 text-2xl font-bold text-[var(--text-primary)]">
              {data.specialtyAr}
            </h1>
            <p className="mt-1 text-base text-[var(--text-secondary)]">
              افتح كشف الحضور لأي حصة لتسجيل أسماء الطلاب الحاضرين بضغطة واحدة
            </p>
          </div>

          <Link
            href={`/s/${schoolSlug}/teacher/book-hall`}
            className={buttonVariants({
              variant: "emerald",
              size: "lg",
              className: !data.isApproved ? "pointer-events-none opacity-50" : "",
            })}
          >
            <CalendarPlus className="h-5 w-5" />
            <span>حجز قاعة لحصة جديدة</span>
          </Link>
        </div>
      </Card>

      {/* Simple Summary Numbers */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 hairline-lift">
          <div className="flex items-center justify-between text-sm font-medium text-[var(--text-muted)]">
            <span>حصصك الحالية والقادمة</span>
            <Calendar className="h-5 w-5 text-[#0B63CE]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(ownSessions.length)}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 hairline-lift">
          <div className="flex items-center justify-between text-sm font-medium text-[var(--text-muted)]">
            <span>المواد المسجلة لك</span>
            <BookOpen className="h-5 w-5 text-[#16A34A]" />
          </div>
          <p className="mt-2 text-base font-bold text-[var(--text-primary)]">
            {data.subjects.map((s) => s.nameAr).join("، ") || "غير محددة بعد"}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 hairline-lift">
          <div className="flex items-center justify-between text-sm font-medium text-[var(--text-muted)]">
            <span>القاعات المتاحة بالمدرسة</span>
            <Building2 className="h-5 w-5 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(data.halls.length)}
          </p>
        </div>
      </div>

      {/* Sessions List + Filter Toggle */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            جدول الحصص وكشوف الحضور
          </h2>

          <div
            className="inline-flex rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-1"
            role="group"
            aria-label="نطاق العرض"
          >
            <button
              type="button"
              onClick={() => setScope("own")}
              className={cn(
                "min-h-[42px] rounded-lg px-4 text-sm font-bold transition-colors cursor-pointer",
                scope === "own"
                  ? "bg-[var(--bg-surface)] text-[#0B63CE] shadow-xs dark:text-blue-300"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              حصصي ({formatArabicNumber(ownSessions.length)})
            </button>
            <button
              type="button"
              onClick={() => setScope("school")}
              className={cn(
                "min-h-[42px] rounded-lg px-4 text-sm font-bold transition-colors cursor-pointer",
                scope === "school"
                  ? "bg-[var(--bg-surface)] text-[#0B63CE] shadow-xs dark:text-blue-300"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              جدول المدرسة ({formatArabicNumber(data.sessions.length)})
            </button>
          </div>
        </div>

        {visibleSessions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-[var(--text-muted)]" />
              <div className="max-w-md">
                <p className="text-lg font-bold text-[var(--text-primary)]">
                  لا توجد حصص مجدولة حالياً
                </p>
                <p className="mt-1 text-base text-[var(--text-secondary)]">
                  احجز قاعة لإضافة حصة جديدة وسيظهر كشف الأسماء هنا تلقائياً.
                </p>
              </div>
              {data.isApproved && (
                <Link
                  href={`/s/${schoolSlug}/teacher/book-hall`}
                  className={buttonVariants({ variant: "emerald", size: "lg" })}
                >
                  <CalendarPlus className="h-5 w-5" />
                  <span>حجز قاعة لحصة جديدة</span>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {visibleSessions.map((session) => {
              const meta = resolveSessionMeta(session.status);
              const canCancel =
                session.isOwnSession &&
                (session.status === "scheduled" || session.status === "full");

              return (
                <Card key={session.id}>
                  <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={meta.tone} size="md" dot>
                          {meta.label}
                        </Badge>
                        {session.subjectNameAr && (
                          <Badge variant="primary" size="md">
                            {session.subjectNameAr}
                          </Badge>
                        )}
                        <Badge variant="neutral" size="md">
                          {session.hallNameAr || session.hallCode}
                        </Badge>
                      </div>

                      <h3 className="mt-2.5 text-lg font-bold text-[var(--text-primary)]">
                        {session.titleAr}
                      </h3>

                      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-[var(--text-secondary)]">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-[var(--text-muted)]" />
                          <span>
                            {formatCairoDate(session.startsAt, { includeWeekday: true })}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 tabular-nums">
                          <Clock className="h-4 w-4 text-[var(--text-muted)]" />
                          <span>{formatCairoTimeRange(session.startsAt, session.endsAt)}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--text-primary)] tabular-nums">
                          <Users className="h-4 w-4 text-[#16A34A]" />
                          <span>
                            حضر {formatArabicNumber(session.checkedInCount)} · مسجل{" "}
                            {formatArabicNumber(session.bookedSeatsCount)} من{" "}
                            {formatArabicNumber(session.maxCapacity)}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center lg:shrink-0">
                      {session.isOwnSession && (
                        <Link
                          href={`/s/${schoolSlug}/teacher/sessions/${session.id}`}
                          className={buttonVariants({
                            variant: "emerald",
                            size: "lg",
                          })}
                        >
                          <ClipboardCheck className="h-5 w-5" />
                          <span>فتح كشف الحضور بالاسم</span>
                        </Link>
                      )}

                      {canCancel && (
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={() => handleOpenCancel(session)}
                          leftIcon={<XCircle className="h-5 w-5 text-red-600" />}
                        >
                          إلغاء
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Cancel Session Modal */}
      <Dialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open && !cancelling) setCancelTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إلغاء الحصة</DialogTitle>
            <DialogDescription>
              سيتم إلغاء «{cancelTarget?.titleAr}» وإرسال تنبيه فوري للطلاب المسجلين.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmCancel} className="mt-4 flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {CANCEL_PRESET_REASONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setCancelReason(preset);
                    setCancelError(null);
                  }}
                  className={cn(
                    "min-h-[42px] rounded-xl border px-3.5 text-sm font-medium transition-colors cursor-pointer",
                    cancelReason === preset
                      ? "border-[#0B63CE] bg-[#EEF5FF] text-[#0B63CE] dark:border-blue-400 dark:bg-blue-500/15 dark:text-blue-200"
                      : "border-[var(--border-hairline)] bg-[var(--bg-sunken)] text-[var(--text-secondary)]"
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>

            <Input
              label="سبب الإلغاء"
              inputSize="lg"
              required
              placeholder="اكتب السبب المختصر للطلاب..."
              value={cancelReason}
              error={cancelError ?? undefined}
              onChange={(e) => {
                setCancelReason(e.target.value);
                setCancelError(null);
              }}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={cancelling}
                onClick={() => setCancelTarget(null)}
              >
                تراجع
              </Button>
              <Button type="submit" variant="danger" loading={cancelling}>
                تأكيد إلغاء الحصة
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
