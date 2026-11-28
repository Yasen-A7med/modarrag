"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertCircle,
  BookOpen,
  Building2,
  CalendarClock,
  CalendarPlus,
  ClipboardCheck,
  Clock,
  Laptop,
  MapPin,
  Printer,
  ShieldCheck,
  Users,
  Video,
  Wallet,
  XCircle,
} from "lucide-react";
import type { SchoolFinancialSummary } from "@/application/finance/actions";
import {
  cancelSessionAction,
  type TeacherConsoleData,
} from "@/application/sessions/actions";
import { RadialGauge } from "@/components/charts/RadialGauge";
import { FinancialSplitCard } from "@/components/finance/FinancialSplitCard";
import {
  MotionReveal,
  MotionStaggerCard,
  MotionStaggerGrid,
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
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  formatArabicNumber,
  formatCairoDate,
  formatCairoTimeRange,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";

/**
 * Compact mobile-only quick strip since Desktop uses the persistent Navy RTL Sidebar.
 */
export function TeacherSubNav({ schoolSlug }: { readonly schoolSlug: string }) {
  const pathname = usePathname();
  const base = `/s/${schoolSlug}/teacher`;

  const links = [
    { href: base, label: "لوحة القيادة", icon: ClipboardCheck, active: pathname === base },
    {
      href: `${base}/book-hall`,
      label: "الجدول والحجز",
      icon: CalendarPlus,
      active: pathname.startsWith(`${base}/book-hall`),
    },
    {
      href: `${base}/lectures`,
      label: "المحاضرات",
      icon: Video,
      active: pathname.startsWith(`${base}/lectures`),
    },
    {
      href: `${base}/printing`,
      label: "المطبعة",
      icon: Printer,
      active: pathname.startsWith(`${base}/printing`),
    },
  ] as const;

  return (
    <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1 lg:hidden">
      {links.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold whitespace-nowrap",
              item.active
                ? "border-[#2563EB] bg-[#2563EB] text-white"
                : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function TeacherAccessNotice({
  schoolSlug,
  errorCode,
  errorMessage,
}: {
  readonly schoolSlug: string;
  readonly errorCode: string;
  readonly errorMessage: string;
}) {
  const isUnauth = errorCode === "UNAUTHORIZED";
  return (
    <Card className="mx-auto max-w-lg rounded-3xl p-7 text-center">
      <AlertCircle className="mx-auto h-10 w-10 text-amber-600 dark:text-amber-400" />
      <h1 className="mt-3 text-xl font-extrabold text-[var(--text-primary)]">
        {isUnauth ? "سجّل دخولك لفتح لوحة المعلم" : "بوابة المعلم غير متاحة لهذا الحساب"}
      </h1>
      <p className="mt-1.5 text-sm text-[var(--text-secondary)]">{errorMessage}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
        <Link href="/login" className={buttonVariants({ variant: "primary", size: "md" })}>
          تسجيل الدخول
        </Link>
        <Link
          href={`/s/${schoolSlug}`}
          className={buttonVariants({ variant: "outline", size: "md" })}
        >
          بوابة المدرسة
        </Link>
      </div>
    </Card>
  );
}

export interface TeacherDashboardClientProps {
  readonly schoolSlug: string;
  readonly data: TeacherConsoleData;
  readonly financialSummary?: SchoolFinancialSummary;
}

/**
 * Slides 1-2 Blueprint: Executive Teacher Console with 4 cyan-accented KPI cards,
 * transparent 70/30 + 14% VAT earnings widget, compliance badge, and daily session schedule.
 */
export function TeacherDashboardClient({
  schoolSlug,
  data,
  financialSummary,
}: TeacherDashboardClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [showSchoolWide, setShowSchoolWide] = React.useState(false);
  const [cancelTarget, setCancelTarget] = React.useState<
    TeacherConsoleData["sessions"][number] | null
  >(null);
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelling, setCancelling] = React.useState(false);

  const ownSessions = React.useMemo(
    () => data.sessions.filter((s) => s.isOwnSession && s.status !== "cancelled"),
    [data.sessions]
  );

  const displayedSessions = React.useMemo(() => {
    const baseList = showSchoolWide
      ? data.sessions.filter((s) => s.status !== "cancelled")
      : ownSessions;
    return baseList;
  }, [data.sessions, ownSessions, showSchoolWide]);

  const totalBookedStudents = ownSessions.reduce(
    (acc, s) => acc + s.bookedSeatsCount,
    0
  );

  const handleConfirmCancel = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const res = await cancelSessionAction({
        schoolSlug,
        sessionId: cancelTarget.id,
        reason: cancelReason.trim(),
      });
      if (!res.ok) {
        toast({
          title: "تعذر إلغاء الحصة",
          description: res.error.message,
          variant: "error",
        });
        return;
      }
      toast({
        title: "تم إلغاء الحصة وإخطار الطلاب",
        description: `تم إرسال إشعار لـ ${formatArabicNumber(res.data.notifiedCount)} طالب.`,
        variant: "info",
      });
      setCancelTarget(null);
      setCancelReason("");
      router.refresh();
    } finally {
      setCancelling(false);
    }
  };

  const kpiCards = [
    {
      label: "حصصك القادمة",
      value: formatArabicNumber(ownSessions.length),
      icon: CalendarClock,
      barClass: "border-b-[#2563EB]",
    },
    {
      label: "الطلاب المتوقعون",
      value: formatArabicNumber(totalBookedStudents),
      icon: Users,
      barClass: "border-b-[#22D3EE]",
    },
    {
      label: "القاعات النشطة",
      value: formatArabicNumber(data.halls.length),
      icon: Building2,
      barClass: "border-b-[#0A1F44]",
    },
    {
      label: `صافي مستحقاتك (${formatArabicNumber(data.financialPolicy.teacherSharePct)}٪)`,
      value: `${formatArabicNumber(financialSummary?.teacherEarningsEgp ?? 0)} ج.م`,
      icon: Wallet,
      barClass: "border-b-[#16A34A]",
    },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      {/* Header Banner */}
      <MotionReveal className="flex flex-col gap-4 rounded-[2rem] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 hairline-lift">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary" size="md">
              {data.specialtyAr} ·{" "}
              <span dir="ltr" className="font-mono">
                {data.teacherCode}
              </span>
            </Badge>
            <Badge variant="success" size="md">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>التزام المواعيد {formatArabicNumber(data.complianceScore)}٪</span>
            </Badge>
          </div>

          <h1 className="mt-2.5 text-2xl font-extrabold text-[var(--text-primary)]">
            لوحة قيادة المعلم
          </h1>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
            المواد المعتمدة: {data.subjects.map((s) => s.nameAr).join(" · ")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/s/${schoolSlug}/teacher/book-hall`}
            className={buttonVariants({ variant: "primary", size: "md" })}
          >
            <CalendarPlus className="h-4 w-4" />
            <span>حجز حصة</span>
          </Link>
          <Link
            href={`/s/${schoolSlug}/teacher/lectures`}
            className={buttonVariants({ variant: "outline", size: "md" })}
          >
            <Video className="h-4 w-4" />
            <span>رفع محاضرة</span>
          </Link>
          <Link
            href={`/s/${schoolSlug}/teacher/printing`}
            className={buttonVariants({ variant: "outline", size: "md" })}
          >
            <Printer className="h-4 w-4" />
            <span>المطبعة</span>
          </Link>
        </div>
      </MotionReveal>

      {/* Slide 2: 4 KPI Cards with Cyan/Blue Bottom Accent Bars */}
      <MotionStaggerGrid className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((item) => {
          const Icon = item.icon;
          return (
            <MotionStaggerCard key={item.label}>
              <Card className={cn("hover-lift-card border-b-[3px] p-4", item.barClass)}>
                <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)]">
                  <span>{item.label}</span>
                  <Icon className="h-4 w-4 text-[#2563EB] dark:text-cyan-300" />
                </div>
                <p className="mt-2 text-2xl font-extrabold text-[var(--text-primary)] tabular-nums">
                  {item.value}
                </p>
              </Card>
            </MotionStaggerCard>
          );
        })}
      </MotionStaggerGrid>

      {financialSummary && (
        <FinancialSplitCard summary={financialSummary} audience="teacher" />
      )}

      {/* Sessions List + Filter Toggle */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold text-[var(--text-primary)]">
            {showSchoolWide ? "جدول المدرسة الكامل" : "حصصك المجدولة"}
          </h2>

          <div className="inline-flex rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-1 text-xs">
            <button
              type="button"
              onClick={() => setShowSchoolWide(false)}
              className={cn(
                "min-h-[36px] rounded-lg px-3 font-bold cursor-pointer",
                !showSchoolWide
                  ? "bg-[#0A1F44] text-white dark:bg-blue-600"
                  : "text-[var(--text-secondary)]"
              )}
            >
              حصصي ({formatArabicNumber(ownSessions.length)})
            </button>
            <button
              type="button"
              onClick={() => setShowSchoolWide(true)}
              className={cn(
                "min-h-[36px] rounded-lg px-3 font-bold cursor-pointer",
                showSchoolWide
                  ? "bg-[#0A1F44] text-white dark:bg-blue-600"
                  : "text-[var(--text-secondary)]"
              )}
            >
              كل الحصص ({formatArabicNumber(data.sessions.length)})
            </button>
          </div>
        </div>

        {displayedSessions.length === 0 ? (
          <Card className="rounded-3xl p-10 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-[var(--text-muted)]" />
            <h3 className="mt-3 text-lg font-bold text-[var(--text-primary)]">
              لا توجد حصص مجدولة حالياً
            </h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              احجز قاعة مدرسية أو أنشئ حصة أونلاين جديدة في ثوانٍ.
            </p>
            <div className="mt-4">
              <Link
                href={`/s/${schoolSlug}/teacher/book-hall`}
                className={buttonVariants({ variant: "primary", size: "md" })}
              >
                احجز قاعة أو أونلاين
              </Link>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {displayedSessions.map((session) => {
              const isOnline = session.deliveryMode === "online";
              return (
                <Card key={session.id} className="hover-lift-card p-4 sm:p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-4 min-w-0">
                      <RadialGauge
                        value={session.bookedSeatsCount}
                        max={session.maxCapacity}
                        size={60}
                        strokeWidth={5}
                        mode="ratio"
                        tone={isOnline ? "cyan" : "auto"}
                      />

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="primary">{session.subjectNameAr}</Badge>
                          <Badge variant={isOnline ? "info" : "neutral"}>
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
                          {session.priceEgp > 0 && (
                            <Badge variant="warning">
                              {formatArabicNumber(session.priceEgp)} ج.م
                            </Badge>
                          )}
                        </div>

                        <h3 className="mt-1.5 text-base font-extrabold text-[var(--text-primary)]">
                          {session.titleAr}
                        </h3>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)] tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatCairoDate(session.startsAt)}
                          </span>
                          <span>·</span>
                          <span>
                            {formatCairoTimeRange(session.startsAt, session.endsAt)}
                          </span>
                          <span>·</span>
                          <span>
                            حضر {formatArabicNumber(session.checkedInCount)} من{" "}
                            {formatArabicNumber(session.bookedSeatsCount)}
                          </span>
                        </p>
                      </div>
                    </div>

                    {session.isOwnSession && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/s/${schoolSlug}/teacher/sessions/${session.id}`}
                          className={buttonVariants({
                            variant: "primary",
                            size: "md",
                          })}
                        >
                          <ClipboardCheck className="h-4 w-4" />
                          <span>تسجيل الحضور</span>
                        </Link>
                        <Button
                          variant="outline"
                          size="md"
                          onClick={() => {
                            setCancelTarget(session);
                            setCancelReason("");
                          }}
                          leftIcon={<XCircle className="h-4 w-4 text-red-500" />}
                        >
                          إلغاء الحصة
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Cancel Session Dialog */}
      <Dialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إلغاء الحصة وإخطار الطلاب</DialogTitle>
            <DialogDescription>
              سيتم إلغاء جميع الحجوزات في «{cancelTarget?.titleAr}» وإرسال إشعار فوري
              لجميع الطلاب المسجلين.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConfirmCancel} className="mt-4 flex flex-col gap-4">
            <Input
              label="سبب الإلغاء"
              required
              minLength={3}
              placeholder="مثال: تأجيل المراجعة ليوم آخر"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
              >
                تراجع
              </Button>
              <Button type="submit" variant="danger" loading={cancelling}>
                تأكيد الإلغاء
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
