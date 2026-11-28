"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import type { SchoolFinancialSummary } from "@/application/finance/actions";
import type { HallOccupancyData } from "@/application/halls/actions";
import { LiveOccupancyBento } from "@/components/admin/LiveOccupancyBento";
import { FinancialSplitCard } from "@/components/finance/FinancialSplitCard";
import {
  MotionReveal,
  MotionStaggerCard,
  MotionStaggerGrid,
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
 * Compact mobile/tablet strip (hidden on lg desktop because Navy Sidebar owns primary nav).
 */
export function AdminPortalNav({
  schoolSlug,
  pendingCount = 0,
}: AdminPortalNavProps) {
  const pathname = usePathname();
  const base = `/s/${schoolSlug}/admin`;

  const tabs = [
    { href: base, label: "النظرة العامة", icon: LayoutDashboard, active: pathname === base },
    { href: `${base}/academic`, label: "المناهج", icon: BookOpen, active: pathname.startsWith(`${base}/academic`) },
    { href: `${base}/halls`, label: "القاعات", icon: Building2, active: pathname.startsWith(`${base}/halls`) },
    {
      href: `${base}/teachers`,
      label: "المعلمون",
      icon: UserCheck,
      active: pathname.startsWith(`${base}/teachers`),
      badge: pendingCount > 0 ? formatArabicNumber(pendingCount) : undefined,
    },
    { href: `${base}/presentation`, label: "عرض الوزارة", icon: Presentation, active: pathname.startsWith(`${base}/presentation`) },
  ] as const;

  return (
    <div className="mb-5 flex items-center gap-1.5 overflow-x-auto pb-1 lg:hidden print:hidden">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold whitespace-nowrap",
              tab.active
                ? "border-[#2563EB] bg-[#2563EB] text-white"
                : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{tab.label}</span>
            {"badge" in tab && tab.badge && (
              <span className="rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[10px]">
                {tab.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export interface AdminAccessNoticeProps {
  readonly schoolSlug: string;
  readonly errorCode: string;
  readonly errorMessage: string;
}

export function AdminAccessNotice({
  schoolSlug,
  errorCode,
  errorMessage,
}: AdminAccessNoticeProps) {
  const isUnauth = errorCode === "UNAUTHORIZED";
  return (
    <Card className="mx-auto max-w-xl rounded-3xl">
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
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          {errorMessage}
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/login" className={buttonVariants({ variant: "primary", size: "md" })}>
            تسجيل الدخول
          </Link>
          <Link
            href={`/s/${schoolSlug}`}
            className={buttonVariants({ variant: "outline", size: "md" })}
          >
            بوابة المدرسة
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
  readonly financialSummary?: SchoolFinancialSummary;
}

/**
 * Slide 6 Blueprint: School Admin Overview featuring CSV Export action, 4 cyan-accented
 * KPI bento cards, Live Radial Occupancy Bento, and 70/30 + 14% VAT financial governance.
 */
export function AdminOverviewClient({
  schoolSlug,
  dashboard,
  occupancy,
  financialSummary,
}: AdminOverviewClientProps) {
  const { school, stats, pendingTeachers, tracks, subjects } = dashboard;

  const kpiCards = [
    {
      label: "الطلاب المقيدون",
      value: stats.totalStudents,
      meta: `${formatArabicNumber(tracks.length)} مسارات مفعلة`,
      icon: GraduationCap,
      barClass: "border-b-[#2563EB]",
    },
    {
      label: "المعلمون المعتمدون",
      value: stats.totalTeachers,
      meta:
        pendingTeachers.length > 0
          ? `${formatArabicNumber(pendingTeachers.length)} بانتظار المراجعة`
          : "لا توجد طلبات معلقة",
      icon: Users,
      barClass: "border-b-[#16A34A]",
    },
    {
      label: "القاعات النشطة",
      value: stats.totalHalls,
      meta: `من إجمالي ${formatArabicNumber(occupancy.halls.length)} قاعة`,
      icon: Building2,
      barClass: "border-b-[#22D3EE]",
    },
    {
      label: "حصص اليوم",
      value: stats.activeSessionsToday,
      meta: `${formatArabicNumber(subjects.length)} مادة دراسية`,
      icon: CalendarClock,
      barClass: "border-b-[#0A1F44]",
    },
  ] as const;

  const quickActions = [
    {
      href: `/s/${schoolSlug}/admin/academic`,
      title: "المناهج والمسارات",
      subtitle: "الصفوف K-12 ومصفوفة التعيين",
      icon: BookOpen,
      badge: `${formatArabicNumber(subjects.length)} مادة`,
    },
    {
      href: `/s/${schoolSlug}/admin/halls`,
      title: "إدارة القاعات",
      subtitle: "السعات، الصيانة، والنقل الطارئ",
      icon: Building2,
      badge: `${formatArabicNumber(occupancy.halls.length)} قاعة`,
    },
    {
      href: `/s/${schoolSlug}/admin/teachers`,
      title: "اعتماد المعلمين",
      subtitle: "مراجعة المؤهلات والأكواد والالتزام",
      icon: UserCheck,
      badge:
        pendingTeachers.length > 0
          ? `${formatArabicNumber(pendingTeachers.length)} معلق`
          : "مكتمل",
    },
    {
      href: `/s/${schoolSlug}/admin/presentation`,
      title: "عرض الوزارة",
      subtitle: "لوحة المتابعة القيادية وملء الشاشة",
      icon: Presentation,
      badge: "مباشر",
    },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      {/* Header Bar */}
      <MotionReveal className="flex flex-col gap-4 rounded-[2rem] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 hairline-lift">
        <div>
          <Badge variant={school.isActive ? "success" : "neutral"} dot size="md">
            {school.tenantType === "center" ? "سنتر معتمد" : "مدرسة مفعلة"}
          </Badge>
          <h1 className="mt-2 text-2xl font-extrabold text-[var(--text-primary)]">
            إدارة {school.nameAr}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
            الإشراف المباشر على القاعات، المناهج، الاعتماد، والتقارير المالية
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/reports/export?schoolSlug=${encodeURIComponent(schoolSlug)}&format=csv`}
            className={buttonVariants({ variant: "outline", size: "md" })}
          >
            <Download className="h-4 w-4" />
            <span>تصدير CSV</span>
          </a>
          <Link
            href={`/s/${schoolSlug}/admin/presentation`}
            className={buttonVariants({ variant: "primary", size: "md" })}
          >
            <Presentation className="h-4 w-4" />
            <span>عرض الوزارة</span>
          </Link>
        </div>
      </MotionReveal>

      {/* 4 Bento KPIs */}
      <MotionStaggerGrid className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((item) => {
          const Icon = item.icon;
          return (
            <MotionStaggerCard key={item.label}>
              <Card className={cn("hover-lift-card border-b-[3px] p-4", item.barClass)}>
                <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)]">
                  <span>{item.label}</span>
                  <Icon className="h-4 w-4 text-[#2563EB] dark:text-cyan-300" />
                </div>
                <p className="mt-2 text-2xl font-extrabold text-[var(--text-primary)] tabular-nums">
                  {formatArabicNumber(item.value)}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">{item.meta}</p>
              </Card>
            </MotionStaggerCard>
          );
        })}
      </MotionStaggerGrid>

      {/* Live Hall Occupancy Radial SVG Bento */}
      <LiveOccupancyBento schoolSlug={schoolSlug} halls={occupancy.halls} />

      {/* 70/30 + 14% VAT + Print Commissions Ledger */}
      {financialSummary && (
        <FinancialSplitCard summary={financialSummary} audience="admin" />
      )}

      {/* Quick Actions */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-extrabold text-[var(--text-primary)]">
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
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#0A1F44] text-cyan-300">
                          <Icon className="h-4 w-4" />
                        </span>
                        <Badge variant="neutral" size="sm">
                          {action.badge}
                        </Badge>
                      </div>
                      <h3 className="mt-3 text-sm font-extrabold text-[var(--text-primary)]">
                        {action.title}
                      </h3>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {action.subtitle}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-xs font-bold text-[#2563EB] dark:text-cyan-300">
                      <span>فتح</span>
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
