"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpLeft,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  QrCode,
  ShieldCheck,
  Users,
} from "lucide-react";
import { TrackIcon } from "@/components/brand/TrackIcon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getTrackStyle, MOTION_SPRINGS } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

export interface PreviewTrackOption {
  readonly code: string;
  readonly nameAr: string;
  readonly iconKey: string;
  readonly subjectAr: string;
  readonly teacherCode: string;
  readonly hallAr: string;
  readonly capacity: number;
  readonly booked: number;
  readonly seatCode: string;
  readonly ticketRef: string;
  readonly slots: ReadonlyArray<{
    readonly id: string;
    readonly time12: string;
    readonly time24: string;
    readonly shiftLabel: string;
    readonly remaining: number;
  }>;
}

const PREVIEW_TRACKS: readonly PreviewTrackOption[] = [
  {
    code: "ENG_TRACK",
    nameAr: "مسار الهندسة",
    iconKey: "cpu",
    subjectAr: "البرمجة والخوارزميات",
    teacherCode: "معلم البرمجة · كود T-101",
    hallAr: "معمل الحاسب · مدرج فرعي",
    capacity: 30,
    booked: 18,
    seatCode: "S-019",
    ticketRef: "MDRG-2026-0419",
    slots: [
      { id: "eng-1", time12: "٠٤:٠٠ م", time24: "16:00", shiftLabel: "الفترة المسائية", remaining: 12 },
      { id: "eng-2", time12: "٠٦:٠٠ م", time24: "18:00", shiftLabel: "مجموعة المراجعة", remaining: 7 },
      { id: "eng-3", time12: "١٠:٠٠ ص", time24: "10:00", shiftLabel: "الفترة الصباحية", remaining: 19 },
    ],
  },
  {
    code: "MED_TRACK",
    nameAr: "طب وعلوم الحياة",
    iconKey: "microscope",
    subjectAr: "الفيزياء والرياضيات",
    teacherCode: "معلم الفيزياء · كود T-102",
    hallAr: "مدرج ٢ · المبنى الرئيسي",
    capacity: 50,
    booked: 38,
    seatCode: "S-039",
    ticketRef: "MDRG-2026-0522",
    slots: [
      { id: "med-1", time12: "٠٦:٠٠ م", time24: "18:00", shiftLabel: "الفترة المسائية", remaining: 12 },
      { id: "med-2", time12: "٠٢:٠٠ م", time24: "14:00", shiftLabel: "الفترة الظهيرة", remaining: 5 },
      { id: "med-3", time12: "٠٩:٠٠ ص", time24: "09:00", shiftLabel: "الفترة الصباحية", remaining: 24 },
    ],
  },
  {
    code: "BUS_TRACK",
    nameAr: "مسار الأعمال",
    iconKey: "briefcase",
    subjectAr: "إدارة الأعمال والمحاسبة",
    teacherCode: "معلم الأعمال · كود T-105",
    hallAr: "مدرج ١ · الدور الأول",
    capacity: 60,
    booked: 41,
    seatCode: "S-042",
    ticketRef: "MDRG-2026-0614",
    slots: [
      { id: "bus-1", time12: "٠٣:٣٠ م", time24: "15:30", shiftLabel: "الفترة المسائية", remaining: 19 },
      { id: "bus-2", time12: "٠٥:٣٠ م", time24: "17:30", shiftLabel: "ورشة التطبيق", remaining: 9 },
      { id: "bus-3", time12: "١١:٠٠ ص", time24: "11:00", shiftLabel: "الفترة الصباحية", remaining: 28 },
    ],
  },
  {
    code: "ART_TRACK",
    nameAr: "الآداب والفنون",
    iconKey: "book-open",
    subjectAr: "علم النفس واللغة الثانية",
    teacherCode: "معلم اللغة العربية · كود T-103",
    hallAr: "قاعة ١٠٤ · جناح العلوم",
    capacity: 35,
    booked: 21,
    seatCode: "S-022",
    ticketRef: "MDRG-2026-0708",
    slots: [
      { id: "art-1", time12: "٠٤:٠٠ م", time24: "16:00", shiftLabel: "الفترة المسائية", remaining: 14 },
      { id: "art-2", time12: "٠٦:٠٠ م", time24: "18:00", shiftLabel: "اللغة الإيطالية", remaining: 11 },
      { id: "art-3", time12: "١٢:٠٠ م", time24: "12:00", shiftLabel: "الفترة الصباحية", remaining: 18 },
    ],
  },
];

