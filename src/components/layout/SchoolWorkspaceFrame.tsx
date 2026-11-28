"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { MobileBottomDock } from "@/components/layout/MobileBottomDock";
import {
  PortalSidebarShell,
  type PortalSidebarNavItem,
} from "@/components/layout/PortalSidebarShell";
import type { SchoolShellNavItem } from "@/components/layout/school-nav-icons";
import { TopNavbar } from "@/components/layout/TopNavbar";
import type { UserRole } from "@/infrastructure/supabase/database.types";

export interface SchoolWorkspaceFrameProps {
  readonly school: {
    readonly slug: string;
    readonly nameAr: string;
    readonly governorate?: string | null;
    readonly directorate?: string | null;
    readonly logoUrl?: string | null;
  };
  readonly userContext?: {
    readonly role: UserRole;
    readonly roleLabelAr: string;
    readonly codeLabel?: string | null;
  } | null;
  readonly studentLinks: readonly SchoolShellNavItem[];
  readonly children: React.ReactNode;
}

/**
 * Adaptive workspace chrome inside `/s/[schoolSlug]/*`:
 * - Teacher & School Admin routes render the Navy (#0A1F44) RTL Sidebar matching center decks.
 * - Ministry Presentation route takes clean full canvas control without double navigation.
 * - Student, School Landing, and Recorded Lectures render spacious mobile-first TopNavbar + Dock.
 */
export function SchoolWorkspaceFrame({
  school,
  userContext,
  studentLinks,
  children,
}: SchoolWorkspaceFrameProps) {
  const pathname = usePathname();
  const base = `/s/${school.slug}`;
  const isTeacherRoute = pathname.startsWith(`${base}/teacher`);
  const isPresentationRoute = pathname.startsWith(`${base}/admin/presentation`);
  const isAdminRoute = pathname.startsWith(`${base}/admin`) && !isPresentationRoute;

  if (isPresentationRoute) {
    return (
      <div className="min-h-dvh bg-[#0A1F44] text-white">
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    );
  }

  if (isTeacherRoute) {
    const teacherItems: readonly PortalSidebarNavItem[] = [
      { href: `${base}/teacher`, label: "لوحة القيادة", icon: "check" },
      { href: `${base}/teacher/book-hall`, label: "الجدول والحجز", icon: "plus" },
      { href: `${base}/teacher/lectures`, label: "المحاضرات", icon: "video" },
      { href: `${base}/teacher/printing`, label: "المطبعة", icon: "book" },
    ];

    return (
      <PortalSidebarShell
        brandSubtitle="مركز المعلم الرقمي"
        schoolNameAr={school.nameAr}
        schoolLogoUrl={school.logoUrl}
        schoolMeta={[school.governorate, school.directorate].filter(Boolean).join(" · ")}
        roleBadgeAr={userContext?.roleLabelAr || "معلم المادة"}
        userCodeLabel={userContext?.codeLabel}
        navItems={teacherItems}
        backHref={base}
        backLabel="بوابة المدرسة"
      >
        {children}
      </PortalSidebarShell>
    );
  }

  if (isAdminRoute) {
    const adminItems: readonly PortalSidebarNavItem[] = [
      { href: `${base}/admin`, label: "لوحة القيادة", icon: "building" },
      { href: `${base}/admin/academic`, label: "المناهج والمسارات", icon: "book" },
      { href: `${base}/admin/halls`, label: "إدارة القاعات", icon: "calendar" },
      { href: `${base}/admin/teachers`, label: "اعتماد المعلمين", icon: "check" },
      { href: `${base}/admin/presentation`, label: "عرض الوزارة", icon: "shield" },
    ];

    return (
      <PortalSidebarShell
        brandSubtitle="إدارة المدرسة المعتمدة"
        schoolNameAr={school.nameAr}
        schoolLogoUrl={school.logoUrl}
        schoolMeta={[school.governorate, school.directorate].filter(Boolean).join(" · ")}
        roleBadgeAr={userContext?.roleLabelAr || "إدارة المدرسة"}
        userCodeLabel={userContext?.codeLabel}
        navItems={adminItems}
        backHref={base}
        backLabel="بوابة المدرسة"
      >
        {children}
      </PortalSidebarShell>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <TopNavbar
        brandHref="/"
        school={school}
        links={studentLinks.map((item) => ({
          href: item.href,
          label: item.label,
          active: pathname === item.href,
        }))}
        user={userContext ?? null}
      />

      <main className="mx-auto max-w-6xl px-4 pt-6 pb-28 sm:px-6 md:pb-12">
        {children}
      </main>

      <MobileBottomDock items={studentLinks} />
    </div>
  );
}
