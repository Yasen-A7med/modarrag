import { Clock, Users } from "lucide-react";
import { formatArabicNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export interface SeatGaugeProps {
  readonly bookedSeatsCount: number;
  readonly maxCapacity: number;
  readonly bufferMinutes?: number;
  readonly status?: string;
  readonly compact?: boolean;
  readonly className?: string;
}

/**
 * Real-time remaining seat availability meter with emerald/amber/crimson state
 * and mandatory lecture-hall transition buffer indicator.
 */
export function SeatGauge({
  bookedSeatsCount,
  maxCapacity,
  bufferMinutes,
  status,
  compact = false,
  className,
}: SeatGaugeProps) {
  const safeCapacity = Math.max(1, maxCapacity);
  const clampedBooked = Math.max(0, Math.min(bookedSeatsCount, safeCapacity));
  const remaining = Math.max(0, maxCapacity - bookedSeatsCount);
  const ratio = clampedBooked / safeCapacity;
  const occupancyPct = Math.min(100, Math.round(ratio * 100));
  const isFull = remaining === 0 || status === "full";

  const tone = isFull || ratio >= 0.9
    ? {
        barClass: "bg-red-600 dark:bg-red-500",
        textClass: "text-red-700 dark:text-red-300",
        dotClass: "bg-red-600 dark:bg-red-500",
      }
    : ratio >= 0.7
      ? {
          barClass: "bg-amber-500 dark:bg-amber-400",
          textClass: "text-amber-700 dark:text-amber-300",
          dotClass: "bg-amber-500",
        }
      : {
          barClass: "bg-emerald-600 dark:bg-emerald-500",
          textClass: "text-emerald-700 dark:text-emerald-300",
          dotClass: "bg-emerald-500",
        };

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)]",
        compact ? "p-2.5" : "p-3",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", tone.dotClass)} aria-hidden="true" />
          <Users className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
          {isFull ? (
            <span className={tone.textClass}>مكتملة المقاعد — قائمة الانتظار متاحة</span>
          ) : (
            <span className="tabular-nums">
              متبقي{" "}
              <strong className={cn("font-bold", tone.textClass)}>
                {formatArabicNumber(remaining)}
              </strong>{" "}
              من {formatArabicNumber(maxCapacity)} مقعد
            </span>
          )}
        </span>

        <span className="font-mono text-[11px] font-semibold text-[var(--text-muted)] tabular-nums">
          {formatArabicNumber(occupancyPct)}٪ إشغال
        </span>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
        role="progressbar"
        aria-valuenow={occupancyPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="نسبة إشغال المقاعد"
      >
        <div
          className={cn("h-full transition-all duration-300", tone.barClass)}
          style={{ width: `${occupancyPct}%` }}
        />
      </div>

      {typeof bufferMinutes === "number" && bufferMinutes > 0 && (
        <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3 shrink-0" />
            <span className="tabular-nums">
              {formatArabicNumber(bufferMinutes)} دقيقة انتقال بين الحصص
            </span>
          </span>
          <span className="tabular-nums">
            محجوز {formatArabicNumber(clampedBooked)}/{formatArabicNumber(maxCapacity)}
          </span>
        </div>
      )}
    </div>
  );
}