const CAIRO_DAYS = [
  { key: "sun", label: "الأحد", dayNum: "٢٢" },
  { key: "mon", label: "الإثنين", dayNum: "٢٣" },
  { key: "tue", label: "الثلاثاء", dayNum: "٢٤" },
  { key: "wed", label: "الأربعاء", dayNum: "٢٥" },
  { key: "thu", label: "الخميس", dayNum: "٢٦" },
  { key: "sat", label: "السبت", dayNum: "٢٨" },
] as const;

const QR_MATRIX_CELLS = [
  1, 1, 1, 0, 1, 0, 1, 1, 1,
  1, 0, 1, 1, 0, 1, 1, 0, 1,
  1, 1, 1, 0, 1, 0, 1, 1, 1,
  0, 1, 0, 1, 1, 1, 0, 1, 0,
  1, 0, 1, 1, 0, 1, 1, 0, 1,
  0, 1, 0, 0, 1, 0, 0, 1, 0,
  1, 1, 1, 0, 1, 1, 1, 0, 1,
  1, 0, 1, 1, 0, 0, 1, 1, 0,
  1, 1, 1, 0, 1, 1, 0, 1, 1,
] as const;

/**
 * Interactive Cal.com-inspired 3-column live booking preview built with crisp HTML/SVG UI.
 * Strictly zero fake screenshots, zero blur orbs, and zero human personal names.
 */
