"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Repeat,
  Sparkles,
} from "lucide-react";
import {
  createSessionAction,
  createSessionSeriesAction,
  type TeacherConsoleData,
} from "@/application/sessions/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, SelectInput } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { doBufferedSessionsOverlap } from "@/domain/booking/time-slots";
import {
  CAIRO_TIME_ZONE,
  formatArabicNumber,
  formatCairoDate,
  formatCairoDayKey,
  formatCairoTime,
  formatCairoTimeRange,
  formatDurationAr,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";

const DURATION_OPTIONS = [60, 90, 120, 180] as const;
const SERIES_WEEK_PRESETS = [4, 8, 12] as const;

const SLOT_TIMES_24 = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
] as const;

const BUFFER_HATCH_STYLE: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(-45deg, rgba(217, 119, 6, 0.18), rgba(217, 119, 6, 0.18) 5px, transparent 5px, transparent 10px)",
};

const CONFLICT_HATCH_STYLE: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(-45deg, rgba(220, 38, 38, 0.12), rgba(220, 38, 38, 0.12) 4px, transparent 4px, transparent 8px)",
};

function getCairoParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: CAIRO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const val = parts.find((p) => p.type === type)?.value;
    const parsed = val ? Number.parseInt(val, 10) : 0;
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const hourRaw = read("hour");
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: hourRaw === 24 ? 0 : hourRaw,
    minute: read("minute"),
  };
}

/**
 * Converts a Cairo calendar day (`YYYY-MM-DD`) and wall-clock time (`HH:MM`)
 * into an exact UTC ISO-8601 timestamp respecting DST transitions.
 */
function cairoWallTimeToIso(dayKey: string, time24: string): string {
  const [yStr, mStr, dStr] = dayKey.split("-");
  const [hStr, minStr] = time24.split(":");
  const year = Number.parseInt(yStr ?? "2026", 10);
  const month = Number.parseInt(mStr ?? "1", 10);
  const day = Number.parseInt(dStr ?? "1", 10);
  const hour = Number.parseInt(hStr ?? "12", 10);
  const minute = Number.parseInt(minStr ?? "0", 10);

  const targetWallMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let utcMs = targetWallMs - 2 * 3_600_000;

  for (let i = 0; i < 2; i++) {
    const p = getCairoParts(new Date(utcMs));
    const currentWallMs = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0, 0);
    const diff = targetWallMs - currentWallMs;
    if (diff === 0) break;
    utcMs += diff;
  }

  return new Date(utcMs).toISOString();
}

function extractCairoTime24(iso: string): string {
  const p = getCairoParts(new Date(iso));
  const hh = String(p.hour).padStart(2, "0");
  const mm = String(p.minute).padStart(2, "0");
  return `${hh}:${mm}`;
}

function buildFourteenCairoDays(): ReadonlyArray<{
  readonly dayKey: string;
  readonly weekdayLabel: string;
  readonly dayNumLabel: string;
  readonly monthLabel: string;
}> {
  const todayKey = formatCairoDayKey(new Date());
  const noonIso = cairoWallTimeToIso(todayKey, "12:00");
  const baseMs = new Date(noonIso).getTime();

  const weekdayFmt = new Intl.DateTimeFormat("ar-EG", {
    timeZone: CAIRO_TIME_ZONE,
    weekday: "short",
  });
  const dayNumFmt = new Intl.DateTimeFormat("ar-EG", {
    timeZone: CAIRO_TIME_ZONE,
    day: "numeric",
  });
  const monthFmt = new Intl.DateTimeFormat("ar-EG", {
    timeZone: CAIRO_TIME_ZONE,
    month: "short",
  });

  const days: Array<{
    readonly dayKey: string;
    readonly weekdayLabel: string;
    readonly dayNumLabel: string;
    readonly monthLabel: string;
  }> = [];

  for (let offset = 0; offset < 14; offset++) {
    const date = new Date(baseMs + offset * 86_400_000);
    days.push({
      dayKey: formatCairoDayKey(date),
      weekdayLabel: offset === 0 ? "اليوم" : weekdayFmt.format(date),
      dayNumLabel: dayNumFmt.format(date),
      monthLabel: monthFmt.format(date),
    });
  }

  return days;
}

