import Link from "next/link";
import { ArrowRight, Calendar, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatArabicNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export interface StudentSubNavProps {
  readonly schoolSlug: string;
  readonly activeTab: "sessions" | "schedule" | "ticket";
  readonly activeBookingsCount?: number;
}

/**
 * Sub-navigation tabs rendered inside the existing `<SchoolShell>` workspace.
 * Provides quick switching between available sessions and student schedule/tickets.
 */
export function StudentSubNav({
  schoolSlug,
  activeTab,
  activeBookingsCount,
}: StudentSubNavProps) {
  const base = `/s/${schoolSlug}/student`;

  const tabs = [
    {
      key: "sessions" as const,
      href: base,
      label: "الحصص المتاحة",
      icon: Calendar,
    },
    {
      key: "schedule" as const,
      href: `${base}/schedule`,
      label: "جدولي وتذاكري",
      icon: Ticket,
      count: activeBookingsCount,
    },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4 print:hidden">
      <nav
        className="inline-flex min-w-0 flex-wrap items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-1 hairline-lift"
        aria-label="تنقل بوابة الطالب"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap",
                isActive
                  ? "bg-[#1E3A8A] text-white dark:bg-blue-600"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-sunken)] hover:text-[var(--text-primary)]"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.85} />
              <span>{tab.label}</span>
              {typeof tab.count === "number" && tab.count > 0 && (
                <Badge
                  variant={isActive ? "mono" : "primary"}
                  size="sm"
                  className={isActive ? "border-white/25 bg-white/15 text-white" : ""}
                >
                  {formatArabicNumber(tab.count)}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {activeTab === "ticket" && (
        <Link
          href={`${base}/schedule`}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs sm:text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
        >
          <ArrowRight className="h-4 w-4 shrink-0" />
          <span>العودة إلى جدولي وتذاكري</span>
        </Link>
      )}
    </div>
  );
}
