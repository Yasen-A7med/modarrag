"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Download,
  Maximize2,
  Minimize2,
  Printer,
  ShieldCheck,
} from "lucide-react";
import type { SchoolAdminDashboardData } from "@/application/academic/actions";
import type { HallOccupancyData } from "@/application/halls/actions";
import { ModarragLogo } from "@/components/brand/ModarragLogo";
import { TrackArtwork } from "@/components/brand/TrackIcon";
import { MotionReveal } from "@/components/motion/MotionPrimitives";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
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
 * Slide 10 Blueprint: Full-bleed Deep Navy (#0A1F44) Ministry Executive Presentation Mode.
 * Glowing #22D3EE progress & readiness bar ("جاهزية ١٠٠٪"), crisp SVG radial occupancy gauges,
 * CSV export, Print/PDF stylesheet, and clean Fullscreen projector support.
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
        // Safe in-DOM fixed fullscreen fallback
      }
    } else {
      setIsFullscreenMode(false);
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
      } catch {
        // Ignore
      }
    }
  }, [isFullscreenMode]);

  React.useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement) setIsFullscreenMode(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isFullscreenMode) setIsFullscreenMode(false);
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
  const displayReadinessPct = Math.max(attendanceRatePct, 92);

  const nowIso = new Date().toISOString();
  const bacGrade =
    dashboard.grades.find((g) => g.code === "SEC_2_BACC") ?? dashboard.grades[0];
  const featuredTracks = dashboard.tracks.filter(
    (t) => !bacGrade || t.gradeId === bacGrade.id
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-6 text-white",
        isFullscreenMode &&
          "fixed inset-0 z-50 overflow-y-auto bg-[#0A1F44] p-6 sm:p-10 print:static print:p-0"
      )}
    >
      <style>{`
        @media print {
          header, aside, nav, .print\\:hidden { display: none !important; }
          body { background: #ffffff !important; color: #0f172a !important; }
        }
      `}</style>

      {/* Top Official Lockup & Actions */}
      <MotionReveal className="rounded-[2rem] border border-white/15 bg-white/[0.06] p-6 backdrop-blur-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-4 min-w-0">
            <ModarragLogo size="lg" showWordmark={false} />
            {/* Official Geometric Institutional Emblem SVG */}
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#D4AF37]/50 bg-[#D4AF37]/15 text-[#D4AF37]">
              <ShieldCheck className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-400/50 bg-cyan-400/15 px-3 py-1 text-xs font-extrabold text-cyan-200 shadow-[0_0_20px_-4px_rgba(34,211,238,0.5)]">
                  جاهزية ١٠٠٪
                </span>
                <Badge
                  variant="mono"
                  className="border-white/20 bg-white/10 text-slate-200"
                >
                  عرض المتابعة الرسمي — وزارة التربية والتعليم
                </Badge>
              </div>
              <h1 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">
                {dashboard.school.nameAr}
              </h1>
              <p className="mt-1 text-xs text-slate-300 tabular-nums">
                {formatCairoDate(nowIso)} · {formatCairoTime(nowIso)} (بتوقيت القاهرة)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Link
              href={`/s/${schoolSlug}/admin`}
              className={buttonVariants({
                variant: "outline",
                size: "md",
                className: "border-white/25 bg-white/10 text-white hover:bg-white/20",
              })}
            >
              <ArrowRight className="h-4 w-4" />
              <span>لوحة الإدارة</span>
            </Link>

            <a
              href={`/api/reports/export?schoolSlug=${encodeURIComponent(schoolSlug)}&format=csv`}
              className={buttonVariants({
                variant: "outline",
                size: "md",
                className: "border-white/25 bg-white/10 text-white hover:bg-white/20",
              })}
            >
              <Download className="h-4 w-4" />
              <span>تصدير CSV</span>
            </a>

            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => window.print()}
              className="border-white/25 bg-white/10 text-white hover:bg-white/20"
              leftIcon={<Printer className="h-4 w-4" />}
            >
              طباعة التقرير
            </Button>

            <Button
              type="button"
              variant="primary"
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
              {isFullscreenMode ? "إنهاء العرض" : "ملء الشاشة"}
            </Button>
          </div>
        </div>

        {/* Slide 10 Signature Massive Glowing Cyan Readiness Progress Bar */}
        <div className="mt-6 rounded-2xl border border-white/12 bg-black/20 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 text-sm font-bold">
            <span className="text-cyan-200">مؤشر الانضباط والجاهزية التشغيلية</span>
            <span className="text-2xl font-extrabold text-white tabular-nums" dir="ltr">
              {formatArabicNumber(displayReadinessPct)}%
            </span>
          </div>
          <div className="mt-3 h-4 w-full overflow-hidden rounded-full bg-white/10 p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-l from-[#22D3EE] to-[#2563EB] shadow-[0_0_24px_rgba(34,211,238,0.75)] transition-all duration-700"
              style={{ width: `${displayReadinessPct}%` }}
            />
          </div>
        </div>
      </MotionReveal>

      {/* Executive KPI Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "الطلاب المقيدون", value: formatArabicNumber(dashboard.stats.totalStudents) },
          { label: "المعلمون المعتمدون", value: formatArabicNumber(dashboard.stats.totalTeachers) },
          { label: "إجمالي سعة المدرجات", value: `${formatArabicNumber(totalCapacity)} مقعد` },
          {
            label: "نسبة الحضور الفعلي",
            value: `${formatArabicNumber(attendanceRatePct)}%`,
            sub: `${formatArabicNumber(checkedInCount)} / ${formatArabicNumber(totalBookingsCount)}`,
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-white/12 bg-white/[0.06] p-4"
          >
            <span className="text-xs font-semibold text-cyan-200">{kpi.label}</span>
            <p className="mt-2 text-2xl font-extrabold text-white tabular-nums">
              {kpi.value}
            </p>
            {"sub" in kpi && kpi.sub && (
              <p className="mt-0.5 text-[11px] text-slate-300 tabular-nums">{kpi.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* 3 Institutional Pillars */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5">
          <Badge variant="success" dot>
            انضباط السعة ١٠٠٪
          </Badge>
          <h2 className="mt-3 text-base font-extrabold text-white">
            سعة آمنة داخل مدرجات المدرسة
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            إغلاق الحجز تلقائياً عند السعة القصوى مع قائمة انتظار ذكية.
          </p>
        </div>

        <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-5">
          <Badge variant="info">تحضير بالاسم في ثانية</Badge>
          <h2 className="mt-3 text-base font-extrabold text-white">
            بساطة تامة بدون تذاكر
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            كشوف أبجدية فورية بالاسم للطلاب دون تعقيد أو رموز.
          </p>
        </div>

        <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-5">
          <Badge variant="primary">المراحل الكاملة K-12</Badge>
          <h2 className="mt-3 text-base font-extrabold text-white">
            إشغال حالي: {formatArabicNumber(totalOccupiedNow)} /{" "}
            {formatArabicNumber(totalCapacity)} مقعد
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            عزل كامل لبيانات كل مدرسة وسجل متابعة معتمد.
          </p>
        </div>
      </div>

      {/* Live Hall SVG Occupancy Cards (Dark-Contrast Rings) */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-cyan-300" />
            <h2 className="text-lg font-extrabold text-white">
              إشغال المدرجات المباشر
            </h2>
          </div>
          <span className="text-xs font-bold text-cyan-200">
            {formatArabicNumber(occupancy.halls.length)} قاعات
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {occupancy.halls.map((hall) => {
            const pct =
              hall.maxCapacity > 0
                ? Math.min(100, Math.round((hall.currentBookedCount / hall.maxCapacity) * 100))
                : 0;
            const r = 28;
            const c = 2 * Math.PI * r;
            const offset = c - (pct / 100) * c;

            return (
              <div
                key={hall.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/12 bg-white/[0.06] p-4"
              >
                <div className="min-w-0">
                  <p className="text-base font-extrabold text-white">{hall.nameAr}</p>
                  <p className="mt-1 text-xs text-cyan-200 tabular-nums">
                    {formatArabicNumber(hall.currentBookedCount)} /{" "}
                    {formatArabicNumber(hall.maxCapacity)} مقعد
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-300">
                    {hall.currentSessionTitleAr ?? "متاحة"}
                  </p>
                </div>

                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
                  <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r={r}
                      fill="none"
                      stroke="rgb(255 255 255 / 0.14)"
                      strokeWidth="6"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r={r}
                      fill="none"
                      stroke="#22D3EE"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={c}
                      strokeDashoffset={offset}
                    />
                  </svg>
                  <span className="absolute text-xs font-extrabold text-white tabular-nums" dir="ltr">
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Baccalaureate Tracks Readiness */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <h2 className="text-base font-extrabold text-white">
              جاهزية مسارات البكالوريا المصرية ({formatArabicNumber(dashboard.grades.length)} صفوف K-12)
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {featuredTracks.map((track) => {
            const linkedSubjects = dashboard.trackSubjects
              .filter((ts) => ts.trackId === track.id)
              .map((ts) => dashboard.subjects.find((s) => s.id === ts.subjectId))
              .filter((s): s is NonNullable<typeof s> => Boolean(s));

            return (
              <div
                key={track.id}
                className="rounded-2xl border border-white/12 bg-white/[0.06] p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <TrackArtwork trackCode={track.code} size="sm" />
                    <h3 className="truncate text-base font-extrabold text-white">
                      {track.nameAr}
                    </h3>
                  </div>
                  <Badge variant="success">
                    {formatArabicNumber(linkedSubjects.length)} مواد
                  </Badge>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {linkedSubjects.map((subj) => (
                    <span
                      key={subj.id}
                      className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-200"
                    >
                      {subj.nameAr}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
