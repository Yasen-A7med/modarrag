"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Building2, MapPin, Radio } from "lucide-react";
import type { HallOccupancyData } from "@/application/halls/actions";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { HallStatus } from "@/infrastructure/supabase/database.types";
import { HALL_STATUS_TONES, type BadgeTone } from "@/lib/design-tokens";
import { formatArabicNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const HALL_STATUS_LABELS_AR: Readonly<Record<HallStatus, string>> = {
  active: "نشطة",
  maintenance: "صيانة",
  archived: "مؤرشفة",
};

function resolveHallStatus(status: HallStatus): {
  readonly label: string;
  readonly tone: BadgeTone;
} {
  return {
    label: HALL_STATUS_LABELS_AR[status],
    tone: HALL_STATUS_TONES[status],
  };
}

export interface HallGaugeRingProps {
  readonly booked: number;
  readonly capacity: number;
  readonly status: HallStatus;
  readonly size?: number;
}

/**
 * Animated SVG circular seat occupancy gauge for live hall monitoring.
 */
export function HallGaugeRing({
  booked,
  capacity,
  status,
  size = 84,
}: HallGaugeRingProps) {
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const rawPct = capacity > 0 ? Math.round((booked / capacity) * 100) : 0;
  const pct = Math.min(100, Math.max(0, rawPct));
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  const strokeColor =
    status !== "active"
      ? "#94A3B8"
      : pct >= 95
        ? "#DC2626"
        : pct >= 70
          ? "#D97706"
          : "#059669";

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-200 dark:text-slate-800"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-sm font-bold text-[var(--text-primary)] tabular-nums"
          dir="ltr"
        >
          {formatArabicNumber(pct, { useEasternDigits: false })}%
        </span>
      </div>
    </div>
  );
}

export interface LiveOccupancyBentoProps {
  readonly schoolSlug: string;
  readonly halls: HallOccupancyData["halls"];
  readonly title?: string;
  readonly showManageLink?: boolean;
}

/**
 * Bento grid displaying animated SVG seat occupancy gauges for all school halls.
 */
export function LiveOccupancyBento({
  schoolSlug,
  halls,
  title = "الإشغال الحي للقاعات والمدرجات",
  showManageLink = true,
}: LiveOccupancyBentoProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-base font-bold text-[var(--text-primary)]">{title}</h2>
        </div>
        {showManageLink && (
          <Link
            href={`/s/${schoolSlug}/admin/halls`}
            className="text-xs font-semibold text-[#1E3A8A] hover:underline dark:text-blue-400"
          >
            إدارة القاعات وإعادة التخصيص
          </Link>
        )}
      </div>

      {halls.length === 0 ? (
        <Card className="p-6 text-center">
          <Building2 className="mx-auto h-7 w-7 text-[var(--text-muted)]" />
          <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
            لم يتم تسجيل قاعات لهذه المدرسة بعد
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {halls.map((hall) => {
            const statusMeta = resolveHallStatus(hall.status);
            const hasActiveSession = hall.currentSessionId !== null;
            return (
              <Card
                key={hall.id}
                className={cn(
                  "flex flex-col justify-between gap-3 p-4",
                  hasActiveSession && "border-emerald-300/80 dark:border-emerald-500/35"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="mono" dir="ltr">
                        {hall.code}
                      </Badge>
                      <Badge variant={statusMeta.tone} dot={hall.status === "active"}>
                        {statusMeta.label}
                      </Badge>
                    </div>
                    <h3 className="mt-2 truncate text-sm font-bold text-[var(--text-primary)]">
                      {hall.nameAr}
                    </h3>
                    {(hall.buildingAr || hall.floorLabelAr) && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {[hall.buildingAr, hall.floorLabelAr].filter(Boolean).join(" · ")}
                        </span>
                      </p>
                    )}
                  </div>

                  <HallGaugeRing
                    booked={hall.currentBookedCount}
                    capacity={hall.maxCapacity}
                    status={hall.status}
                    size={76}
                  />
                </div>

                <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-3 py-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">الإشغال الحالي</span>
                    <span className="font-mono font-semibold text-[var(--text-primary)] tabular-nums">
                      {formatArabicNumber(hall.currentBookedCount)} /{" "}
                      {formatArabicNumber(hall.maxCapacity)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[11px] font-medium text-[var(--text-secondary)]">
                    {hall.currentSessionTitleAr
                      ? `جاري الآن: ${hall.currentSessionTitleAr}`
                      : "شاغرة حالياً — جاهزة للحجز"}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
