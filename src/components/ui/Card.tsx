import * as React from "react";
import { cn } from "@/lib/utils";

export type CardVariant = "default" | "sunken" | "interactive" | "frame";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly variant?: CardVariant;
}

const CARD_VARIANTS: Readonly<Record<CardVariant, string>> = {
  default:
    "rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] hairline-lift",
  sunken:
    "rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)]",
  interactive:
    "rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] hairline-lift transition-colors duration-150 hover:border-[var(--border-strong)]",
  frame:
    "rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] hairline-lift",
};

/**
 * Architectural 1px-hairline surface panel (12px standard / 16px frame ceiling).
 */
export function Card({ variant = "default", className, ...props }: CardProps) {
  return <div className={cn(CARD_VARIANTS[variant], className)} {...props} />;
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-4 sm:p-5", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-base font-semibold text-[var(--text-primary)] leading-snug",
        className
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-xs text-[var(--text-muted)] leading-relaxed", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pb-4 sm:px-5 sm:pb-5", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-t border-[var(--border-hairline)] px-4 py-3 sm:px-5",
        className
      )}
      {...props}
    />
  );
}
