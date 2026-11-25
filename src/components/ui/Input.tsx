"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  readonly label?: string;
  readonly hint?: string;
  readonly error?: string;
  readonly inputSize?: "md" | "lg";
  readonly startAdornment?: React.ReactNode;
  readonly endAdornment?: React.ReactNode;
  readonly containerClassName?: string;
}

/**
 * Accessible input primitive enforcing >= 16px text on interactive fields,
 * post-interaction validation feedback, and clear `aria-describedby` linking.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      hint,
      error,
      inputSize = "md",
      startAdornment,
      endAdornment,
      containerClassName,
      className,
      id,
      "aria-describedby": ariaDescribedBy,
      ...rest
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const msgId = `${inputId}-msg`;
    const hasMessage = Boolean(error || hint);
    const describedBy = [ariaDescribedBy, hasMessage ? msgId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

    return (
      <div className={cn("flex flex-col gap-1.5", containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-semibold text-[var(--text-primary)]"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {startAdornment && (
            <span className="pointer-events-none absolute inset-y-0 start-3.5 flex items-center text-[var(--text-muted)]">
              {startAdornment}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            data-error={error ? "true" : undefined}
            className={cn(
              "w-full border bg-[var(--bg-surface)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors duration-150",
              "focus:outline-none focus:ring-2 focus:ring-[#0B63CE]/25",
              error
                ? "border-red-600 focus:border-red-600"
                : "border-[var(--border-hairline)] focus:border-[#0B63CE] dark:focus:border-blue-400",
              inputSize === "lg"
                ? "h-[54px] rounded-xl px-4 text-base"
                : "min-h-[46px] rounded-xl px-3.5 text-base",
              startAdornment && "ps-11",
              endAdornment && "pe-11",
              className
            )}
            {...rest}
          />

          {endAdornment && (
            <span className="absolute inset-y-0 end-3.5 flex items-center text-[var(--text-muted)]">
              {endAdornment}
            </span>
          )}
        </div>

        {error ? (
          <p id={msgId} className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : hint ? (
          <p id={msgId} className="text-sm text-[var(--text-muted)]">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";

export interface SelectInputProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  readonly label?: string;
  readonly hint?: string;
  readonly error?: string;
  readonly inputSize?: "md" | "lg";
  readonly containerClassName?: string;
}

/**
 * Native RTL-safe select field matching Input sizing and accessible validation.
 */
export const SelectInput = React.forwardRef<HTMLSelectElement, SelectInputProps>(
  (
    {
      label,
      hint,
      error,
      inputSize = "md",
      containerClassName,
      className,
      id,
      "aria-describedby": ariaDescribedBy,
      children,
      ...rest
    },
    ref
  ) => {
    const generatedId = React.useId();
    const selectId = id ?? generatedId;
    const msgId = `${selectId}-msg`;
    const hasMessage = Boolean(error || hint);
    const describedBy = [ariaDescribedBy, hasMessage ? msgId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

    return (
      <div className={cn("flex flex-col gap-1.5", containerClassName)}>
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-semibold text-[var(--text-primary)]"
          >
            {label}
          </label>
        )}

        <select
          ref={ref}
          id={selectId}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          data-error={error ? "true" : undefined}
          className={cn(
            "w-full border bg-[var(--bg-surface)] text-base text-[var(--text-primary)] transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-[#0B63CE]/25",
            error
              ? "border-red-600 focus:border-red-600"
              : "border-[var(--border-hairline)] focus:border-[#0B63CE] dark:focus:border-blue-400",
            inputSize === "lg"
              ? "h-[54px] rounded-xl px-4 text-base"
              : "min-h-[46px] rounded-xl px-3.5 text-base",
            className
          )}
          {...rest}
        >
          {children}
        </select>

        {error ? (
          <p id={msgId} className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : hint ? (
          <p id={msgId} className="text-sm text-[var(--text-muted)]">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);

SelectInput.displayName = "SelectInput";
