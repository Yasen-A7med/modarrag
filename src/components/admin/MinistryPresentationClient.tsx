"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Download,
  Maximize2,
  Minimize2,
  Printer,
} from "lucide-react";
import type { SchoolAdminDashboardData } from "@/application/academic/actions";
import type { HallOccupancyData } from "@/application/halls/actions";
import { HallGaugeRing } from "@/components/admin/LiveOccupancyBento";
import { ModarragLogo } from "@/components/brand/ModarragLogo";
import { TrackArtwork } from "@/components/brand/TrackIcon";
import {
  MotionReveal,
  MotionStaggerCard,
  MotionStaggerGrid,
} from "@/components/motion/MotionPrimitives";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { formatArabicNumber, formatCairoDate, formatCairoTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export interface MinistryPresentationClientProps {
  readonly schoolSlug: string;
  readonly dashboard: SchoolAdminDashboardData;
  readonly occupancy: HallOccupancyData;
  readonly totalBookingsCount: number;
  readonly checkedInCount: number;
}

/**
 * Executive Ministry Presentation Mode:
 * Supports both in-page view and borderless Fullscreen projector overlay,
 * live ThemeToggle, Safety-over-Commercial-Centers telemetry, SVG hall rings,
 * Baccalaureate track readiness, CSV export, and clean print/PDF layout.
 */
export function MinistryPresentationClient({
  schoolSlug,
  dashboard,
  occupancy,
  totalBookingsCount,
  checkedInCount,
}: MinistryPresentationClientProps) {
  const [isFullscreenMode, setIsFullscreenMode] = React.useState(false);

  const togglePresentationFullscreen = React.useCallback(async () => {
    if (!isFullscreenMode) {
      setIsFullscreenMode(true);
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // Fallback smoothly to in-DOM fixed fullscreen overlay when browser blocks API.
      }
    } else {
      setIsFullscreenMode(false);
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
      } catch {
        // Ignore exit errors.
      }
    }
  }, [isFullscreenMode]);

  React.useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreenMode(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isFullscreenMode) {
        setIsFullscreenMode(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreenMode]);

  const totalCapacity = occupancy.halls.reduce((acc, h) => acc + h.maxCapacity, 0);
  const totalOccupiedNow = occupancy.halls.reduce(
    (acc, h) => acc + h.currentBookedCount,
    0
  );
  const attendanceRatePct =
    totalBookingsCount > 0
      ? Math.round((checkedInCount / totalBookingsCount) * 100)
      : 0;

  const nowIso = new Date().toISOString();

  return (
    <div
      className={cn(
        "flex flex-col gap-6",
        isFullscreenMode &&
          "fixed inset-0 z-50 overflow-y-auto bg-[var(--bg-canvas)] p-6 sm:p-10 print:static print:p-0"
      )}
    >
      {/* Clean print stylesheet for Ministry PDF output */}
      <style>{`
        @media print {
          header, aside, nav, .print\\:hidden { display: none !important; }
          body { background: #ffffff !important; color: #0f172a !important; }
        }
      `}</style>

      {/* Executive Presentation Header Bar */}
      <MotionReveal className="ambient-mesh rounded-3xl border border-[var(--border-hairline)] p-5 sm:p-6 hairline-lift">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4 min-w-0">
            <ModarragLogo size="lg" showWordmark showSubtitle />
            <div className="hidden h-10 w-px bg-[var(--border-hairline)] sm:block" />
            <div className="min-w-0">
              <Badge variant="primary" size="md">
                عرض المتابعة الرسمي — وزارة التربية والتعليم
              </Badge>
              <h1 className="mt-2 text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
                {dashboard.school.nameAr}
              </h1>
              <p className="mt-1 text-sm text-[var(--text-muted)] tabular-nums">
                تحديث البيانات: {formatCairoDate(nowIso)} · {formatCairoTime(nowIso)} (بتوقيت القاهرة)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <div className="art-pedestal hidden h-12 w-12 shrink-0 overflow-hidden rounded-xl p-1 xl:block">
              <Image
                src="/images/role-admin-3d.webp"
                alt="لوحة متابعة المدرسة"
                width={48}
                height={48}
                loading="eager"
                className="h-full w-full rounded-lg object-cover"
              />
            </div>
            <ThemeToggle />

            <a
              href={`/api/reports/export?schoolSlug=${encodeURIComponent(schoolSlug)}&format=csv`}
              className={buttonVariants({
                variant: "outline",
                size: "md",
              })}
            >
              <Download className="h-4 w-4" />
              <span>تصدير كشف الأسماء CSV</span>
            </a>

            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => window.print()}
              leftIcon={<Printer className="h-4 w-4" />}
            >
              طباعة / PDF
            </Button>

            <Button
              type="button"
              variant="emerald"
              size="md"
              onClick={togglePresentationFullscreen}
              leftIcon={
                isFullscreenMode ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )
              }
            >
              {isFullscreenMode ? "إنهاء ملء الشاشة" : "عرض بملء الشاشة"}
            </Button>
          </div>
        </div>
      </MotionReveal>

      {/* Safety + Simplicity Pillars */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-emerald-300/80 p-5 dark:border-emerald-500/35">
          <Badge variant="success" dot size="md">
            أمان السعة والانضباط
          </Badge>
          <h2 className="mt-3 text-lg font-bold text-[var(--text-primary)] leading-snug">
            سعة مضبوطة بنسبة 100% داخل قاعات المدرسة
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
            على عكس المراكز الخاصة المزدحمة، تحدد المنصة كل حصة بالسعة الآمنة للمدرج مع ترقية تلقائية لقائمة الانتظار.
          </p>
        </Card>

        <Card className="border-blue-300/80 p-5 dark:border-blue-500/35">
          <Badge variant="primary" size="md">
            تحضير بالاسم في ثانية
          </Badge>
          <h2 className="mt-3 text-lg font-bold text-[var(--text-primary)] leading-snug">
            بساطة تامة بدون تذاكر أو تعقيد
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
            يحجز الطالب مقعده باسمه، وتظهر القائمة فوراً للمعلم مرتبة أبجدياً مع بحث سريع بالاسم وتسجيل حضور بضغطة واحدة.
          </p>
        </Card>

        <Card className="p-5">
          <Badge variant="info" size="md">
            نسبة الحضور الفعلي
          </Badge>
          <div className="mt-3 flex items-baseline gap-3">
            <span
              className="text-3xl font-bold text-[var(--text-primary)] tabular-nums"
              dir="ltr"
            >
              {formatArabicNumber(attendanceRatePct)}%
            </span>
            <span className="text-sm text-[var(--text-muted)] tabular-nums">
              ({formatArabicNumber(checkedInCount)} حضور من أصل{" "}
              {formatArabicNumber(totalBookingsCount)} حجز)
            </span>
          </div>
          <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
            بيانات كل مدرسة معزولة بالكامل بأعلى معايير الأمان وسجل متابعة معتمد لإدارة المدرسة والوزارة.
          </p>
        </Card>
      </section>

      {/* Executive KPIs + Live Hall Occupancy Rings */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <span className="text-xs text-[var(--text-muted)]">الطلاب المقيدون</span>
          <p className="mt-1.5 text-2xl font-bold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(dashboard.stats.totalStudents)}
          </p>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-[var(--text-muted)]">المعلمون المعتمدون</span>
          <p className="mt-1.5 text-2xl font-bold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(dashboard.stats.totalTeachers)}
          </p>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-[var(--text-muted)]">إجمالي السعة الاستيعابية</span>
          <p className="mt-1.5 text-2xl font-bold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(totalCapacity)} مقعد
          </p>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-[var(--text-muted)]">الحضور الحي الآن</span>
          <p className="mt-1.5 text-2xl font-bold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(totalOccupiedNow)} / {formatArabicNumber(totalCapacity)}
          </p>
        </Card>
      </div>

      {/* Live Hall SVG Occupancy Rings */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#0B63CE] dark:text-blue-400" />
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              مؤشر إشغال القاعات والمدرجات المباشر
            </h2>
          </div>
          <Badge variant="neutral" size="md">
            {formatArabicNumber(occupancy.halls.length)} قاعات
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {occupancy.halls.map((hall) => (
            <Card key={hall.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-[var(--text-primary)] leading-snug">
                  {hall.nameAr}
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)] tabular-nums">
                  {formatArabicNumber(hall.currentBookedCount)} /{" "}
                  {formatArabicNumber(hall.maxCapacity)} مقعد
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  {hall.currentSessionTitleAr ?? "متاحة للجدولة"}
                </p>
              </div>

              <HallGaugeRing
                booked={hall.currentBookedCount}
                capacity={hall.maxCapacity}
                status={hall.status}
                size={68}
              />
            </Card>
          ))}
        </div>
      </section>

      {/* Baccalaureate Track Readiness Breakdown */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              جاهزية مسارات البكالوريا المصرية بالمدرسة
            </h2>
          </div>
          <span className="text-xs text-[var(--text-muted)] tabular-nums">
            {formatArabicNumber(dashboard.tracks.length)} مسارات ·{" "}
            {formatArabicNumber(dashboard.subjects.length)} مادة
          </span>
        </div>

        <MotionStaggerGrid className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {dashboard.tracks.map((track) => {
            const linkedSubjects = dashboard.trackSubjects
              .filter((ts) => ts.trackId === track.id)
              .map((ts) => dashboard.subjects.find((s) => s.id === ts.subjectId))
              .filter((s): s is NonNullable<typeof s> => Boolean(s));

            return (
              <MotionStaggerCard key={track.id}>
                <Card className="hover-lift-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <TrackArtwork trackCode={track.code} size="sm" />
                      <h3 className="truncate text-base font-bold text-[var(--text-primary)]">
                        {track.nameAr}
                      </h3>
                    </div>
                    <Badge variant="success">
                      {formatArabicNumber(linkedSubjects.length)} مواد مرتبطة
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {linkedSubjects.map((subj) => (
                      <Badge key={subj.id} variant="neutral" size="sm">
                        {subj.nameAr}
                      </Badge>
                    ))}
                  </div>
                </Card>
              </MotionStaggerCard>
            );
          })}
        </MotionStaggerGrid>
      </section>

      {isFullscreenMode && (
        <div className="flex justify-end print:hidden">
          <Link
            href={`/s/${schoolSlug}/admin`}
            onClick={() => setIsFullscreenMode(false)}
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "min-h-[40px]",
            })}
          >
            العودة للوحة الإدارة
          </Link>
        </div>
      )}
    </div>
  );
}
