"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Laptop,
  Lock,
  MapPin,
  Plus,
  Repeat,
  Wallet,
} from "lucide-react";
import {
  createSessionAction,
  createSessionSeriesAction,
  type TeacherConsoleData,
} from "@/application/sessions/actions";
import { MotionReveal } from "@/components/motion/MotionPrimitives";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, SelectInput } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { doBufferedSessionsOverlap } from "@/domain/booking/time-slots";
import { calculateSessionRevenueBreakdown } from "@/domain/finance/revenue";
import { formatArabicNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const SLOT_HOURS = [9, 11, 13, 15, 17, 19] as const;
const DURATION_OPTIONS = [60, 90, 120] as const;

function buildCairoDayIsoList(days = 7): readonly {
  readonly dateKey: string;
  readonly label: string;
  readonly weekday: string;
}[] {
  const list: { dateKey: string; label: string; weekday: string }[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() + i * 86_400_000);
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Cairo",
    }).format(d);
    const label = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
      timeZone: "Africa/Cairo",
      day: "numeric",
      month: "short",
    }).format(d);
    const weekday =
      i === 0
        ? "اليوم"
        : i === 1
          ? "غداً"
          : new Intl.DateTimeFormat("ar-EG", {
              timeZone: "Africa/Cairo",
              weekday: "short",
            }).format(d);
    list.push({ dateKey: key, label, weekday });
  }
  return list;
}

function buildCairoSlotStartIso(dateKey: string, hour: number): string {
  const padded = String(hour).padStart(2, "0");
  // Egypt standard offset +02:00 handles Cairo scheduling cleanly without UTC day shift
  return new Date(`${dateKey}T${padded}:00:00+02:00`).toISOString();
}

export interface CalHallBookingGridProps {
  readonly schoolSlug: string;
  readonly data: TeacherConsoleData;
}

/**
 * Slide 4 Blueprint: Teacher Timetable Matrix & Online Class Scheduler.
 * Supports Dual Delivery ('in_person' physical halls OR 'online' home streaming),
 * single/weekly recurrence, transparent 70/30 + 14% VAT revenue preview,
 * interactive hall-slot availability matrix, and automatic conflict resolution hints.
 */
