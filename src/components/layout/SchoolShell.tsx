import * as React from "react";
import Link from "next/link";
import { ArrowRightLeft } from "lucide-react";
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
        { href: `${base}/student`, label: "حصصي", icon: "calendar" },
        { href: "/onboarding", label: "المسار الدراسي", icon: "book" },
      ];
    case "teacher":
    case "gate_scanner":
      return [
        { href: base, label: "المدرسة", icon: "home" },
        { href: `${base}/teacher`, label: "كشوف الحضور", icon: "check" },
        { href: `${base}/teacher/book-hall`, label: "حجز قاعة", icon: "plus" },
      ];
    case "school_admin":
      return [
        { href: base, label: "المدرسة", icon: "home" },
        { href: `${base}/admin`, label: "إدارة المدرسة", icon: "building" },
        { href: `${base}/teacher`, label: "الحصص", icon: "calendar" },
      ];
    case "super_admin":
      return [
        { href: base, label: "المدرسة", icon: "home" },
        { href: "/super-admin", label: "لوحة المنصة", icon: "shield" },
        { href: `${base}/admin`, label: "إدارة المدرسة", icon: "building" },
      ];
    default:
      return [
        { href: base, label: "المدرسة", icon: "home" },
        { href: `${base}/student`, label: "الحصص المتاحة", icon: "calendar" },
        { href: "/login", label: "تسجيل الدخول", icon: "shield" },
      ];
  }
}

/**
 * Warm, spacious, uncluttered school workspace shell designed for effortless
 * comprehension across all ages — zero technical noise or dense widget clutter.
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
    <div className="min-h-dvh bg-[var(--bg-canvas)] text-[var(--text-primary)]">
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

      <div className="mx-auto flex max-w-6xl gap-6 px-4 pt-6 pb-28 sm:px-6 md:pb-12">
        {/* Clean Slim Sidebar (Desktop Only) */}
        <aside className="hidden w-60 shrink-0 md:block">
          <div className="sticky top-24 flex flex-col gap-3">
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 hairline-lift">
              <div className="flex items-center gap-3">
                {school.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={school.logoUrl}
                    alt={school.nameAr}
                    className="h-11 w-11 shrink-0 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-1 object-contain"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-snug text-[var(--text-primary)]">
                    {school.nameAr}
                  </p>
                  {(school.governorate || school.directorate) && (
                    <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
                      {[school.governorate, school.directorate].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <nav
              className="flex flex-col gap-1.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2.5 hairline-lift"
              aria-label="قائمة المدرسة"
            >
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-[46px] items-center justify-between gap-2.5 rounded-xl px-3.5 text-sm font-semibold transition-colors",
                    item.active
                      ? "bg-[#0B63CE] text-white dark:bg-blue-600"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-sunken)] hover:text-[var(--text-primary)]"
                  )}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    {renderSchoolNavIcon(item.icon, "h-4 w-4 shrink-0")}
                    <span className="truncate">{item.label}</span>
                  </span>
                </Link>
              ))}
            </nav>

            <Link
              href="/login"
              className="flex min-h-[44px] items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            >
              <span>تبديل الحساب</span>
              <ArrowRightLeft className="h-4 w-4 shrink-0" />
            </Link>
          </div>
        </aside>

        {/* Spacious Main Workspace */}
        <main className="min-w-0 flex-1">
          {(pageTitle || headerActions) && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
              <div>
                {pageTitle && (
                  <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                    {pageTitle}
                  </h1>
                )}
                {pageSubtitle && (
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{pageSubtitle}</p>
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
