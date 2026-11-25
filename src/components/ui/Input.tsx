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
 * Accessible hairline input primitive supporting standard (40-44px)
 * and mobile thumb-friendly onboarding (52px) heights.
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
      ...rest
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div className={cn("flex flex-col gap-1.5", containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs sm:text-sm font-medium text-[var(--text-primary)]"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {startAdornment && (
            <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-[var(--text-muted)]">
              {startAdornment}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            aria-invalid={Boolean(error)}
            className={cn(
              "w-full border bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors duration-150",
              "focus:outline-none focus:ring-2 focus:ring-blue-600/20",
              error
                ? "border-red-500 focus:border-red-600"
                : "border-[var(--border-hairline)] focus:border-[#1E3A8A] dark:focus:border-blue-500",
              inputSize === "lg"
                ? "h-[52px] rounded-lg px-3.5 text-base"
                : "h-10 rounded-md px-3 text-sm",
              startAdornment && "ps-10",
              endAdornment && "pe-10",
              className
            )}
            {...rest}
          />

          {endAdornment && (
            <span className="absolute inset-y-0 end-3 flex items-center text-[var(--text-muted)]">
              {endAdornment}
            </span>
          )}
        </div>

        {error ? (
          <p className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : hint ? (
          <p className="text-xs text-[var(--text-muted)]">{hint}</p>
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
 * Native RTL-safe select field styled identically to Input.
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
      children,
      ...rest
    },
    ref
  ) => {
    const generatedId = React.useId();
    const selectId = id ?? generatedId;

    return (
      <div className={cn("flex flex-col gap-1.5", containerClassName)}>
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs sm:text-sm font-medium text-[var(--text-primary)]"
          >
            {label}
          </label>
        )}

        <select
          ref={ref}
          id={selectId}
          aria-invalid={Boolean(error)}
          className={cn(
            "w-full border bg-[var(--bg-surface)] text-[var(--text-primary)] transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-blue-600/20",
            error
              ? "border-red-500 focus:border-red-600"
              : "border-[var(--border-hairline)] focus:border-[#1E3A8A] dark:focus:border-blue-500",
            inputSize === "lg"
              ? "h-[52px] rounded-lg px-3.5 text-base"
              : "h-10 rounded-md px-3 text-sm",
            className
          )}
          {...rest}
        >
          {children}
        </select>

        {error ? (
          <p className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : hint ? (
          <p className="text-xs text-[var(--text-muted)]">{hint}</p>
        ) : null}
      </div>
    );
  }
);

SelectInput.displayName = "SelectInput";
