import * as React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly radius?: "sm" | "md" | "lg";
}

const RADIUS_MAP = {
  sm: "rounded-md",
  md: "rounded-lg",
  lg: "rounded-xl",
} as const;

export function Skeleton({
  radius = "md",
  className,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-slate-200/75 dark:bg-slate-800/75",
        RADIUS_MAP[radius],
        className
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

export function SkeletonRow({ className }: { readonly className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 shrink-0" radius="md" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-36" radius="sm" />
          <Skeleton className="h-3 w-24" radius="sm" />
        </div>
      </div>
      <Skeleton className="h-6 w-16" radius="sm" />
    </div>
  );
}

export function SkeletonCard({ className }: { readonly className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-28" radius="sm" />
        <Skeleton className="h-5 w-14" radius="sm" />
      </div>
      <Skeleton className="h-4 w-3/4" radius="sm" />
      <Skeleton className="h-10 w-full" radius="md" />
    </div>
  );
}
