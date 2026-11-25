"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export const SPRING_EASE = [0.22, 1, 0.36, 1] as const;

export const TACTILE_SPRING = {
  type: "spring",
  stiffness: 420,
  damping: 32,
  mass: 0.8,
} as const;

export interface MotionRevealProps extends HTMLMotionProps<"div"> {
  readonly delay?: number;
  readonly distance?: number;
  readonly once?: boolean;
}

/**
 * Immediate compositor entrance (smooth translateY + scale settle)
 * ensuring zero washed-out sections below the fold.
 */
export function MotionReveal({
  children,
  className,
  delay = 0,
  distance = 14,
  ...props
}: MotionRevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0.92, y: distance, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.38, delay, ease: SPRING_EASE }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

const STAGGER_CONTAINER = {
  hidden: { opacity: 1 },
  visible: (stagger = 0.04) => ({
    opacity: 1,
    transition: {
      staggerChildren: stagger,
      delayChildren: 0.02,
    },
  }),
};

const STAGGER_ITEM = {
  hidden: { opacity: 0.92, y: 12, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.36, ease: SPRING_EASE },
  },
};

export interface MotionStaggerGridProps extends HTMLMotionProps<"div"> {
  readonly stagger?: number;
}

export function MotionStaggerGrid({
  children,
  className,
  stagger = 0.04,
  ...props
}: MotionStaggerGridProps) {
  return (
    <motion.div
      variants={STAGGER_CONTAINER}
      custom={stagger}
      initial="hidden"
      animate="visible"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function MotionStaggerCard({
  children,
  className,
  ...props
}: HTMLMotionProps<"div">) {
  return (
    <motion.div
      variants={STAGGER_ITEM}
      whileHover={{ y: -4, transition: { duration: 0.22, ease: SPRING_EASE } }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export interface MotionMetricBarProps {
  readonly percentage: number;
  readonly barClassName?: string;
  readonly trackClassName?: string;
}

/**
 * Compositor-only (`scaleX`) fill bar anchored to RTL inline-start (`right center`).
 */
export function MotionMetricBar({
  percentage,
  barClassName,
  trackClassName,
}: MotionMetricBarProps) {
  const clamped = Math.max(0, Math.min(100, percentage)) / 100;

  return (
    <div
      className={cn(
        "h-2.5 w-full overflow-hidden rounded-full bg-slate-200/85 dark:bg-slate-800",
        trackClassName
      )}
    >
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: clamped }}
        transition={{ duration: 0.55, ease: SPRING_EASE }}
        style={{ transformOrigin: "right center" }}
        className={cn("h-full w-full rounded-full", barClassName)}
      />
    </div>
  );
}

export interface AnimatedTabOption<T extends string = string> {
  readonly id: T;
  readonly label: string;
  readonly badge?: string;
}

export interface AnimatedFilterTabsProps<T extends string = string> {
  readonly options: readonly AnimatedTabOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly layoutId: string;
  readonly ariaLabel: string;
  readonly activePillClassName?: string;
  readonly className?: string;
}

/**
 * Interruptible Framer Motion shared-layout segmented pill tabs.
 */
export function AnimatedFilterTabs<T extends string = string>({
  options,
  value,
  onChange,
  layoutId,
  ariaLabel,
  activePillClassName,
  className,
}: AnimatedFilterTabsProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto no-scrollbar rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-1.5",
        className
      )}
    >
      {options.map((opt) => {
        const isActive = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "relative inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-bold whitespace-nowrap transition-colors cursor-pointer select-none",
              isActive
                ? "text-white"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            {isActive && (
              <motion.span
                layoutId={layoutId}
                transition={TACTILE_SPRING}
                aria-hidden="true"
                className={cn(
                  "absolute inset-0 rounded-xl bg-[#254EDB] shadow-sm dark:bg-blue-600",
                  activePillClassName
                )}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
            {opt.badge && (
              <span
                className={cn(
                  "relative z-10 rounded-full px-2 py-0.5 text-xs tabular-nums",
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-[var(--bg-surface)] text-[var(--text-muted)]"
                )}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
