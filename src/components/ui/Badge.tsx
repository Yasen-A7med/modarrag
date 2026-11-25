import * as React from "react";
import type { BadgeTone } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  readonly variant?: BadgeTone;
  readonly size?: "sm" | "md";
  readonly dot?: boolean;
  readonly dotColorClass?: string;
}

const BADGE_VARIANTS: Readonly<Record<BadgeTone, string>> = {
  neutral:
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300",
  primary:
    "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-200",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200",
  warning:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200",
  danger:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200",
  info:
    "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-200",
  mono:
    "border-[var(--border-hairline)] bg-[var(--bg-sunken)] text-[var(--text-secondary)] font-mono",
};

const BADGE_SIZES = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-1 text-xs",
} as const;

/**
 * Compact 6px-radius architectural status/metadata chip.
 */
export function Badge({
  variant = "neutral",
  size = "sm",
  dot = false,
  dotColorClass,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-medium tabular-nums leading-none whitespace-nowrap",
        BADGE_VARIANTS[variant],
        BADGE_SIZES[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0",
            dotColorClass ??
              (variant === "success"
                ? "bg-emerald-500"
                : variant === "warning"
                  ? "bg-amber-500"
                  : variant === "danger"
                    ? "bg-red-500"
                    : variant === "info"
                      ? "bg-sky-500"
                      : "bg-current")
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
