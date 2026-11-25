"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowUpLeft,
  BookOpen,
  Building2,
  CalendarClock,
  Download,
  GraduationCap,
  LayoutDashboard,
  Presentation,
  ShieldAlert,
  UserCheck,
  Users,
} from "lucide-react";
import type { SchoolAdminDashboardData } from "@/application/academic/actions";
import type { HallOccupancyData } from "@/application/halls/actions";
import { LiveOccupancyBento } from "@/components/admin/LiveOccupancyBento";
import {
  MotionReveal,
  MotionStaggerCard,
  MotionStaggerGrid,
  TACTILE_SPRING,
} from "@/components/motion/MotionPrimitives";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatArabicNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export interface AdminPortalNavProps {
  readonly schoolSlug: string;
  readonly pendingCount?: number;
}

/**
 * Sticky-friendly RTL sub-navigation tabs for School Admin Console portals.
 */
export function AdminPortalNav({
  schoolSlug,
  pendingCount = 0,
}: AdminPortalNavProps) {
  const pathname = usePathname();
  const base = `/s/${schoolSlug}/admin`;

  const tabs = [
    {
      href: base,
      label: "النظرة العامة",
      icon: LayoutDashboard,
      active: pathname === base,
    },
    {
      href: `${base}/academic`,
      label: "المناهج والمسارات",
      icon: BookOpen,
      active: pathname.startsWith(`${base}/academic`),
    },
    {
      href: `${base}/halls`,
      label: "إدارة القاعات",
      icon: Building2,
      active: pathname.startsWith(`${base}/halls`),
    },
    {
      href: `${base}/teachers`,
      label: "اعتماد المعلمين",
      icon: UserCheck,
      active: pathname.startsWith(`${base}/teachers`),
      badge: pendingCount > 0 ? formatArabicNumber(pendingCount) : undefined,
    },
    {
      href: `${base}/presentation`,
      label: "وضع عرض الوزارة",
      icon: Presentation,
      active: pathname.startsWith(`${base}/presentation`),
    },
  ] as const;

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-3 print:hidden">
      <nav
        className="flex max-w-full items-center gap-1.5 overflow-x-auto pb-0.5"
        aria-label="أقسام إدارة المدرسة"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap",
                tab.active
                  ? "border-transparent text-white"
                  : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
              )}
            >
              {tab.active && (
                <motion.span
                  layoutId="admin-portal-tab-pill"
                  transition={TACTILE_SPRING}
                  aria-hidden="true"
                  className="absolute inset-0 rounded-xl bg-[#1E3A8A] shadow-sm dark:bg-blue-600"
                />
              )}
              <Icon className="relative z-10 h-4 w-4 shrink-0" />
              <span className="relative z-10">{tab.label}</span>
              {"badge" in tab && tab.badge && (
                <Badge
                  variant={tab.active ? "mono" : "warning"}
                  size="sm"
                  className={cn(
                    "relative z-10",
                    tab.active && "border-white/25 bg-white/15 text-white"
                  )}
                >
                  {tab.badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export interface AdminAccessNoticeProps {
  readonly schoolSlug: string;
  readonly errorCode: string;
  readonly errorMessage: string;
}

/**
 * Clean RTL access notice rendered when the current session lacks school_admin access.
 */
export function AdminAccessNotice({
  schoolSlug,
  errorCode,
  errorMessage,
}: AdminAccessNoticeProps) {
  const isUnauth = errorCode === "UNAUTHORIZED";
  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <CardTitle className="text-xl">
            {isUnauth
              ? "سجّل دخولك لفتح إدارة المدرسة"
              : "هذه الصفحة مخصصة لإدارة المدرسة"}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-base text-[var(--text-secondary)] leading-relaxed">
          {isUnauth
            ? "ادخل بحساب إدارة المدرسة لمتابعة سعة القاعات واعتماد المعلمين وتصدير التقارير."
            : errorMessage}
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/login"
            className={buttonVariants({
              variant: "primary",
              size: "md",
              className: "min-h-[44px]",
            })}
          >
            تسجيل الدخول / تبديل الحساب
          </Link>
          <Link
            href={`/s/${schoolSlug}`}
            className={buttonVariants({
              variant: "outline",
              size: "md",
              className: "min-h-[44px]",
            })}
          >
            العودة لبوابة المدرسة
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export interface AdminOverviewClientProps {
  readonly schoolSlug: string;
  readonly dashboard: SchoolAdminDashboardData;
  readonly occupancy: HallOccupancyData;
}

/**
 * School Admin Bento Telemetry overview, LiveOccupancyBento gauges, and quick actions.
 */
export function AdminOverviewClient({
  schoolSlug,
  dashboard,
  occupancy,
}: AdminOverviewClientProps) {
  const { school, stats, pendingTeachers, tracks, subjects } = dashboard;

  const kpiCards = [
    {
      label: "الطلاب المقيدون",
      value: stats.totalStudents,
      meta: `${formatArabicNumber(tracks.length)} مسارات معتمدة`,
      icon: GraduationCap,
      accentClass: "text-[#1E3A8A] dark:text-blue-400",
    },
    {
      label: "المعلمون المعتمدون",
      value: stats.totalTeachers,
      meta:
        pendingTeachers.length > 0
          ? `${formatArabicNumber(pendingTeachers.length)} طلبات بانتظار الاعتماد`
          : "لا توجد طلبات معلقة",
      icon: Users,
      accentClass: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "القاعات النشطة",
      value: stats.totalHalls,
      meta: `من أصل ${formatArabicNumber(occupancy.halls.length)} قاعة مسجلة`,
      icon: Building2,
      accentClass: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "حصص اليوم النشطة",
      value: stats.activeSessionsToday,
      meta: `${formatArabicNumber(subjects.length)} مادة بالمنهج`,
      icon: CalendarClock,
      accentClass: "text-sky-600 dark:text-sky-400",
    },
  ] as const;

  const quickActions = [
    {
      href: `/s/${schoolSlug}/admin/academic`,
      title: "إدارة المناهج والمسارات",
      subtitle: "الصفوف، المسارات، المواد، ومصفوفة التعيين",
      icon: BookOpen,
      badge: `${formatArabicNumber(subjects.length)} مادة`,
    },
    {
      href: `/s/${schoolSlug}/admin/halls`,
      title: "إدارة القاعات والإشغال",
      subtitle: "السعات، حالات الصيانة، ونقل الحصص الطارئ",
      icon: Building2,
      badge: `${formatArabicNumber(occupancy.halls.length)} قاعة`,
    },
    {
      href: `/s/${schoolSlug}/admin/teachers`,
      title: "اعتماد المعلمين",
      subtitle: "مراجعة طلبات الانضمام وتفعيل صلاحيات الجدولة",
      icon: UserCheck,
      badge:
        pendingTeachers.length > 0
          ? `${formatArabicNumber(pendingTeachers.length)} قيد المراجعة`
          : "مكتمل",
    },
    {
      href: `/s/${schoolSlug}/admin/presentation`,
      title: "وضع عرض الوزارة التقديمي",
      subtitle: "شاشة عرض تنفيذية بملء الشاشة وتقارير مقارنة",
      icon: Presentation,
      badge: "عرض مباشر",
    },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      {/* Header Identity Card with 3D Shield Art */}
      <MotionReveal className="ambient-mesh rounded-3xl border border-[var(--border-hairline)] hairline-lift">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-4 sm:items-center">
            <div className="art-pedestal h-18 w-18 shrink-0 overflow-hidden rounded-2xl p-1.5">
              <Image
                src="/images/role-admin-3d.webp"
                alt="لوحة إدارة المدرسة"
                width={72}
                height={72}
                className="h-full w-full rounded-xl object-cover"
              />
            </div>
            <div>
              <Badge variant={school.isActive ? "success" : "neutral"} dot size="md">
                {school.isActive ? "مدرسة مفعلة" : "غير نشطة"}
              </Badge>
              <h1 className="mt-2.5 text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
                لوحة إدارة {school.nameAr}
              </h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                التحكم المركزي في المناهج الدراسية، القاعات، اعتماد المعلمين، وتقارير الوزارة
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/reports/export?schoolSlug=${encodeURIComponent(schoolSlug)}&format=csv`}
              className={buttonVariants({
                variant: "outline",
                size: "md",
                className: "min-h-[44px] bg-[var(--bg-surface)]/90",
              })}
            >
              <Download className="h-4 w-4" />
              <span>تصدير CSV</span>
            </a>
            <Link
              href={`/s/${schoolSlug}/admin/presentation`}
              className={buttonVariants({
                variant: "primary",
                size: "md",
                className: "min-h-[44px]",
              })}
            >
              <Presentation className="h-4 w-4" />
              <span>عرض الوزارة</span>
            </Link>
          </div>
        </div>
      </MotionReveal>

      {/* Bento Telemetry Stats */}
      <MotionStaggerGrid className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((item) => {
          const Icon = item.icon;
          return (
            <MotionStaggerCard key={item.label}>
              <Card className="hover-lift-card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--text-muted)]">
                    {item.label}
                  </span>
                  <Icon className={cn("h-4 w-4", item.accentClass)} />
                </div>
                <p className="mt-2 text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                  {formatArabicNumber(item.value)}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{item.meta}</p>
              </Card>
            </MotionStaggerCard>
          );
        })}
      </MotionStaggerGrid>

      {/* Live Hall Occupancy SVG Rings */}
      <LiveOccupancyBento schoolSlug={schoolSlug} halls={occupancy.halls} />

      {/* Quick Actions Bento Grid */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-[var(--text-primary)]">
          الإجراءات الإدارية السريعة
        </h2>
        <MotionStaggerGrid className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <MotionStaggerCard key={action.href}>
                <Link href={action.href} className="group block h-full">
                  <Card variant="interactive" className="flex h-full flex-col justify-between p-4">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] text-[var(--text-primary)]">
                          <Icon className="h-4 w-4" strokeWidth={1.85} />
                        </span>
                        <Badge variant="neutral" size="sm">
                          {action.badge}
                        </Badge>
                      </div>
                      <h3 className="mt-3 text-sm font-bold text-[var(--text-primary)]">
                        {action.title}
                      </h3>
                      <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
                        {action.subtitle}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-[#1E3A8A] dark:text-blue-400">
                      <span>فتح القسم</span>
                      <ArrowUpLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                  </Card>
                </Link>
              </MotionStaggerCard>
            );
          })}
        </MotionStaggerGrid>
      </section>
    </div>
  );
}
