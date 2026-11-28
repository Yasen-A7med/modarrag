"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRightLeft,
  Menu,
  X,
} from "lucide-react";
import { ModarragLogo } from "@/components/brand/ModarragLogo";
import {
  renderSchoolNavIcon,
  type SchoolShellNavIcon,
} from "@/components/layout/school-nav-icons";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export interface PortalSidebarNavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: SchoolShellNavIcon;
  readonly badge?: string;
  readonly matchPrefix?: boolean;
}

export interface PortalSidebarShellProps {
  readonly brandSubtitle: string;
  readonly schoolNameAr?: string;
  readonly schoolLogoUrl?: string | null;
  readonly schoolMeta?: string | null;
  readonly roleBadgeAr: string;
  readonly userCodeLabel?: string | null;
  readonly navItems: readonly PortalSidebarNavItem[];
  readonly backHref?: string;
  readonly backLabel?: string;
  readonly children: React.ReactNode;
}

function isSidebarNavActive(pathname: string, item: PortalSidebarNavItem): boolean {
  if (item.matchPrefix) {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  return pathname === item.href;
}

interface SidebarContentProps {
  readonly brandSubtitle: string;
  readonly schoolNameAr?: string;
  readonly schoolLogoUrl?: string | null;
  readonly schoolMeta?: string | null;
  readonly roleBadgeAr: string;
  readonly userCodeLabel?: string | null;
  readonly navItems: readonly PortalSidebarNavItem[];
  readonly backHref: string;
  readonly backLabel: string;
  readonly pathname: string;
  readonly onNavigate?: () => void;
}

function SidebarContent({
  brandSubtitle,
  schoolNameAr,
  schoolLogoUrl,
  schoolMeta,
  roleBadgeAr,
  userCodeLabel,
  navItems,
  backHref,
  backLabel,
  pathname,
  onNavigate,
}: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col justify-between gap-6 p-4 text-white">
      <div className="flex flex-col gap-5">
        {/* Modarrag Navy Brand Lockup */}
        <Link href={backHref} onClick={onNavigate} className="flex items-center gap-3 px-1">
          <ModarragLogo size="sm" showWordmark={false} />
          <div className="min-w-0">
            <p className="text-lg font-extrabold tracking-tight text-white">مُدَرَّج</p>
            <p className="truncate text-[11px] font-semibold text-cyan-300">
              {brandSubtitle}
            </p>
          </div>
        </Link>

        {/* Active Tenant / Institutional Pill */}
        {schoolNameAr && (
          <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-3">
            <div className="flex items-center gap-2.5">
              {schoolLogoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={schoolLogoUrl}
                  alt={schoolNameAr}
                  className="h-9 w-9 shrink-0 rounded-xl bg-white p-0.5 object-contain"
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white">{schoolNameAr}</p>
                {schoolMeta && (
                  <p className="mt-0.5 truncate text-[11px] text-slate-300">
                    {schoolMeta}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Primary RTL Navigation */}
        <nav className="flex flex-col gap-1.5" aria-label="القائمة الجانبية">
          {navItems.map((item) => {
            const active = isSidebarNavActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex min-h-[46px] items-center justify-between gap-2.5 rounded-xl px-3.5 text-sm font-semibold transition-all duration-150",
                  active
                    ? "bg-[#2563EB] text-white shadow-[0_8px_24px_-6px_rgba(37,99,235,0.65)] ring-1 ring-cyan-300/35"
                    : "text-slate-300 hover:bg-white/[0.08] hover:text-white"
                )}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={cn(
                      "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                      active ? "bg-white/15 text-cyan-200" : "bg-white/[0.05] text-slate-300"
                    )}
                  >
                    {renderSchoolNavIcon(item.icon, "h-4 w-4")}
                  </span>
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge && (
                  <span className="rounded-md bg-cyan-400/20 px-2 py-0.5 text-[11px] font-bold text-cyan-200 tabular-nums">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile & Quick Switch */}
      <div className="flex flex-col gap-2 border-t border-white/12 pt-4">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="min-w-0">
            <span className="inline-flex items-center rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-bold text-cyan-200">
              {roleBadgeAr}
            </span>
            {userCodeLabel && (
              <p className="mt-1 truncate text-xs font-medium text-slate-300">
                {userCodeLabel}
              </p>
            )}
          </div>
          <ThemeToggle className="h-9 w-9 border-white/15 bg-white/10 text-white hover:bg-white/20 hover:text-white" />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Link
            href={backHref}
            onClick={onNavigate}
            className="flex min-h-[40px] items-center justify-center rounded-xl border border-white/12 bg-white/[0.05] px-2.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.12]"
          >
            {backLabel}
          </Link>
          <Link
            href="/login"
            onClick={onNavigate}
            className="flex min-h-[40px] items-center justify-center gap-1 rounded-xl border border-white/12 bg-white/[0.05] px-2.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.12]"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            <span>حساب آخر</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Executive Navy (#0A1F44) RTL Sidebar Workspace Shell unifying Teacher,
 * School Admin, and Super Admin portals with a sticky top header on mobile
 * and persistent command sidebar on desktop.
 */
export function PortalSidebarShell({
  brandSubtitle,
  schoolNameAr,
  schoolLogoUrl,
  schoolMeta,
  roleBadgeAr,
  userCodeLabel,
  navItems,
  backHref = "/",
  backLabel = "الرئيسية",
  children,
}: PortalSidebarShellProps) {
  const pathname = usePathname();
  const [openDrawerPath, setOpenDrawerPath] = React.useState<string | null>(null);
  const mobileDrawerOpen = openDrawerPath === pathname;

  const sidebarProps: SidebarContentProps = {
    brandSubtitle,
    schoolNameAr,
    schoolLogoUrl,
    schoolMeta,
    roleBadgeAr,
    userCodeLabel,
    navItems,
    backHref,
    backLabel,
    pathname,
  };

  return (
    <div className="min-h-dvh bg-[var(--bg-canvas)] text-[var(--text-primary)] lg:flex">
      {/* Persistent Desktop Right RTL Navy Sidebar */}
      <aside className="hidden lg:block lg:w-64 xl:w-72 shrink-0 bg-[#0A1F44] border-e border-[#0A1F44] print:hidden">
        <div className="sticky top-0 h-dvh overflow-y-auto">
          <SidebarContent {...sidebarProps} />
        </div>
      </aside>

      {/* Mobile Compact Header */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[var(--border-hairline)] bg-[#0A1F44] px-4 py-3 text-white lg:hidden print:hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setOpenDrawerPath(pathname)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 cursor-pointer"
            aria-label="فتح القائمة"
          >
            <Menu className="h-5 w-5" />
          </button>
          <ModarragLogo size="sm" showWordmark={false} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">
              {schoolNameAr ?? "مُدَرَّج"}
            </p>
            <p className="truncate text-[11px] text-cyan-300">{brandSubtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="mono" className="border-white/20 bg-white/10 text-cyan-200">
            {roleBadgeAr}
          </Badge>
          <ThemeToggle className="h-10 w-10 border-white/15 bg-white/10 text-white hover:bg-white/20" />
        </div>
      </div>

      {/* Mobile Slide-Over Navy Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden print:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setOpenDrawerPath(null)}
          />
          <aside className="relative z-10 flex h-full w-72 max-w-[85vw] flex-col bg-[#0A1F44] shadow-2xl">
            <button
              type="button"
              onClick={() => setOpenDrawerPath(null)}
              className="absolute top-3 end-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 cursor-pointer"
              aria-label="إغلاق القائمة"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex-1 overflow-y-auto pt-2">
              <SidebarContent {...sidebarProps} onNavigate={() => setOpenDrawerPath(null)} />
            </div>
          </aside>
        </div>
      )}

      {/* Main Executive Workspace */}
      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 pb-24 lg:pb-12">
          {children}
        </main>
      </div>
    </div>
  );
}