export function CalHallBookingGrid({ schoolSlug, data }: CalHallBookingGridProps) {
  const router = useRouter();
  const { toast } = useToast();

  const days = React.useMemo(() => buildCairoDayIsoList(7), []);
  const [selectedDay, setSelectedDay] = React.useState(days[0]?.dateKey ?? "");
  const [deliveryMode, setDeliveryMode] = React.useState<"in_person" | "online">(
    "in_person"
  );
  const [bookingMode, setBookingMode] = React.useState<"single" | "series">("single");
  const [selectedHallId, setSelectedHallId] = React.useState(
    data.halls[0]?.id ?? ""
  );
  const [selectedHour, setSelectedHour] = React.useState<number>(11);
  const [subjectId, setSubjectId] = React.useState(data.subjects[0]?.id ?? "");
  const [titleAr, setTitleAr] = React.useState("");
  const [durationMinutes, setDurationMinutes] = React.useState<number>(90);
  const [recurrenceWeeks, setRecurrenceWeeks] = React.useState<number>(4);
  const [priceEgp, setPriceEgp] = React.useState<string>("0");
  const [meetingUrl, setMeetingUrl] = React.useState<string>("");
  const [maxCapacity, setMaxCapacity] = React.useState<string>("120");
  const [submitting, setSubmitting] = React.useState(false);
  const [conflictHint, setConflictHint] = React.useState<string | null>(null);

  const selectedHall = data.halls.find((h) => h.id === selectedHallId);
  const parsedPrice = Math.max(0, Number.parseInt(priceEgp || "0", 10) || 0);
  const sampleSeats =
    deliveryMode === "online"
      ? Number.parseInt(maxCapacity || "100", 10) || 100
      : (selectedHall?.maxCapacity ?? 40);

  const financePreview = calculateSessionRevenueBreakdown({
    priceEgp: parsedPrice,
    seatCount: sampleSeats,
    vatRatePct: data.financialPolicy.vatRatePct,
    teacherSharePct: data.financialPolicy.teacherSharePct,
    platformFeePct: data.financialPolicy.platformFeePct,
  });

  const activeSessions = React.useMemo(
    () => data.sessions.filter((s) => s.status !== "cancelled"),
    [data.sessions]
  );

  const checkHallSlotStatus = React.useCallback(
    (hallId: string, hour: number) => {
      if (!selectedDay) return { occupied: false, label: null as string | null };
      const startIso = buildCairoSlotStartIso(selectedDay, hour);
      const startDate = new Date(startIso);
      const endDate = new Date(startDate.getTime() + durationMinutes * 60_000);
      const candidate = { startsAt: startDate, endsAt: endDate, bufferMinutes: 15 };

      const blocking = activeSessions.find(
        (s) =>
          s.hallId === hallId &&
          doBufferedSessionsOverlap(candidate, {
            startsAt: s.startsAt,
            endsAt: s.endsAt,
            bufferMinutes: s.bufferMinutes,
          })
      );

      if (blocking) {
        return { occupied: true, label: blocking.subjectNameAr };
      }
      return { occupied: false, label: null };
    },
    [activeSessions, durationMinutes, selectedDay]
  );

  const handleSelectMatrixSlot = (hallId: string, hour: number) => {
    setDeliveryMode("in_person");
    setSelectedHallId(hallId);
    setSelectedHour(hour);
    setConflictHint(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setConflictHint(null);
    if (!subjectId) {
      toast({
        title: "لا توجد مواد معتمدة",
        description: "تواصل مع إدارة المدرسة لتعيين موادك الدراسية أولاً.",
        variant: "error",
      });
      return;
    }

    setSubmitting(true);
    try {
      const startsAtIso = buildCairoSlotStartIso(selectedDay, selectedHour);
      const parsedOnlineCap = Math.max(
        10,
        Math.min(500, Number.parseInt(maxCapacity || "150", 10) || 150)
      );

      if (bookingMode === "single") {
        const res = await createSessionAction({
          schoolSlug,
          hallId: deliveryMode === "online" ? null : selectedHallId,
          subjectId,
          titleAr: titleAr.trim(),
          startsAtIso,
          durationMinutes,
          maxCapacity:
            deliveryMode === "online" ? parsedOnlineCap : selectedHall?.maxCapacity,
          deliveryMode,
          meetingUrl: deliveryMode === "online" ? meetingUrl.trim() || null : null,
          priceEgp: parsedPrice,
        });

        if (!res.ok) {
          if (res.error.code === "SCHEDULE_CONFLICT") {
            setConflictHint(res.error.message);
          }
          toast({
            title: "تعذر جدولة الحصة",
            description: res.error.message,
            variant: "error",
          });
          return;
        }

        toast({
          title:
            deliveryMode === "online"
              ? "تم نشر الحصة الأونلاين ✓"
              : "تم حجز القاعة وإعلان الحصة ✓",
          variant: "success",
        });
      } else {
        const res = await createSessionSeriesAction({
          schoolSlug,
          hallId: deliveryMode === "online" ? null : selectedHallId,
          subjectId,
          titleAr: titleAr.trim(),
          startsAtIso,
          durationMinutes,
          recurrenceWeeks,
          maxCapacity:
            deliveryMode === "online" ? parsedOnlineCap : selectedHall?.maxCapacity,
          deliveryMode,
          meetingUrl: deliveryMode === "online" ? meetingUrl.trim() || null : null,
          priceEgp: parsedPrice,
        });

        if (!res.ok) {
          toast({
            title: "تعذر جدولة السلسلة",
            description: res.error.message,
            variant: "error",
          });
          return;
        }

        toast({
          title: `تم جدولة ${formatArabicNumber(res.data.createdCount)} حصص بنجاح ✓`,
          description:
            res.data.conflictDates.length > 0
              ? `تعارضت ${formatArabicNumber(res.data.conflictDates.length)} تواريخ وتم تخطيها`
              : undefined,
          variant: "success",
        });
      }

      setTitleAr("");
      router.push(`/s/${schoolSlug}/teacher`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Controls Bar */}
      <MotionReveal className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 hairline-lift">
        <div>
          <Badge variant="info" size="md">
            حضوري بالمدرجات · بث أونلاين
          </Badge>
          <h1 className="mt-2 text-2xl font-extrabold text-[var(--text-primary)]">
            جدولة وحجز القاعات
          </h1>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
            اختر توقيتاً متاحاً من المصفوفة أو أطلق حصة أونلاين مباشرة
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Delivery Mode Switch */}
          <div className="inline-flex rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-1">
            <button
              type="button"
              onClick={() => setDeliveryMode("in_person")}
              className={cn(
                "inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-xs font-bold cursor-pointer",
                deliveryMode === "in_person"
                  ? "bg-[#0A1F44] text-white dark:bg-blue-600"
                  : "text-[var(--text-secondary)]"
              )}
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>قاعة مدرسية</span>
            </button>
            <button
              type="button"
              onClick={() => setDeliveryMode("online")}
              className={cn(
                "inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-xs font-bold cursor-pointer",
                deliveryMode === "online"
                  ? "bg-[#2563EB] text-white"
                  : "text-[var(--text-secondary)]"
              )}
            >
              <Laptop className="h-3.5 w-3.5" />
              <span>أونلاين من البيت</span>
            </button>
          </div>

          {/* Single / Weekly Toggle */}
          <div className="inline-flex rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-1">
            <button
              type="button"
              onClick={() => setBookingMode("single")}
              className={cn(
                "inline-flex min-h-[40px] items-center gap-1 rounded-lg px-3 text-xs font-bold cursor-pointer",
                bookingMode === "single"
                  ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs"
                  : "text-[var(--text-secondary)]"
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>حصة مفردة</span>
            </button>
            <button
              type="button"
              onClick={() => setBookingMode("series")}
              className={cn(
                "inline-flex min-h-[40px] items-center gap-1 rounded-lg px-3 text-xs font-bold cursor-pointer",
                bookingMode === "series"
                  ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs"
                  : "text-[var(--text-secondary)]"
              )}
            >
              <Repeat className="h-3.5 w-3.5" />
              <span>تكرار أسبوعي</span>
            </button>
          </div>
        </div>
      </MotionReveal>

      {/* 7-Day Selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map((d) => {
          const active = selectedDay === d.dateKey;
          return (
            <button
              key={d.dateKey}
              type="button"
              onClick={() => setSelectedDay(d.dateKey)}
              className={cn(
                "flex min-h-[60px] min-w-[92px] shrink-0 flex-col items-center justify-center rounded-2xl border px-3 py-2 text-xs font-bold transition-all cursor-pointer",
                active
                  ? "border-[#2563EB] bg-[#2563EB] text-white shadow-sm"
                  : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
              )}
            >
              <span>{d.weekday}</span>
              <span className="mt-0.5 text-[11px] opacity-90">{d.label}</span>
            </button>
          );
        })}
      </div>

      {/* Slide 4 Blueprint: Interactive Hall × Time Slot Matrix */}
      {deliveryMode === "in_person" && (
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-[var(--border-hairline)] pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4 text-[#2563EB] dark:text-cyan-300" />
                <span>مصفوفة إتاحة القاعات والأوقات</span>
              </CardTitle>
              <div className="flex items-center gap-3 text-[11px] font-semibold text-[var(--text-muted)]">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-xs border border-cyan-500 bg-cyan-400/20" />
                  متاحة
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-xs border border-[#2563EB] bg-[#2563EB]" />
                  اختيارك
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-xs bg-slate-300 dark:bg-slate-700" />
                  محجوزة
                </span>
              </div>
            </div>
          </CardHeader>

          <div
            tabIndex={0}
            role="region"
            aria-label="مصفوفة القاعات والأوقات"
            className="table-wrapper"
          >
            <table className="w-full min-w-[640px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] bg-[var(--bg-sunken)]">
                  <th className="sticky start-0 z-10 bg-[var(--bg-sunken)] px-4 py-3 text-start font-extrabold text-[var(--text-primary)]">
                    القاعة / السعة
                  </th>
                  {SLOT_HOURS.map((hour) => (
                    <th
                      key={hour}
                      className="px-2.5 py-3 text-center font-bold text-[var(--text-secondary)] tabular-nums"
                    >
                      {hour > 12 ? `${formatArabicNumber(hour - 12)}:00 م` : `${formatArabicNumber(hour)}:00 ص`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {data.halls.map((hall) => (
                  <tr key={hall.id}>
                    <th className="sticky start-0 z-10 bg-[var(--bg-surface)] px-4 py-3 text-start">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[var(--text-primary)]">
                          {hall.nameAr}
                        </span>
                        <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 text-[11px] font-bold text-cyan-800 dark:text-cyan-300 tabular-nums">
                          {formatArabicNumber(hall.maxCapacity)} مقعد
                        </span>
                      </div>
                    </th>

                    {SLOT_HOURS.map((hour) => {
                      const slot = checkHallSlotStatus(hall.id, hour);
                      const isSelected =
                        selectedHallId === hall.id && selectedHour === hour;
                      return (
                        <td key={hour} className="p-1.5 text-center">
                          {slot.occupied ? (
                            <div
                              className="slot-locked-hatch flex min-h-[46px] flex-col items-center justify-center rounded-xl border border-[var(--border-hairline)] px-2 py-1 text-[11px] text-[var(--text-muted)]"
                              title={slot.label ?? "مشغول"}
                            >
                              <Lock className="h-3.5 w-3.5" />
                              <span className="mt-0.5 max-w-[78px] truncate">
                                {slot.label}
                              </span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSelectMatrixSlot(hall.id, hour)}
                              className={cn(
                                "flex min-h-[46px] w-full flex-col items-center justify-center rounded-xl border text-[11px] font-bold transition-all cursor-pointer",
                                isSelected
                                  ? "border-[#2563EB] bg-[#2563EB] text-white shadow-sm ring-2 ring-cyan-300/60"
                                  : "border-cyan-400/40 bg-cyan-50/40 text-cyan-900 hover:border-cyan-500 hover:bg-cyan-100/60 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200"
                              )}
                            >
                              {isSelected ? (
                                <>
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span>مختار</span>
                                </>
                              ) : (
                                <span>متاح</span>
                              )}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Booking Details Form */}
      <Card>
        <CardHeader className="border-b border-[var(--border-hairline)] pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-5 w-5 text-[#2563EB]" />
            <span>
              {deliveryMode === "online"
                ? "تفاصيل الحصة الأونلاين"
                : `تأكيد الحجز — ${selectedHall?.nameAr ?? "اختر قاعة"}`}
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {conflictHint && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <span>{conflictHint}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SelectInput
                label="المادة الدراسية"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                {data.subjects.map((subj) => (
                  <option key={subj.id} value={subj.id}>
                    {subj.nameAr}
                  </option>
                ))}
              </SelectInput>

              <Input
                label="عنوان الحصة"
                required
                placeholder="مثال: مراجعة الجبر والهندسة الفراغية"
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
              />

              <SelectInput
                label="الساعة (بتوقيت القاهرة)"
                value={String(selectedHour)}
                onChange={(e) => setSelectedHour(Number(e.target.value))}
              >
                {SLOT_HOURS.map((h) => (
                  <option key={h} value={String(h)}>
                    {h > 12 ? `${formatArabicNumber(h - 12)}:00 م` : `${formatArabicNumber(h)}:00 ص`}
                  </option>
                ))}
              </SelectInput>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <SelectInput
                label="مدة الحصة"
                value={String(durationMinutes)}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
              >
                {DURATION_OPTIONS.map((m) => (
                  <option key={m} value={String(m)}>
                    {formatArabicNumber(m)} دقيقة
                  </option>
                ))}
              </SelectInput>

              <Input
                label="سعر المقعد (ج.م — 0 للمجانية)"
                type="number"
                min={0}
                max={10000}
                dir="ltr"
                value={priceEgp}
                onChange={(e) => setPriceEgp(e.target.value)}
                startAdornment={<Wallet className="h-4 w-4" />}
              />

              {bookingMode === "series" ? (
                <SelectInput
                  label="عدد الأسابيع المتكررة"
                  value={String(recurrenceWeeks)}
                  onChange={(e) => setRecurrenceWeeks(Number(e.target.value))}
                >
                  <option value="2">أسبوعان</option>
                  <option value="4">٤ أسابيع (شهر)</option>
                  <option value="8">٨ أسابيع</option>
                </SelectInput>
              ) : deliveryMode === "online" ? (
                <Input
                  label="أقصى عدد للطلاب أونلاين"
                  type="number"
                  min={10}
                  max={500}
                  dir="ltr"
                  value={maxCapacity}
                  onChange={(e) => setMaxCapacity(e.target.value)}
                />
              ) : (
                <SelectInput
                  label="القاعة المختارة"
                  value={selectedHallId}
                  onChange={(e) => setSelectedHallId(e.target.value)}
                >
                  {data.halls.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.nameAr} ({formatArabicNumber(h.maxCapacity)} مقعد)
                    </option>
                  ))}
                </SelectInput>
              )}
            </div>

            {deliveryMode === "online" && (
              <Input
                label="رابط البث المباشر (Zoom / Google Meet — اختياري الآن)"
                type="url"
                dir="ltr"
                placeholder="https://meet.google.com/..."
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                startAdornment={<Laptop className="h-4 w-4" />}
              />
            )}

            {parsedPrice > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#22D3EE]/35 bg-cyan-50/40 px-4 py-3 text-xs dark:bg-cyan-950/20">
                <span className="font-bold text-[var(--text-primary)]">
                  السعر للطالب شامل {formatArabicNumber(data.financialPolicy.vatRatePct)}٪ VAT:{" "}
                  <strong className="text-[#2563EB] dark:text-cyan-300 tabular-nums">
                    {formatArabicNumber(financePreview.studentPayablePerSeatEgp)} ج.م
                  </strong>
                </span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  متوقع صافي المعلم ({formatArabicNumber(data.financialPolicy.teacherSharePct)}٪ عند اكتمال السعة):{" "}
                  {formatArabicNumber(financePreview.teacherNetEgp)} ج.م
                </span>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting}
              leftIcon={<CheckCircle2 className="h-5 w-5" />}
            >
              {bookingMode === "series"
                ? "اعتماد وجدولة السلسلة الأسبوعية"
                : deliveryMode === "online"
                  ? "إطلاق الحصة الأونلاين"
                  : "تأكيد حجز المدرج والحصة"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