export function LiveBookingPreview() {
  const [selectedTrackCode, setSelectedTrackCode] = React.useState<string>("ENG_TRACK");
  const [selectedDayKey, setSelectedDayKey] = React.useState<string>("tue");
  const [selectedSlotIdx, setSelectedSlotIdx] = React.useState<number>(0);
  const [hourFormat, setHourFormat] = React.useState<"12h" | "24h">("12h");
  const [isConfirmedPreview, setIsConfirmedPreview] = React.useState<boolean>(false);

  const activeTrack =
    PREVIEW_TRACKS.find((t) => t.code === selectedTrackCode) ?? PREVIEW_TRACKS[0]!;
  const activeSlot = activeTrack.slots[selectedSlotIdx] ?? activeTrack.slots[0]!;
  const activeDay = CAIRO_DAYS.find((d) => d.key === selectedDayKey) ?? CAIRO_DAYS[2]!;
  const trackStyle = getTrackStyle(activeTrack.code);

  const handleTrackChange = (code: string) => {
    setSelectedTrackCode(code);
    setSelectedSlotIdx(0);
    setIsConfirmedPreview(false);
  };

  return (
    <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2 sm:p-3 hairline-lift">
      {/* Top Window Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] px-2.5 pb-2.5">
        <div className="flex items-center gap-2">
          <Badge variant="success" dot>
            بث جدولة مباشر
          </Badge>
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            مدرسة علي بن أبي طالب الثانوية بنين
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="mono" dir="ltr">
            Africa/Cairo
          </Badge>
          <Badge variant="neutral">فاصل ١٥ دقيقة</Badge>
        </div>
      </div>

      {/* 3-Column Cal.com Split Grid */}
      <div className="mt-2.5 grid grid-cols-1 divide-y divide-[var(--border-hairline)] overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] lg:grid-cols-12 lg:divide-y-0 lg:divide-x lg:divide-x-reverse">
        {/* Column 1: Track & Session Metadata */}
        <div className="flex flex-col justify-between gap-4 bg-[var(--bg-surface)] p-4 lg:col-span-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                ١ · المسار التخصصي
              </span>
              <span className="font-mono text-[11px] text-[var(--text-muted)]" dir="ltr">
                SEC_2_BACC
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {PREVIEW_TRACKS.map((track) => {
                const isSelected = track.code === activeTrack.code;
                const style = getTrackStyle(track.code);
                return (
                  <button
                    key={track.code}
                    type="button"
                    onClick={() => handleTrackChange(track.code)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-start text-xs font-medium transition-colors cursor-pointer",
                      isSelected
                        ? cn("bg-[var(--bg-sunken)] text-[var(--text-primary)]", style.activeBorderClass)
                        : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                    )}
                  >
                    <TrackIcon trackCode={track.code} size="sm" className="h-6 w-6 rounded-md" />
                    <span className="truncate">{track.nameAr}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-[var(--text-primary)]">
                  {activeTrack.subjectAr}
                </span>
                <span
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[11px] font-medium",
                    trackStyle.badgeClass
                  )}
                >
                  {trackStyle.shortLabelAr}
                </span>
              </div>
              <div className="mt-2.5 flex flex-col gap-1.5 text-xs text-[var(--text-secondary)]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                  <span>{activeTrack.teacherCode}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                  <span>{activeTrack.hallAr}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                  <span className="tabular-nums">
                    سعة القاعة: {activeTrack.capacity} مقعد · مدة ٩٠ دقيقة
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border-hairline)] pt-3 text-[11px] text-[var(--text-muted)]">
            <span>حماية تداخل القاعات</span>
            <span className="font-mono" dir="ltr">
              GiST +15m
            </span>
          </div>
        </div>

        {/* Column 2: Cairo Date Grid */}
        <div className="flex flex-col justify-between gap-4 bg-[var(--bg-surface)] p-4 lg:col-span-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                ٢ · اختيار اليوم الدراسي
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-primary)]">
                <Calendar className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                نوفمبر ٢٠٢٦
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {CAIRO_DAYS.map((day) => {
                const active = day.key === selectedDayKey;
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => {
                      setSelectedDayKey(day.key);
                      setIsConfirmedPreview(false);
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-lg border py-2.5 transition-colors cursor-pointer",
                      active
                        ? "border-[#1E3A8A] bg-[#1E3A8A] text-white dark:border-blue-500 dark:bg-blue-600"
                        : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-sunken)]"
                    )}
                  >
                    <span
                      className={cn(
                        "text-[11px]",
                        active ? "text-blue-100" : "text-[var(--text-muted)]"
                      )}
                    >
                      {day.label}
                    </span>
                    <span className="mt-0.5 text-base font-bold tabular-nums">
                      {day.dayNum}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Ticket Preview / Gate Pass Strip */}
          <AnimatePresence mode="wait">
            {isConfirmedPreview ? (
              <motion.div
                key={`ticket-${activeTrack.code}-${selectedSlotIdx}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={MOTION_SPRINGS.subtle}
                className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3 dark:border-emerald-500/35 dark:bg-emerald-500/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>معاينة تذكرة الدخول</span>
                    </div>
                    <p
                      className="mt-1 font-mono text-xs font-semibold text-[var(--text-primary)]"
                      dir="ltr"
                    >
                      {activeTrack.ticketRef}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--text-secondary)] tabular-nums">
                      مقعد {activeTrack.seatCode} · طالب ٢ بكالوريا · كود S-201
                    </p>
                  </div>
                  {/* Real crisp SVG matrix QR mark */}
                  <div
                    className="grid grid-cols-9 gap-[1.5px] rounded-md border border-[var(--border-hairline)] bg-white p-1.5"
                    aria-label="نموذج رمز الاستجابة السريعة"
                  >
                    {QR_MATRIX_CELLS.map((cell, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          "h-1 w-1",
                          cell === 1 ? "bg-slate-900" : "bg-transparent"
                        )}
                      />
                    ))}
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-dashed border-emerald-300 pt-2 dark:border-emerald-500/30">
                  <span className="text-[11px] text-emerald-800 dark:text-emerald-300">
                    {activeDay.label} {activeDay.dayNum} ·{" "}
                    {hourFormat === "12h" ? activeSlot.time12 : activeSlot.time24}
                  </span>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E3A8A] hover:underline dark:text-blue-400"
                  >
                    <span>احجز فعلياً</span>
                    <ArrowUpLeft className="h-3 w-3" />
                  </Link>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="ticket-placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-sunken)] p-3"
              >
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                  <QrCode className="h-4 w-4 text-[var(--text-muted)]" />
                  <span>اختر موعداً لمعاينة تذكرة البوابة الفورية</span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-[var(--text-muted)]" dir="ltr">
                  HMAC-SHA256 · v1.ticket.signed
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Column 3: Available Time Slots + Confirm Action */}
        <div className="flex flex-col justify-between gap-4 bg-[var(--bg-surface)] p-4 lg:col-span-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                ٣ · المواعيد المتاحة
              </span>
              <div
                className="inline-flex rounded-md border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-0.5"
                role="group"
                aria-label="تنسيق الوقت"
              >
                <button
                  type="button"
                  onClick={() => setHourFormat("12h")}
                  className={cn(
                    "rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
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
                    "rounded px-2 py-0.5 font-mono text-[11px] font-medium transition-colors cursor-pointer",
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

            <div className="mt-3 flex flex-col gap-2">
              {activeTrack.slots.map((slot, index) => {
                const selected = index === selectedSlotIdx;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => {
                      setSelectedSlotIdx(index);
                      setIsConfirmedPreview(false);
                    }}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-3 py-2.5 text-start transition-colors cursor-pointer",
                      selected
                        ? "border-[#1E3A8A] bg-blue-50/70 dark:border-blue-500 dark:bg-blue-500/15"
                        : "border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
                          {hourFormat === "12h" ? slot.time12 : slot.time24}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {slot.shiftLabel}
                        </p>
                      </div>
                    </div>

                    <Badge variant={selected ? "primary" : "neutral"} size="sm">
                      {slot.remaining} متاح
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              fullWidth
              onClick={() => setIsConfirmedPreview(true)}
              leftIcon={<Clock className="h-4 w-4" />}
            >
              تثبيت المعاينة
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
