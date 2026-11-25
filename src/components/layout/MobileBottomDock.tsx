"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { renderSchoolNavIcon, type SchoolShellNavItem } from "./school-nav-icons";

export interface MobileBottomDockProps {
  readonly items: readonly SchoolShellNavItem[];
  readonly className?: string;
}

/**
 * High-legibility mobile dock limited to 4 primary actions with >=48px touch targets.
 */
export function MobileBottomDock({ items, className }: MobileBottomDockProps) {
  const pathname = usePathname();
  const visibleItems = items.slice(0, 4);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <nav
      className={cn(
        "md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 backdrop-blur-md safe-area-bottom",
        className
      )}
      aria-label="التنقل السفلي"
    >
      <div className="mx-auto flex max-w-lg items-center justify-around gap-1 px-2 pt-1.5 pb-1">
        {visibleItems.map((item) => {
          const isActive = item.active ?? pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[48px] min-w-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-xs font-semibold transition-colors",
                isActive
                  ? "bg-[#EEF5FF] text-[#0B63CE] dark:bg-blue-500/15 dark:text-blue-300"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              {renderSchoolNavIcon(item.icon, "h-5 w-5 shrink-0")}
              <span className="truncate max-w-[84px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
