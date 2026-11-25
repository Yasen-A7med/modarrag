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
 * Light/dark theme switcher using synchronized repaint suppression (`.theme-switching`)
 * so buttons and cards transition simultaneously without lag artifacts.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const isDark = React.useSyncExternalStore(
    subscribeToDarkClass,
    getDarkSnapshot,
    getServerSnapshot
  );

  const toggleTheme = React.useCallback(() => {
    const root = document.documentElement;
    root.classList.add("theme-switching");
    const nextDark = !root.classList.contains("dark");
    root.classList.toggle("dark", nextDark);
    root.style.colorScheme = nextDark ? "dark" : "light";
    // Force synchronized style recalc before re-enabling transitions.
    void root.offsetHeight;
    window.requestAnimationFrame(() => {
      root.classList.remove("theme-switching");
    });

    try {
      window.localStorage.setItem(STORAGE_KEY, nextDark ? "dark" : "light");
    } catch {
      // Ignore storage access errors in restricted browsing contexts.
    }
  }, []);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-hairline)]",
        "bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors duration-150 cursor-pointer",
        "hover:border-[var(--border-strong)] hover:bg-[var(--bg-sunken)] hover:text-[var(--text-primary)]",
        "active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B63CE]/40",
        className
      )}
      aria-label={isDark ? "التبديل للوضع الفاتح" : "التبديل للوضع الداكن"}
      title={isDark ? "الوضع الفاتح" : "الوضع الداكن"}
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-amber-400" strokeWidth={2} />
      ) : (
        <Moon className="h-5 w-5" strokeWidth={2} />
      )}
    </button>
  );
}
