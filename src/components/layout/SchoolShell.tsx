import * as React from "react";
import Link from "next/link";
import { ArrowRightLeft, Clock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { UserRole } from "@/infrastructure/supabase/database.types";
import { getUserRoleLabel } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { MobileBottomDock } from "./MobileBottomDock";
import {
  renderSchoolNavIcon,
  type SchoolShellNavIcon,
  type SchoolShellNavItem,
} from "./school-nav-icons";
import { TopNavbar } from "./TopNavbar";

export type { SchoolShellNavIcon, SchoolShellNavItem };

export interface SchoolShellProps {
  readonly school: {
    readonly slug: string;
    readonly nameAr: string;
    readonly governorate?: string | null;
    readonly directorate?: string | null;
    readonly logoUrl?: string | null;
    readonly defaultBufferMinutes?: number;
  };
  readonly userContext?: {
    readonly role: UserRole;
    readonly roleLabelAr?: string;
    readonly codeLabel?: string | null;
  } | null;
  readonly navItems?: readonly SchoolShellNavItem[];
  readonly pageTitle?: string;
  readonly pageSubtitle?: string;
  readonly headerActions?: React.ReactNode;
  readonly children: React.ReactNode;
}

export function buildDefaultSchoolNavItems(
  schoolSlug: string,
  role?: UserRole | null
): readonly SchoolShellNavItem[] {
  const base = `/s/${schoolSlug}`;

  switch (role) {
    case "student":
      return [
        { href: base, label: "المدرسة", icon: "home" },
        { href: `${base}/student`, label: "الحصص والتذاكر", icon: "calendar" },
        { href: "/onboarding", label: "المسار الدراسي", icon: "book" },
      ];
    case "teacher":
      return [
        { href: base, label: "المدرسة", icon: "home" },
        { href: `${base}/teacher`, label: "لوحة المعلم", icon: "layout" },
        { href: `${base}/scanner`, label: "التحضير", icon: "scan" },
      ];
    case "gate_scanner":
      return [
        { href: base, label: "المدرسة", icon: "home" },
        { href: `${base}/scanner`, label: "ماسح البوابة", icon: "scan" },
      ];
    case "school_admin":
      return [
        { href: base, label: "المدرسة", icon: "home" },
        { href: `${base}/admin`, label: "إدارة المدرسة", icon: "building" },
        { href: `${base}/teacher`, label: "جدول الحصص", icon: "calendar" },
        { href: `${base}/scanner`, label: "البوابة", icon: "scan" },
      ];
    case "super_admin":
      return [
        { href: base, label: "المدرسة", icon: "home" },
        { href: "/super-admin", label: "المنصة الوطنية", icon: "shield" },
        { href: `${base}/admin`, label: "إدارة المدرسة", icon: "building" },
        { href: `${base}/scanner`, label: "البوابة", icon: "scan" },
      ];
    default:
      return [
        { href: base, label: "الرئيسية", icon: "home" },
        { href: `${base}/student`, label: "بوابة الطالب", icon: "calendar" },
        { href: "/login", label: "دخول", icon: "shield" },
      ];
  }
}

/**
 * Multi-tenant workspace shell for `/s/[schoolSlug]/*` portals.
 * Combines sticky TopNavbar, slim desktop RTL sidebar, and mobile safe-area bottom dock.
 */
export function SchoolShell({
  school,
  userContext,
  navItems,
  pageTitle,
  pageSubtitle,
  headerActions,
  children,
}: SchoolShellProps) {
  const items = navItems ?? buildDefaultSchoolNavItems(school.slug, userContext?.role);
  const roleLabelAr =
    userContext?.roleLabelAr ??
    (userContext?.role ? getUserRoleLabel(userContext.role, "ar") : "");

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <TopNavbar
        brandHref="/"
        school={school}
        links={items.map((item) => ({
          href: item.href,
          label: item.label,
          active: item.active,
        }))}
        user={
          userContext
            ? {
                role: userContext.role,
                roleLabelAr,
                codeLabel: userContext.codeLabel,
              }
            : null
        }
      />

      <div className="mx-auto flex max-w-7xl gap-6 px-4 pt-5 pb-24 sm:px-6 md:pb-10">
        {/* Desktop RTL Sidebar */}
        <aside className="hidden w-60 shrink-0 md:block">
          <div className="sticky top-21 flex flex-col gap-3">
            {/* School Identity Panel */}
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3.5 hairline-lift">
              <div className="flex items-center gap-3">
                {school.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={school.logoUrl}
                    alt={school.nameAr}
                    className="h-10 w-10 shrink-0 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-1 object-contain"
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-[var(--text-primary)]">
                    {school.nameAr}
                  </p>
                  {(school.governorate || school.directorate) && (
                    <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                      {[school.governorate, school.directorate].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>

              {typeof school.defaultBufferMinutes === "number" && (
                <div className="mt-3 flex items-center justify-between border-t border-[var(--border-hairline)] pt-2.5 text-[11px] text-[var(--text-muted)]">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    فاصل المدرجات
                  </span>
                  <span className="font-mono font-semibold text-[var(--text-primary)] tabular-nums">
                    {school.defaultBufferMinutes} دقيقة
                  </span>
                </div>
              )}
            </div>

            {/* Navigation Menu */}
            <nav
              className="flex flex-col gap-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2 hairline-lift"
              aria-label="قائمة المدرسة"
            >
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    item.active
                      ? "bg-[#1E3A8A] text-white dark:bg-blue-600"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-sunken)] hover:text-[var(--text-primary)]"
                  )}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    {renderSchoolNavIcon(item.icon, "h-4 w-4 shrink-0")}
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge !== undefined && (
                    <Badge
                      variant={item.active ? "mono" : "neutral"}
                      size="sm"
                      className={item.active ? "border-white/25 bg-white/15 text-white" : ""}
                    >
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              ))}
            </nav>

            {/* Quick Account / Role Switcher Link */}
            <Link
              href="/login"
              className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-3.5 py-2.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            >
              <span>تبديل الحساب التجريبي</span>
              <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" />
            </Link>
          </div>
        </aside>

        {/* Main Workspace Content */}
        <main className="min-w-0 flex-1">
          {(pageTitle || headerActions) && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
              <div>
                {pageTitle && (
                  <h1 className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
                    {pageTitle}
                  </h1>
                )}
                {pageSubtitle && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{pageSubtitle}</p>
                )}
              </div>
              {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
            </div>
          )}

          {children}
        </main>
      </div>

      <MobileBottomDock items={items} />
    </div>
  );
}
