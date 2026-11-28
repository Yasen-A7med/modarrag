import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "navy"
  | "emerald"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly loading?: boolean;
  readonly leftIcon?: React.ReactNode;
  readonly rightIcon?: React.ReactNode;
  readonly fullWidth?: boolean;
}

const VARIANT_CLASSES: Readonly<Record<ButtonVariant, string>> = {
  primary:
    "border border-[#2563EB] bg-gradient-to-l from-[#1D4ED8] to-[#2563EB] text-white hover:from-[#1E40AF] hover:to-[#1D4ED8] hover:border-[#1E40AF] dark:border-blue-500 dark:from-blue-600 dark:to-blue-500 dark:hover:from-blue-500 dark:hover:to-blue-400",
  navy:
    "border border-[#0A1F44] bg-[#0A1F44] text-white hover:bg-[#132E5C] dark:border-blue-400/30 dark:bg-slate-900 dark:hover:bg-slate-800",
  emerald:
    "border border-[#16A34A] bg-gradient-to-l from-[#15803D] to-[#16A34A] text-white hover:from-[#166534] hover:to-[#15803D] hover:border-[#166534] dark:border-emerald-500 dark:from-emerald-600 dark:to-emerald-500 dark:hover:from-emerald-500 dark:hover:to-emerald-400",
  secondary:
    "border border-[var(--border-hairline)] bg-[var(--bg-sunken)] text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-slate-200/70 dark:hover:bg-slate-800/80",
  outline:
    "border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-sunken)]",
  ghost:
    "border border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-sunken)] hover:text-[var(--text-primary)]",
  danger:
    "border border-red-600 bg-red-600 text-white hover:bg-red-700 hover:border-red-700 dark:border-red-500 dark:bg-red-600 dark:hover:bg-red-500",
};

const SIZE_CLASSES: Readonly<Record<ButtonSize, string>> = {
  sm: "min-h-[44px] px-3.5 text-sm font-medium gap-1.5 rounded-xl",
  md: "min-h-[46px] px-4.5 text-sm font-semibold gap-2 rounded-xl",
  lg: "min-h-[52px] px-6 text-base font-bold gap-2.5 rounded-xl",
  icon: "h-11 w-11 p-0 justify-center rounded-xl",
};

export function buttonVariants(options?: {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly fullWidth?: boolean;
  readonly className?: string;
}): string {
  const variant = options?.variant ?? "primary";
  const size = options?.size ?? "md";

  return cn(
    "relative overflow-hidden inline-flex items-center justify-center whitespace-nowrap transition-[transform,background-color,border-color,box-shadow] duration-200 select-none cursor-pointer",
    (variant === "primary" || variant === "emerald") && "cta-shimmer shadow-sm hover:-translate-y-0.5 hover:shadow-md",
    "active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B63CE]/40 focus-visible:ring-offset-1",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    options?.fullWidth && "w-full",
    options?.className
  );
}

/**
 * High-contrast, large-touch-target button primitive built for effortless use by all ages.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className,
      children,
      type = "button",
      ...rest
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={buttonVariants({ variant, size, fullWidth, className })}
        {...rest}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {children}
        {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
