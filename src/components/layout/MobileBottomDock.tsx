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
 * Sticky mobile dock with 44x44px coarse touch targets and safe-area-inset-bottom padding.
 */
export function MobileBottomDock({ items, className }: MobileBottomDockProps) {
  const pathname = usePathname();
  const visibleItems = items.slice(0, 5);

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
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 pt-1.5 pb-1">
        {visibleItems.map((item) => {
          const isActive = item.active ?? pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1 text-[11px] font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-[#1E3A8A] dark:bg-blue-500/15 dark:text-blue-300"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              {renderSchoolNavIcon(item.icon, "h-4 w-4 shrink-0")}
              <span className="truncate max-w-[68px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
