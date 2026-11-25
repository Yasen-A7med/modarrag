import * as React from "react";
import { cn } from "@/lib/utils";

export type CardVariant = "default" | "sunken" | "interactive" | "frame";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly variant?: CardVariant;
}

const CARD_VARIANTS: Readonly<Record<CardVariant, string>> = {
  default:
    "rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] hairline-lift",
  sunken:
    "rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)]",
  interactive:
    "rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] hairline-lift hover-lift-card",
  frame:
    "rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] hairline-lift",
};

/**
 * Clean 1px-hairline surface panel with warm Egyptian EdTech legibility.
 */
export function Card({ variant = "default", className, ...props }: CardProps) {
  return <div className={cn(CARD_VARIANTS[variant], className)} {...props} />;
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 p-5 sm:p-6", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-lg font-bold text-[var(--text-primary)] leading-snug",
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
      className={cn("text-sm text-[var(--text-secondary)] leading-relaxed", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5 sm:px-6 sm:pb-6", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-t border-[var(--border-hairline)] px-5 py-3.5 sm:px-6",
        className
      )}
      {...props}
    />
  );
}
