"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "info" | "warning";

export interface ToastInput {
  readonly title: string;
  readonly description?: string;
  readonly variant?: ToastVariant;
  readonly durationMs?: number;
}

interface ToastItem extends ToastInput {
  readonly id: string;
  readonly variant: ToastVariant;
}

interface ToastContextValue {
  readonly toast: (input: ToastInput) => void;
  readonly dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Readonly<Record<ToastVariant, string>> = {
  success:
    "border-emerald-300 bg-[var(--bg-surface)] text-[var(--text-primary)] dark:border-emerald-500/40",
  error:
    "border-red-300 bg-[var(--bg-surface)] text-[var(--text-primary)] dark:border-red-500/40",
  warning:
    "border-amber-300 bg-[var(--bg-surface)] text-[var(--text-primary)] dark:border-amber-500/40",
  info:
    "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)]",
};

function ToastIcon({ variant }: { readonly variant: ToastVariant }) {
  switch (variant) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />;
    case "error":
      return <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />;
    case "warning":
      return <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />;
    case "info":
    default:
      return <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />;
  }
}

export function ToastProvider({ children }: { readonly children: React.ReactNode }) {
  const [items, setItems] = React.useState<readonly ToastItem[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = React.useCallback(
    ({ title, description, variant = "info", durationMs = 4200 }: ToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setItems((prev) => [...prev.slice(-3), { id, title, description, variant }]);
      window.setTimeout(() => {
        dismiss(id);
      }, durationMs);
    },
    [dismiss]
  );

  const value = React.useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-20 start-4 end-4 z-50 flex flex-col gap-2 sm:bottom-5 sm:start-auto sm:end-5 sm:w-96"
        aria-live="polite"
        aria-atomic="true"
      >
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "pointer-events-auto flex items-start gap-2.5 rounded-xl border p-3.5 shadow-md",
                VARIANT_STYLES[item.variant]
              )}
              role="status"
            >
              <div className="mt-0.5">
                <ToastIcon variant={item.variant} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">{item.title}</p>
                {item.description && (
                  <p className="mt-0.5 text-xs text-[var(--text-muted)] leading-relaxed">
                    {item.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-sunken)] hover:text-[var(--text-primary)] cursor-pointer"
                aria-label="إخفاء التنبيه"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    return {
      toast: () => undefined,
      dismiss: () => undefined,
    };
  }
  return ctx;
}
