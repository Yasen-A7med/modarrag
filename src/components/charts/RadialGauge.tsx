"use client";

import { motion } from "framer-motion";
import { formatArabicNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export interface RadialGaugeProps {
  readonly value: number;
  readonly max: number;
  readonly size?: number;
  readonly strokeWidth?: number;
  readonly mode?: "percentage" | "ratio";
  readonly tone?: "auto" | "cyan" | "blue" | "emerald" | "amber" | "muted";
  readonly centerSublabel?: string;
  readonly className?: string;
}

/**
 * Live animated SVG radial donut ring used across Student Session Cards,
 * Live Hall Occupancy monitors, and Ministry Executive gauges.
 */
export function RadialGauge({
  value,
  max,
  size = 64,
  strokeWidth = 6,
  mode = "percentage",
  tone = "auto",
  centerSublabel,
  className,
}: RadialGaugeProps) {
  const safeMax = Math.max(1, max);
  const ratio = Math.min(1, Math.max(0, value / safeMax));
  const pct = Math.round(ratio * 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - ratio * circumference;

  const resolvedStroke =
    tone === "cyan"
      ? "#22D3EE"
      : tone === "blue"
        ? "#2563EB"
        : tone === "emerald"
          ? "#16A34A"
          : tone === "amber"
            ? "#D97706"
            : tone === "muted"
              ? "#94A3B8"
              : pct >= 95
                ? "#DC2626"
                : pct >= 75
                  ? "#D97706"
                  : "#2563EB";

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center select-none",
        className
      )}
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
          className="text-slate-200/90 dark:text-slate-800"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={resolvedStroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
        {mode === "ratio" ? (
          <span
            className="text-[11px] font-extrabold text-[var(--text-primary)] tabular-nums"
            dir="ltr"
          >
            {value}/{max}
          </span>
        ) : (
          <span
            className={cn(
              "font-extrabold text-[var(--text-primary)] tabular-nums",
              size >= 110 ? "text-2xl" : size >= 76 ? "text-base" : "text-xs"
            )}
            dir="ltr"
          >
            {formatArabicNumber(pct, { useEasternDigits: false })}%
          </span>
        )}
        {centerSublabel && (
          <span className="mt-1 text-[10px] font-semibold text-[var(--text-muted)]">
            {centerSublabel}
          </span>
        )}
      </div>
    </div>
  );
}
