import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
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
    "border border-[#1E3A8A] bg-[#1E3A8A] text-white hover:bg-[#1D4ED8] hover:border-[#1D4ED8] dark:border-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500",
  secondary:
    "border border-[var(--border-hairline)] bg-[var(--bg-sunken)] text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-slate-100 dark:hover:bg-slate-800/80",
  outline:
    "border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-sunken)]",
  ghost:
    "border border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-sunken)] hover:text-[var(--text-primary)]",
  danger:
    "border border-red-600 bg-red-600 text-white hover:bg-red-700 hover:border-red-700 dark:border-red-500 dark:bg-red-600 dark:hover:bg-red-500",
};

const SIZE_CLASSES: Readonly<Record<ButtonSize, string>> = {
  sm: "h-9 px-3 text-xs font-medium gap-1.5",
  md: "h-10 px-4 text-sm font-medium gap-2",
  lg: "h-12 px-5 text-sm font-semibold gap-2",
  icon: "h-10 w-10 p-0 justify-center",
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
    "inline-flex items-center justify-center rounded-lg whitespace-nowrap transition-colors duration-150 select-none cursor-pointer",
    "active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 focus-visible:ring-offset-1",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    options?.fullWidth && "w-full",
    options?.className
  );
}

/**
 * Crisp 8px-radius hairline button primitive for Modarrag.
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
