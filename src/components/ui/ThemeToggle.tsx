"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ThemeToggleProps {
  readonly className?: string;
}

const STORAGE_KEY = "modarrag-theme";

function subscribeToDarkClass(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getDarkSnapshot(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Light/dark theme switcher synced with `.dark` class and localStorage.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const isDark = React.useSyncExternalStore(
    subscribeToDarkClass,
    getDarkSnapshot,
    getServerSnapshot
  );

  const toggleTheme = React.useCallback(() => {
    const root = document.documentElement;
    const nextDark = !root.classList.contains("dark");
    root.classList.toggle("dark", nextDark);
    root.style.colorScheme = nextDark ? "dark" : "light";
    try {
      window.localStorage.setItem(STORAGE_KEY, nextDark ? "dark" : "light");
    } catch {
      // Ignore storage access errors in restricted contexts.
    }
  }, []);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-hairline)]",
        "bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors duration-150 cursor-pointer",
        "hover:border-[var(--border-strong)] hover:bg-[var(--bg-sunken)] hover:text-[var(--text-primary)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40",
        className
      )}
      aria-label={isDark ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي"}
      title={isDark ? "الوضع النهاري" : "الوضع الليلي"}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400" strokeWidth={1.85} />
      ) : (
        <Moon className="h-4 w-4" strokeWidth={1.85} />
      )}
    </button>
  );
}
