"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpLeft,
  Building2,
  CalendarCheck2,
  GraduationCap,
  Landmark,
  Percent,
  Plus,
  Presentation,
  Printer,
  ScrollText,
  Search,
  ShieldAlert,
  Laptop,
} from "lucide-react";
import type { SuperAdminConsoleData } from "@/application/schools/actions";
import { SparklineChart } from "@/components/charts/SparklineChart";
import {
  MotionReveal,
  MotionStaggerCard,
  MotionStaggerGrid,
} from "@/components/motion/MotionPrimitives";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatArabicNumber, formatCairoDate } from "@/lib/formatters";

export interface SuperAdminAccessNoticeProps {
  readonly errorCode: string;
  readonly errorMessage: string;
}

export function SuperAdminAccessNotice({
  errorCode,
  errorMessage,
}: SuperAdminAccessNoticeProps) {
  const isUnauth = errorCode === "UNAUTHORIZED";
  return (
    <Card className="mx-auto max-w-xl rounded-3xl">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <CardTitle className="text-base">
            {isUnauth
              ? "تسجيل الدخول مطلوب لمنصة الإدارة الوطنية"
              : "صلاحية مشرف المنصة مطلوبة"}
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
          <Link href="/" className={buttonVariants({ variant: "outline", size: "md" })}>
            الصفحة الرئيسية
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export interface SuperAdminDashboardClientProps {
  readonly data: SuperAdminConsoleData;
}

/**
 * Slide 11 Blueprint: National Super Admin Console with 3 Sparkline Area Chart KPI cards,
 * Platform 30% + 14% VAT + Print Commission revenue summary, and Navy-header directory table.
 */
export function SuperAdminDashboardClient({
  data,
}: SuperAdminDashboardClientProps) {
  const [query, setQuery] = React.useState("");

  const sparkCards = [
    {
      label: "المدارس والسناتر المفعّلة",
      value: data.kpis.totalSchools,
      icon: Building2,
      color: "#2563EB",
      series: [1, 1, 2, 2, Math.max(2, data.kpis.totalSchools)],
      delta: `${formatArabicNumber(data.kpis.totalTeachers)} معلم معتمد`,
    },
    {
      label: "الطلاب المنضمون",
      value: data.kpis.totalStudents,
      icon: GraduationCap,
      color: "#16A34A",
      series: [12, 24, 38, 52, Math.max(60, data.kpis.totalStudents)],
      delta: `${formatArabicNumber(data.financials.onlineSessionsCount)} حصة أونلاين`,
    },
    {
      label: "الحجوزات والتحضير اليومي",
      value: data.kpis.totalBookingsToday + data.kpis.totalCheckinsToday,
      icon: CalendarCheck2,
      color: "#22D3EE",
      series: [8, 14, 11, 22, Math.max(25, data.kpis.totalBookingsToday + 12)],
      delta: `${formatArabicNumber(data.kpis.totalCheckinsToday)} حضور مسجل اليوم`,
    },
  ] as const;

  const filteredSchools = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.schools;
    return data.schools.filter(
      (s) =>
        s.nameAr.toLowerCase().includes(q) ||
        s.nameEn.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        s.governorate.toLowerCase().includes(q)
    );
  }, [data.schools, query]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header Bar */}
      <MotionReveal className="flex flex-col gap-4 rounded-[2rem] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 hairline-lift">
        <div>
          <Badge variant="primary" size="md">
            القيادة الوطنية للمنصة
          </Badge>
          <h1 className="mt-2 text-2xl font-extrabold text-[var(--text-primary)]">
            لوحة التحكم الوطنية — مُدَرَّج
          </h1>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
            متابعة المدارس والسناتر، العوائد المالية (٣٠٪ + ١٤٪ VAT)، وشركاء الطباعة
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/super-admin/security-logs"
            className={buttonVariants({ variant: "outline", size: "md" })}
          >
            <ScrollText className="h-4 w-4" />
            <span>سجلات التدقيق</span>
          </Link>
          <Link
            href="/super-admin/schools"
            className={buttonVariants({ variant: "primary", size: "md" })}
          >
            <Plus className="h-4 w-4" />
            <span>إنشاء مدرسة جديدة</span>
          </Link>
        </div>
      </MotionReveal>

      {/* Slide 11: 3 Sparkline KPI Cards */}
      <MotionStaggerGrid className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {sparkCards.map((card) => {
          const Icon = card.icon;
          return (
            <MotionStaggerCard key={card.label}>
              <Card className="hover-lift-card overflow-hidden p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-[var(--text-muted)]">
                      {card.label}
                    </span>
                    <p className="mt-1.5 text-3xl font-extrabold text-[var(--text-primary)] tabular-nums">
                      {formatArabicNumber(card.value)}
                    </p>
                  </div>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--bg-sunken)] text-[#2563EB] dark:text-cyan-300">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>

                <div className="mt-3">
                  <SparklineChart data={card.series} strokeColor={card.color} height={44} />
                </div>

                <p className="mt-2 text-xs font-semibold text-[var(--text-secondary)]">
                  {card.delta}
                </p>
              </Card>
            </MotionStaggerCard>
          );
        })}
      </MotionStaggerGrid>

      {/* Platform 30% + 14% VAT + Print Commission Governance Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>حصة المنصة (٣٠٪)</span>
            <Landmark className="h-4 w-4 text-[#2563EB]" />
          </div>
          <p className="mt-1.5 text-xl font-extrabold text-[#2563EB] dark:text-cyan-300 tabular-nums">
            {formatArabicNumber(data.financials.totalPlatformEarningsEgp)} ج.م
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>ضريبة القيمة المضافة ١٤٪</span>
            <Percent className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-1.5 text-xl font-extrabold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(data.financials.totalVatCollectedEgp)} ج.م
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>عمولات المطبعة أونلاين</span>
            <Printer className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-1.5 text-xl font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatArabicNumber(data.financials.totalPrintCommissionEgp)} ج.م
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>طلبات الطباعة / الأونلاين</span>
            <Laptop className="h-4 w-4 text-cyan-600" />
          </div>
          <p className="mt-1.5 text-xl font-extrabold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(data.financials.printOrdersCount)} /{" "}
            {formatArabicNumber(data.financials.onlineSessionsCount)}
          </p>
        </Card>
      </div>

      {/* Slide 11 Navy-Header Multi-Tenant Directory Table */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--border-hairline)] pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base font-extrabold">
              المدارس والسناتر المسجلة ({formatArabicNumber(filteredSchools.length)})
            </CardTitle>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بحث باسم المدرسة أو المحافظة..."
              startAdornment={<Search className="h-4 w-4" />}
              containerClassName="sm:w-72"
            />
          </div>
        </CardHeader>

        <div tabIndex={0} role="region" aria-label="دليل المدارس" className="table-wrapper">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="bg-[#0A1F44] text-white">
                <th className="px-4 py-3 text-start font-bold">المدرسة / المنشأة</th>
                <th className="px-4 py-3 text-start font-bold">النوع</th>
                <th className="px-4 py-3 text-start font-bold">المحافظة</th>
                <th className="px-4 py-3 text-start font-bold">التقسيم / VAT</th>
                <th className="px-4 py-3 text-start font-bold">الحالة</th>
                <th className="px-4 py-3 text-end font-bold">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-hairline)]">
              {filteredSchools.map((school) => (
                <tr key={school.id} className="hover:bg-[var(--bg-sunken)]/60">
                  <td className="px-4 py-3.5">
                    <p className="font-extrabold text-[var(--text-primary)]">{school.nameAr}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      <span dir="ltr" className="font-mono">{school.slug}</span> ·{" "}
                      {formatCairoDate(school.createdAt)}
                    </p>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge variant={school.tenantType === "center" ? "info" : "neutral"}>
                      {school.tenantType === "center" ? "سنتر" : "مدرسة"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 text-xs font-semibold text-[var(--text-secondary)]">
                    {school.governorate}
                  </td>
                  <td className="px-4 py-3.5 text-xs font-bold tabular-nums text-[var(--text-primary)]">
                    {formatArabicNumber(school.teacherSharePct)}/
                    {formatArabicNumber(school.platformFeePct)} · VAT{" "}
                    {formatArabicNumber(school.vatRatePct)}٪
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge variant={school.isActive ? "success" : "neutral"} dot>
                      {school.isActive ? "مفعّلة" : "متوقفة"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/s/${school.slug}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <span>البوابة</span>
                        <ArrowUpLeft className="h-3.5 w-3.5" />
                      </Link>
                      <Link
                        href={`/s/${school.slug}/admin/presentation`}
                        className={buttonVariants({ variant: "primary", size: "sm" })}
                      >
                        <Presentation className="h-3.5 w-3.5" />
                        <span>عرض</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
