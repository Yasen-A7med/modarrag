"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Download,
  Lock,
  Maximize2,
  Minimize2,
  Printer,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { SchoolAdminDashboardData } from "@/application/academic/actions";
import type { HallOccupancyData } from "@/application/halls/actions";
import { HallGaugeRing } from "@/components/admin/LiveOccupancyBento";
import { ModarragLogo } from "@/components/brand/ModarragLogo";
import { TrackIcon } from "@/components/brand/TrackIcon";
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
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4 min-w-0">
            <ModarragLogo size="lg" showWordmark showSubtitle />
            <div className="hidden h-10 w-px bg-[var(--border-hairline)] sm:block" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="primary">ملف العرض الرسمي — وزارة التربية والتعليم</Badge>
                <Badge variant="mono" dir="ltr">
                  {dashboard.school.slug}
                </Badge>
              </div>
              <h1 className="mt-1.5 text-lg font-bold text-[var(--text-primary)] sm:text-2xl">
                {dashboard.school.nameAr}
              </h1>
              <p className="mt-0.5 text-xs text-[var(--text-muted)] tabular-nums">
                تحديث المؤشرات: {formatCairoDate(nowIso)} · {formatCairoTime(nowIso)} (بتوقيت القاهرة)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <ThemeToggle />

            <a
              href={`/api/reports/export?schoolSlug=${encodeURIComponent(schoolSlug)}&format=csv`}
              className={buttonVariants({
                variant: "outline",
                size: "md",
                className: "min-h-[44px]",
              })}
            >
              <Download className="h-4 w-4" />
              <span>تصدير تقرير الوزارة CSV</span>
            </a>

            <Button
              type="button"
              variant="outline"
              size="md"
              className="min-h-[44px]"
              onClick={() => window.print()}
              leftIcon={<Printer className="h-4 w-4" />}
            >
              طباعة / تصدير PDF
            </Button>

            <Button
              type="button"
              variant="primary"
              size="md"
              className="min-h-[44px]"
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
      </Card>

      {/* Safety-over-Commercial-Centers Comparison Strip */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-emerald-300/80 p-5 dark:border-emerald-500/35">
          <div className="flex items-center justify-between">
            <Badge variant="success" dot>
              أمان السعة والانضباط
            </Badge>
            <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="mt-3 text-base sm:text-lg font-bold text-[var(--text-primary)] leading-snug">
            سعة مضبوطة بنسبة ١٠٠٪ مقابل تكدس ٣٠٠-٤٠٠ طالب
          </h2>
          <p className="mt-2 text-xs text-[var(--text-secondary)] leading-relaxed">
            على عكس المراكز التجارية المفتوحة، تقيد المنصة كل حصة بالسعة الهندسية للمدرج مع ترقية آلية لقائمة الانتظار وفواصل انتقال إلزامية ١٥ دقيقة.
          </p>
        </Card>

        <Card className="border-blue-300/80 p-5 dark:border-blue-500/35">
          <div className="flex items-center justify-between">
            <Badge variant="primary">الأمان الرقمي للبوابة</Badge>
            <Lock className="h-5 w-5 text-[#1E3A8A] dark:text-blue-400" />
          </div>
          <h2 className="mt-3 text-base sm:text-lg font-bold text-[var(--text-primary)] leading-snug">
            تذاكر HMAC-SHA256 مشفرة
          </h2>
          <p className="mt-2 text-xs text-[var(--text-secondary)] leading-relaxed">
            كل مقعد محجوز يصدر برمز تحقق موقّع رقمياً للاستخدام الفردي عند البوابة المدرسية، مما يمنع التكرار أو دخول غير المسجلين بالمدرسة.
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <Badge variant="info">انضباط الحضور الفعلي</Badge>
            <ShieldCheck className="h-5 w-5 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <span
              className="text-3xl font-bold text-[var(--text-primary)] tabular-nums"
              dir="ltr"
            >
              {formatArabicNumber(attendanceRatePct, { useEasternDigits: false })}%
            </span>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">
              ({formatArabicNumber(checkedInCount)} حضور موثق من{" "}
              {formatArabicNumber(totalBookingsCount)} حجز)
            </span>
          </div>
          <p className="mt-2 text-xs text-[var(--text-secondary)] leading-relaxed">
            فصل كامل لبيانات المدرسة عبر سياسات قواعد البيانات RLS وسجل تدقيق غير قابل للتعديل.
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
            <Building2 className="h-4 w-4 text-[#1E3A8A] dark:text-blue-400" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              مؤشر إشغال القاعات والمدرجات المباشر
            </h2>
          </div>
          <Badge variant="mono" dir="ltr">
            {formatArabicNumber(occupancy.halls.length)} HALLS
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {occupancy.halls.map((hall) => (
            <Card key={hall.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <Badge variant="mono" dir="ltr">
                  {hall.code}
                </Badge>
                <p className="mt-1.5 truncate text-sm font-bold text-[var(--text-primary)]">
                  {hall.nameAr}
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)] tabular-nums">
                  {formatArabicNumber(hall.currentBookedCount)} /{" "}
                  {formatArabicNumber(hall.maxCapacity)} مقعد
                </p>
                <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                  {hall.currentSessionTitleAr ?? "متاحة للجدولة"}
                </p>
              </div>

              <HallGaugeRing
                booked={hall.currentBookedCount}
                capacity={hall.maxCapacity}
                status={hall.status}
                size={84}
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {dashboard.tracks.map((track) => {
            const linkedSubjects = dashboard.trackSubjects
              .filter((ts) => ts.trackId === track.id)
              .map((ts) => dashboard.subjects.find((s) => s.id === ts.subjectId))
              .filter((s): s is NonNullable<typeof s> => Boolean(s));

            return (
              <Card key={track.id} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <TrackIcon trackCode={track.code} size="sm" />
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-[var(--text-primary)]">
                        {track.nameAr}
                      </h3>
                      <p className="font-mono text-[11px] text-[var(--text-muted)]" dir="ltr">
                        {track.code}
                      </p>
                    </div>
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
            );
          })}
        </div>
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