interface ConflictSuggestion {
  readonly message: string;
  readonly nextFreeSlotIso: string | null;
  readonly alternativeHallCode: string | null;
}

export interface CalHallBookingGridProps {
  readonly schoolSlug: string;
  readonly data: TeacherConsoleData;
}

/**
 * Cal.com-inspired 3-column desktop / responsive mobile Hall Booking Planner
 * with 14-day Cairo picker, 15m diagonal-hatched transition buffers,
 * weekly series support, and 1-click smart SCHEDULE_CONFLICT resolution.
 */
export function CalHallBookingGrid({ schoolSlug, data }: CalHallBookingGridProps) {
  const router = useRouter();
  const { toast } = useToast();

  const days = React.useMemo(() => buildFourteenCairoDays(), []);
  const firstDayKey = days[0]?.dayKey ?? formatCairoDayKey(new Date());
  const firstHall = data.halls[0];
  const firstSubject = data.subjects[0];

  const [selectedSubjectId, setSelectedSubjectId] = React.useState<string>(
    firstSubject?.id ?? ""
  );
  const [selectedHallId, setSelectedHallId] = React.useState<string>(
    firstHall?.id ?? ""
  );
  const [selectedDayKey, setSelectedDayKey] = React.useState<string>(firstDayKey);
  const [selectedTime24, setSelectedTime24] = React.useState<string>("16:00");
  const [durationMinutes, setDurationMinutes] = React.useState<number>(90);
  const [hourFormat, setHourFormat] = React.useState<"12h" | "24h">("12h");
  const [titleAr, setTitleAr] = React.useState<string>("");
  const [customMaxCapacity, setCustomMaxCapacity] = React.useState<string>("");
  const [isWeeklySeries, setIsWeeklySeries] = React.useState<boolean>(false);
  const [recurrenceWeeks, setRecurrenceWeeks] = React.useState<number>(4);

  const [submitting, setSubmitting] = React.useState<boolean>(false);
  const [conflict, setConflict] = React.useState<ConflictSuggestion | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [seriesSummary, setSeriesSummary] = React.useState<{
    readonly createdCount: number;
    readonly conflictDates: readonly string[];
  } | null>(null);

  const selectedHall = data.halls.find((h) => h.id === selectedHallId) ?? firstHall;
  const selectedSubject =
    data.subjects.find((s) => s.id === selectedSubjectId) ?? firstSubject;

  // Sessions in the selected hall on the selected day (for the live daily timeline)
  const dayHallSessions = React.useMemo(() => {
    return data.sessions
      .filter(
        (s) =>
          s.hallId === selectedHallId &&
          formatCairoDayKey(s.startsAt) === selectedDayKey
      )
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [data.sessions, selectedHallId, selectedDayKey]);

  // Count sessions per day in selected hall for badge dots on 14-day grid
  const hallCountByDay = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of data.sessions) {
      if (s.hallId !== selectedHallId) continue;
      const key = formatCairoDayKey(s.startsAt);
      map[key] = (map[key] ?? 0) + 1;
    }
    return map;
  }, [data.sessions, selectedHallId]);

  const checkSlotConflict = React.useCallback(
    (time24: string) => {
      const startsAtIso = cairoWallTimeToIso(selectedDayKey, time24);
      const startMs = new Date(startsAtIso).getTime();
      const endsAtIso = new Date(startMs + durationMinutes * 60_000).toISOString();

      const candidate = {
        startsAt: startsAtIso,
        endsAt: endsAtIso,
        bufferMinutes: 15,
      };

      const hallOverlap = data.sessions.some(
        (s) =>
          s.hallId === selectedHallId &&
          doBufferedSessionsOverlap(candidate, {
            startsAt: s.startsAt,
            endsAt: s.endsAt,
            bufferMinutes: s.bufferMinutes,
          })
      );

      const teacherOverlap = data.sessions.some(
        (s) =>
          s.isOwnSession &&
          s.hallId !== selectedHallId &&
          doBufferedSessionsOverlap(candidate, {
            startsAt: s.startsAt,
            endsAt: s.endsAt,
            bufferMinutes: 0,
          })
      );

      return { hallOverlap, teacherOverlap, startsAtIso, endsAtIso };
    },
    [data.sessions, durationMinutes, selectedDayKey, selectedHallId]
  );

  const activePreview = React.useMemo(
    () => checkSlotConflict(selectedTime24),
    [checkSlotConflict, selectedTime24]
  );

  const handleApplySuggestedTime = (nextFreeSlotIso: string) => {
    const suggestedDay = formatCairoDayKey(nextFreeSlotIso);
    const suggestedTime = extractCairoTime24(nextFreeSlotIso);
    setSelectedDayKey(suggestedDay);
    setSelectedTime24(suggestedTime);
    setConflict(null);
    toast({
      title: "تم تطبيق الموعد البديل المقترح",
      description: `${formatCairoDate(nextFreeSlotIso)} · ${formatCairoTime(nextFreeSlotIso)}`,
      variant: "success",
    });
  };

  const handleApplySuggestedHall = (altHallCode: string) => {
    const targetHall = data.halls.find((h) => h.code === altHallCode);
    if (!targetHall) return;
    setSelectedHallId(targetHall.id);
    setConflict(null);
    toast({
      title: "تم اختيار القاعة البديلة",
      description: `${targetHall.nameAr} (${targetHall.code})`,
      variant: "success",
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setConflict(null);
    setFormError(null);
    setSeriesSummary(null);

    if (!selectedHallId || !selectedSubjectId) {
      setFormError("يرجى اختيار المادة الدراسية والمدرج أولاً.");
      return;
    }

    const effectiveTitle =
      titleAr.trim() ||
      (selectedSubject ? `محاضرة ${selectedSubject.nameAr}` : "حصة دراسية");

    const startsAtIso = cairoWallTimeToIso(selectedDayKey, selectedTime24);
    const parsedCap = customMaxCapacity.trim()
      ? Number.parseInt(customMaxCapacity.trim(), 10)
      : undefined;

    if (
      parsedCap !== undefined &&
      (Number.isNaN(parsedCap) ||
        parsedCap < 1 ||
        (selectedHall && parsedCap > selectedHall.maxCapacity))
    ) {
      setFormError(
        `السعة المخصصة يجب أن تكون بين ١ و ${formatArabicNumber(selectedHall?.maxCapacity ?? 500)} مقعد.`
      );
      return;
    }

    setSubmitting(true);
    try {
      if (isWeeklySeries) {
        const result = await createSessionSeriesAction({
          schoolSlug,
          hallId: selectedHallId,
          subjectId: selectedSubjectId,
          titleAr: effectiveTitle,
          startsAtIso,
          durationMinutes,
          recurrenceWeeks,
        });

        if (!result.ok) {
          setFormError(result.error.message);
          toast({
            title: "تعذر إنشاء السلسلة الأسبوعية",
            description: result.error.message,
            variant: "error",
          });
          return;
        }

        setSeriesSummary(result.data);
        toast({
          title: `تم جدولة ${formatArabicNumber(result.data.createdCount)} حصة أسبوعية`,
          description:
            result.data.conflictDates.length > 0
              ? `تم تخطي ${formatArabicNumber(result.data.conflictDates.length)} تواريخ متعارضة`
              : "جميع الأسابيع بدون تعارضات",
          variant: result.data.createdCount > 0 ? "success" : "warning",
        });
        router.refresh();
        return;
      }

      const result = await createSessionAction({
        schoolSlug,
        hallId: selectedHallId,
        subjectId: selectedSubjectId,
        titleAr: effectiveTitle,
        startsAtIso,
        durationMinutes,
        ...(parsedCap !== undefined ? { maxCapacity: parsedCap } : {}),
      });

      if (!result.ok) {
        if (result.error.code === "SCHEDULE_CONFLICT") {
          const rawDetails = result.error.details;
          const nextFreeSlotIso =
            rawDetails && typeof rawDetails.nextFreeSlotIso === "string"
              ? rawDetails.nextFreeSlotIso
              : null;
          const alternativeHallCode =
            rawDetails && typeof rawDetails.alternativeHallCode === "string"
              ? rawDetails.alternativeHallCode
              : null;

          setConflict({
            message: result.error.message,
            nextFreeSlotIso,
            alternativeHallCode,
          });
        } else {
          setFormError(result.error.message);
        }

        toast({
          title: "تعذر تثبيت الحجز",
          description: result.error.message,
          variant: "error",
        });
        return;
      }

      toast({
        title: "تم حجز المدرج وجدولة الحصة",
        description: `${effectiveTitle} · ${selectedHall?.nameAr ?? ""}`,
        variant: "success",
      });
      setTitleAr("");
      router.refresh();
    } catch {
      setFormError("حدث خطأ غير متوقع أثناء إرسال طلب الجدولة.");
    } finally {
      setSubmitting(false);
    }
  };

  if (data.halls.length === 0 || data.subjects.length === 0) {
    return (
      <Card className="p-6 text-center">
        <Building2 className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
        <h2 className="mt-3 text-base font-bold text-[var(--text-primary)]">
          بيانات القاعات أو المواد غير مكتملة بعد
        </h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          يرجى التأكد من وجود قاعة نشطة ومادة دراسية مسندة لحساب المعلم من إدارة المدرسة.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
            حجز قاعة وجدولة حصة جديدة
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            فحص تلقائي لتعارضات القاعات والمواعيد لضمان راحة الطلاب وسهولة الانتقال بين الحصص
          </p>
        </div>
        <Badge variant="primary" size="md">بتوقيت القاهرة</Badge>
      </div>

      {/* Cal.com-Inspired 3-Column Split Frame */}
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 divide-y divide-[var(--border-hairline)] overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] hairline-lift lg:grid-cols-12 lg:divide-y-0 lg:divide-x lg:divide-x-reverse"
      >
        {/* COLUMN 1: Subject, Hall Selector, Duration & Weekly Toggle */}
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:col-span-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[var(--text-primary)]">
              ١ · بيانات الحصة والمدرج
            </span>
            <span className="text-xs font-medium text-[var(--text-muted)]">
              {data.specialtyAr}
            </span>
          </div>

          <SelectInput
            label="المادة الدراسية"
            value={selectedSubjectId}
            onChange={(e) => {
              setSelectedSubjectId(e.target.value);
              setConflict(null);
            }}
          >
            {data.subjects.map((subj) => (
              <option key={subj.id} value={subj.id}>
                {subj.nameAr} ({subj.code})
              </option>
            ))}
          </SelectInput>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs sm:text-sm font-medium text-[var(--text-primary)]">
              اختيار القاعة / المدرج
            </span>
            <div className="grid grid-cols-1 gap-2">
              {data.halls.map((hall) => {
                const active = hall.id === selectedHallId;
                return (
                  <button
                    key={hall.id}
                    type="button"
                    onClick={() => {
                      setSelectedHallId(hall.id);
                      setConflict(null);
                    }}
                    className={cn(
                      "flex min-h-[48px] items-center justify-between rounded-lg border px-3 py-2 text-start transition-colors cursor-pointer",
                      active
                        ? "border-[#1E3A8A] bg-blue-50/70 dark:border-blue-500 dark:bg-blue-500/15"
                        : "border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-sunken)]"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {hall.nameAr}
                      </p>
                      <p className="font-mono text-[11px] text-[var(--text-muted)]" dir="ltr">
                        {hall.code}
                      </p>
                    </div>
                    <Badge variant={active ? "primary" : "neutral"} size="sm">
                      {formatArabicNumber(hall.maxCapacity)} مقعد
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>

          <Input
            label="عنوان الحصة"
            maxLength={160}
            placeholder={
              selectedSubject
                ? `مثال: مراجعة ${selectedSubject.nameAr} — الفصل الأول`
                : "عنوان المحاضرة"
            }
            value={titleAr}
            onChange={(e) => setTitleAr(e.target.value)}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-xs sm:text-sm font-medium text-[var(--text-primary)]">
              مدة الحصة
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {DURATION_OPTIONS.map((mins) => {
                const active = durationMinutes === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => {
                      setDurationMinutes(mins);
                      setConflict(null);
                    }}
                    className={cn(
                      "min-h-[44px] rounded-lg border text-xs font-semibold tabular-nums transition-colors cursor-pointer",
                      active
                        ? "border-[#1E3A8A] bg-[#1E3A8A] text-white dark:border-blue-500 dark:bg-blue-600"
                        : "border-[var(--border-hairline)] bg-[var(--bg-sunken)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                    )}
                  >
                    {formatArabicNumber(mins)} د
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Input
              label="سعة مخصصة (اختياري)"
              type="number"
              min={1}
              max={selectedHall?.maxCapacity ?? 2000}
              placeholder={
                selectedHall
                  ? `الافتراضي: ${selectedHall.maxCapacity} مقعد`
                  : "سعة القاعة"
              }
              value={customMaxCapacity}
              onChange={(e) => setCustomMaxCapacity(e.target.value)}
              disabled={isWeeklySeries}
              hint={isWeeklySeries ? "السلسلة الأسبوعية تستخدم السعة الكاملة للقاعة" : undefined}
            />
          </div>

          {/* Weekly Recurrence Toggle */}
          <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-[#1E3A8A] dark:text-blue-400" />
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  تكرار أسبوعي تلقائي
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isWeeklySeries}
                onClick={() => {
                  setIsWeeklySeries((prev) => !prev);
                  setConflict(null);
                }}
                className={cn(
                  "inline-flex min-h-[36px] items-center rounded-md border px-2.5 text-xs font-semibold transition-colors cursor-pointer",
                  isWeeklySeries
                    ? "border-[#1E3A8A] bg-[#1E3A8A] text-white dark:border-blue-500 dark:bg-blue-600"
                    : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                )}
              >
                {isWeeklySeries ? "مفعّل" : "حصة مفردة"}
              </button>
            </div>

            {isWeeklySeries && (
              <div className="mt-3 flex flex-col gap-2 border-t border-[var(--border-hairline)] pt-2.5">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>عدد الأسابيع المتتالية</span>
                  <span className="font-mono font-semibold text-[var(--text-primary)] tabular-nums">
                    {formatArabicNumber(recurrenceWeeks)} أسابيع
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {SERIES_WEEK_PRESETS.map((weeks) => (
                    <button
                      key={weeks}
                      type="button"
                      onClick={() => setRecurrenceWeeks(weeks)}
                      className={cn(
                        "min-h-[38px] rounded-md border text-xs font-semibold tabular-nums cursor-pointer",
                        recurrenceWeeks === weeks
                          ? "border-[#1E3A8A] bg-[var(--bg-surface)] text-[#1E3A8A] dark:border-blue-400 dark:text-blue-400"
                          : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                      )}
                    >
                      {formatArabicNumber(weeks)} أسابيع
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 2: 14-Day Cairo Date Grid & Live Daily Hall Timeline with 15m Hatched Buffers */}
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:col-span-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              ٢ · التقويم والجدول اليومي للقاعة
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-primary)]">
              <Calendar className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              <span>١٤ يوماً</span>
            </span>
          </div>

          {/* 14-day compact grid */}
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7 lg:grid-cols-4">
            {days.map((day) => {
              const active = day.dayKey === selectedDayKey;
              const busyCount = hallCountByDay[day.dayKey] ?? 0;
              return (
                <button
                  key={day.dayKey}
                  type="button"
                  onClick={() => {
                    setSelectedDayKey(day.dayKey);
                    setConflict(null);
                  }}
                  className={cn(
                    "flex min-h-[58px] flex-col items-center justify-center rounded-lg border px-1 py-1.5 transition-colors cursor-pointer",
                    active
                      ? "border-[#1E3A8A] bg-[#1E3A8A] text-white dark:border-blue-500 dark:bg-blue-600"
                      : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-sunken)]"
                  )}
                >
                  <span
                    className={cn(
                      "text-[10px]",
                      active ? "text-blue-100" : "text-[var(--text-muted)]"
                    )}
                  >
                    {day.weekdayLabel}
                  </span>
                  <span className="text-sm font-bold tabular-nums leading-tight">
                    {day.dayNumLabel}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] tabular-nums",
                      active ? "text-blue-100" : "text-[var(--text-muted)]"
                    )}
                  >
                    {busyCount > 0 ? `${formatArabicNumber(busyCount)} حصة` : day.monthLabel}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Live Daily Hall Timeline with Diagonal-Hatched 15m Buffers */}
          <div className="flex flex-1 flex-col rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-3">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-2">
              <span className="text-xs font-bold text-[var(--text-primary)]">
                جدول {selectedHall?.nameAr ?? "القاعة"}
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                {formatCairoDate(cairoWallTimeToIso(selectedDayKey, "12:00"))}
              </span>
            </div>

            {dayHallSessions.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-8 text-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  القاعة شاغرة طوال اليوم
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  يمكنك حجز أي فترة زمنية متاحة من القائمة المجاورة
                </p>
              </div>
            ) : (
              <div className="mt-2.5 flex flex-col gap-2">
                {dayHallSessions.map((s) => {
                  const bufferedEndIso = new Date(
                    new Date(s.endsAt).getTime() + s.bufferMinutes * 60_000
                  ).toISOString();
                  return (
                    <div
                      key={s.id}
                      className="overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
                    >
                      {/* Occupied Session Band */}
                      <div className="flex items-start justify-between gap-2 p-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[var(--text-primary)]">
                            {s.titleAr}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)] tabular-nums">
                            {formatCairoTimeRange(s.startsAt, s.endsAt)}
                          </p>
                        </div>
                        <Badge variant={s.isOwnSession ? "primary" : "neutral"} dir="ltr">
                          {s.teacherCode}
                        </Badge>
                      </div>

                      {/* 15m Diagonal-Hatched Buffer Band */}
                      <div
                        style={BUFFER_HATCH_STYLE}
                        className="flex items-center justify-between border-t border-amber-300/70 px-2.5 py-1 text-[10px] font-medium text-amber-800 dark:border-amber-500/30 dark:text-amber-300"
                      >
                        <span>
                          فاصل انتقال {formatArabicNumber(s.bufferMinutes)} دقيقة (تهوية وتفريغ)
                        </span>
                        <span className="font-mono tabular-nums" dir="ltr">
                          → {formatCairoTime(bufferedEndIso, { hour12: false, locale: "en-GB" })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 3: Time Slot Picker, Conflict Suggestions & Confirm */}
        <div className="flex flex-col justify-between gap-4 p-4 sm:p-5 lg:col-span-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                ٣ · اختيار التوقيت والتأكيد
              </span>
              <div
                className="inline-flex rounded-md border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-0.5"
                role="group"
                aria-label="تنسيق الساعة"
              >
                <button
                  type="button"
                  onClick={() => setHourFormat("12h")}
                  className={cn(
                    "min-h-[30px] rounded px-2 text-[11px] font-medium cursor-pointer",
                    hourFormat === "12h"
                      ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs"
                      : "text-[var(--text-muted)]"
                  )}
                >
                  ١٢ س
                </button>
                <button
                  type="button"
                  onClick={() => setHourFormat("24h")}
                  className={cn(
                    "min-h-[30px] rounded px-2 font-mono text-[11px] font-medium cursor-pointer",
                    hourFormat === "24h"
                      ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs"
                      : "text-[var(--text-muted)]"
                  )}
                  dir="ltr"
                >
                  24h
                </button>
              </div>
            </div>

            {/* Slot grid */}
            <div className="grid max-h-[320px] grid-cols-2 gap-1.5 overflow-y-auto pe-0.5">
              {SLOT_TIMES_24.map((time24) => {
                const { hallOverlap, teacherOverlap, startsAtIso } =
                  checkSlotConflict(time24);
                const hasConflict = hallOverlap || teacherOverlap;
                const isSelected = selectedTime24 === time24;
                const displayTime = formatCairoTime(startsAtIso, {
                  hour12: hourFormat === "12h",
                  locale: hourFormat === "24h" ? "en-GB" : "ar-EG",
                });

                return (
                  <button
                    key={time24}
                    type="button"
                    onClick={() => {
                      setSelectedTime24(time24);
                      setConflict(null);
                      setFormError(null);
                    }}
                    style={hasConflict && !isSelected ? CONFLICT_HATCH_STYLE : undefined}
                    className={cn(
                      "flex min-h-[44px] items-center justify-between gap-1.5 rounded-lg border px-2.5 py-2 text-start transition-colors cursor-pointer",
                      isSelected
                        ? hasConflict
                          ? "border-amber-600 bg-amber-50 dark:border-amber-500 dark:bg-amber-500/15"
                          : "border-[#1E3A8A] bg-blue-50/80 dark:border-blue-500 dark:bg-blue-500/15"
                        : hasConflict
                          ? "border-red-200 text-[var(--text-muted)] dark:border-red-500/25"
                          : "border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]"
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          hasConflict ? "bg-red-500" : "bg-emerald-500"
                        )}
                      />
                      <span
                        className={cn(
                          "text-xs font-semibold tabular-nums",
                          hourFormat === "24h" && "font-mono"
                        )}
                        dir={hourFormat === "24h" ? "ltr" : undefined}
                      >
                        {displayTime}
                      </span>
                    </span>
                    <span className="text-[10px] font-medium">
                      {hallOverlap
                        ? "مشغول"
                        : teacherOverlap
                          ? "تعارض"
                          : "متاح"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Slot Summary */}
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">الموعد المختار</span>
                <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                  {formatCairoTimeRange(activePreview.startsAtIso, activePreview.endsAtIso)}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[var(--text-muted)]">المدة والفاصل</span>
                <span className="text-[var(--text-secondary)] tabular-nums">
                  {formatDurationAr(durationMinutes)} + ١٥ دقيقة فاصل
                </span>
              </div>
              {(activePreview.hallOverlap || activePreview.teacherOverlap) && (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {activePreview.hallOverlap
                      ? "تنبيه: القاعة مشغولة أو ضمن فاصل الـ ١٥ دقيقة — عند الإرسال سيقترح النظام البديل المتاح."
                      : "تنبيه: لديك حصة أخرى في نفس التوقيت."}
                  </span>
                </p>
              )}
            </div>

            {/* Smart Conflict Resolution Box (from 23P01 SCHEDULE_CONFLICT) */}
            {conflict && (
              <div
                role="alert"
                className="flex flex-col gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3.5 dark:border-amber-500/40 dark:bg-amber-500/10"
              >
                <div className="flex items-start gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="leading-relaxed">{conflict.message}</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  {conflict.nextFreeSlotIso && (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      className="min-h-[44px] w-full justify-between"
                      onClick={() =>
                        conflict.nextFreeSlotIso &&
                        handleApplySuggestedTime(conflict.nextFreeSlotIso)
                      }
                      leftIcon={<Sparkles className="h-4 w-4" />}
                    >
                      <span>تطبيق البديل المقترح</span>
                      <span className="font-mono text-xs tabular-nums">
                        {formatCairoTime(conflict.nextFreeSlotIso)}
                      </span>
                    </Button>
                  )}

                  {conflict.alternativeHallCode && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] w-full justify-between"
                      onClick={() =>
                        conflict.alternativeHallCode &&
                        handleApplySuggestedHall(conflict.alternativeHallCode)
                      }
                      leftIcon={<Building2 className="h-4 w-4" />}
                    >
                      <span>تطبيق البديل المقترح (قاعة بديلة)</span>
                      <span className="font-mono text-xs" dir="ltr">
                        {conflict.alternativeHallCode}
                      </span>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {formError && (
              <div
                role="alert"
                className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
              >
                {formError}
              </div>
            )}

            {seriesSummary && (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                <p className="font-bold">
                  تم جدولة {formatArabicNumber(seriesSummary.createdCount)} حصة ضمن السلسلة
                </p>
                {seriesSummary.conflictDates.length > 0 && (
                  <p className="mt-1 font-mono text-[11px]" dir="ltr">
                    Conflict dates skipped: {seriesSummary.conflictDates.join(", ")}
                  </p>
                )}
              </div>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={submitting}
            className="min-h-[48px]"
            leftIcon={<Clock className="h-4 w-4" />}
          >
            {isWeeklySeries
              ? `إنشاء سلسلة (${formatArabicNumber(recurrenceWeeks)} أسابيع)`
              : "تثبيت وحجز المدرج"}
          </Button>
        </div>
      </form>
    </div>
  );
}
