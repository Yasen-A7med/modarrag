import * as React from "react";
import type { UserRole } from "@/infrastructure/supabase/database.types";
import { getUserRoleLabel } from "@/lib/formatters";
import {
  type SchoolShellNavIcon,
  type SchoolShellNavItem,
} from "./school-nav-icons";
import { SchoolWorkspaceFrame } from "./SchoolWorkspaceFrame";

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
        { href: `${base}/lectures`, label: "المحاضرات", icon: "video" },
        { href: "/onboarding", label: "المسار", icon: "book" },
      ];
    case "teacher":
    case "gate_scanner":
      return [
        { href: base, label: "المدرسة", icon: "home" },
        { href: `${base}/teacher`, label: "لوحة القيادة", icon: "check" },
        { href: `${base}/teacher/book-hall`, label: "الجدول", icon: "plus" },
        { href: `${base}/teacher/lectures`, label: "المحاضرات", icon: "video" },
      ];
    case "school_admin":
      return [
        { href: base, label: "المدرسة", icon: "home" },
        { href: `${base}/admin`, label: "الإدارة", icon: "building" },
        { href: `${base}/lectures`, label: "المحاضرات", icon: "video" },
        { href: `${base}/teacher`, label: "الحصص", icon: "calendar" },
      ];
    case "super_admin":
      return [
        { href: base, label: "المدرسة", icon: "home" },
        { href: "/super-admin", label: "المنصة", icon: "shield" },
        { href: `${base}/lectures`, label: "المحاضرات", icon: "video" },
        { href: `${base}/admin`, label: "الإدارة", icon: "building" },
      ];
    default:
      return [
        { href: base, label: "المدرسة", icon: "home" },
        { href: `${base}/student`, label: "الحصص", icon: "calendar" },
        { href: `${base}/lectures`, label: "المحاضرات", icon: "video" },
        { href: "/login", label: "دخول", icon: "shield" },
      ];
  }
}

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
    <SchoolWorkspaceFrame
      school={school}
      userContext={
        userContext
          ? {
              role: userContext.role,
              roleLabelAr,
              codeLabel: userContext.codeLabel,
            }
          : null
      }
      studentLinks={items}
    >
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
    </SchoolWorkspaceFrame>
  );
}
