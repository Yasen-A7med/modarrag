"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpLeft,
  Building2,
  CalendarCheck2,
  Download,
  GraduationCap,
  Plus,
  Presentation,
  QrCode,
  ScrollText,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";
import type { SuperAdminConsoleData } from "@/application/schools/actions";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatArabicNumber, formatCairoDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export interface SuperAdminAccessNoticeProps {
  readonly errorCode: string;
  readonly errorMessage: string;
}

/**
 * Clean RTL gate shown when a non-super-admin visits /super-admin/*.
 */
export function SuperAdminAccessNotice({
  errorCode,
  errorMessage,
}: SuperAdminAccessNoticeProps) {
  const isUnauth = errorCode === "UNAUTHORIZED";
  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <CardTitle className="text-base">
              {isUnauth
                ? "تسجيل الدخول مطلوب لمنصة الإدارة الوطنية"
                : "صلاحية مدير المنصة (Super Admin) مطلوبة"}
            </CardTitle>
            <p className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]" dir="ltr">
              {errorCode}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {isUnauth
            ? "سجّل الدخول بحساب مدير المنصة أو استخدم الحساب التجريبي SA-001 لاستعراض المدارس وسجلات الأمان."
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
            href="/"
            className={buttonVariants({
              variant: "outline",
              size: "md",
              className: "min-h-[44px]",
            })}
          >
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
 * Super Admin National Console: 5 national KPIs and active multi-tenant schools directory.
 */
export function SuperAdminDashboardClient({
  data,
}: SuperAdminDashboardClientProps) {
  const [query, setQuery] = React.useState("");

  const kpis = [
    {
      label: "المدارس المفعلة",
      value: data.kpis.totalSchools,
      icon: Building2,
      color: "text-[#1E3A8A] dark:text-blue-400",
    },
    {
      label: "إجمالي الطلاب",
      value: data.kpis.totalStudents,
      icon: GraduationCap,
      color: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "المعلمون المعتمدون",
      value: data.kpis.totalTeachers,
      icon: Users,
      color: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "حجوزات اليوم",
      value: data.kpis.totalBookingsToday,
      icon: CalendarCheck2,
      color: "text-sky-600 dark:text-sky-400",
    },
    {
      label: "تسجيلات الحضور اليوم",
      value: data.kpis.totalCheckinsToday,
      icon: QrCode,
      color: "text-emerald-600 dark:text-emerald-400",
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
      <Card>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary">المركز الوطني لإدارة المنصة</Badge>
              <Badge variant="mono" dir="ltr">
                MULTI-TENANT RLS
              </Badge>
            </div>
            <h1 className="mt-2 text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
              لوحة التحكم الوطنية — مُدَرَّج
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-[var(--text-muted)]">
              إشراف موحد على المدارس المشاركة، إطلاق المدارس بقوالب البكالوريا، ومراجعة سجلات الأمان
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/super-admin/security-logs"
              className={buttonVariants({
                variant: "outline",
                size: "md",
                className: "min-h-[44px]",
              })}
            >
              <ScrollText className="h-4 w-4" />
              <span>سجلات التدقيق</span>
            </Link>
            <Link
              href="/super-admin/schools"
              className={buttonVariants({
                variant: "primary",
                size: "md",
                className: "min-h-[44px]",
              })}
            >
              <Plus className="h-4 w-4" />
              <span>إنشاء مدرسة جديدة</span>
            </Link>
          </div>
        </div>
      </Card>

      {/* 5 National KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--text-muted)]">
                  {kpi.label}
                </span>
                <Icon className={cn("h-4 w-4", kpi.color)} />
              </div>
              <p className="mt-2 text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                {formatArabicNumber(kpi.value)}
              </p>
            </Card>
          );
        })}
      </div>

      {/* Active Tenant Schools Directory */}
      <Card>
        <CardHeader className="border-b border-[var(--border-hairline)] pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">المدارس المسجلة بالمنصة</CardTitle>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                انتقل مباشرة إلى بوابة كل مدرسة أو افتح ملف العرض التنفيذي للوزارة
              </p>
            </div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بحث باسم المدرسة أو المحافظة أو slug..."
              startAdornment={<Search className="h-4 w-4" />}
              containerClassName="sm:w-72"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredSchools.length === 0 ? (
            <div className="p-10 text-center text-xs text-[var(--text-muted)]">
              لا توجد مدارس مطابقة لنتائج البحث.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-hairline)]">
              {filteredSchools.map((school) => (
                <div
                  key={school.id}
                  className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={school.isActive ? "success" : "neutral"} dot>
                        {school.isActive ? "مفعلة" : "متوقفة"}
                      </Badge>
                      <Badge variant="mono" dir="ltr">
                        {school.slug}
                      </Badge>
                      <Badge variant="neutral">{school.governorate}</Badge>
                    </div>
                    <h3 className="mt-2 text-sm sm:text-base font-bold text-[var(--text-primary)]">
                      {school.nameAr}
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      <span dir="ltr" className="font-mono">
                        {school.nameEn}
                      </span>
                      {" · "}
                      <span>تاريخ الإنشاء: {formatCairoDate(school.createdAt)}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/s/${school.slug}`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                        className: "min-h-[44px]",
                      })}
                    >
                      <span>بوابة المدرسة</span>
                      <ArrowUpLeft className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href={`/s/${school.slug}/admin/presentation`}
                      className={buttonVariants({
                        variant: "primary",
                        size: "sm",
                        className: "min-h-[44px]",
                      })}
                    >
                      <Presentation className="h-3.5 w-3.5" />
                      <span>عرض الوزارة</span>
                    </Link>
                    <a
                      href={`/api/reports/export?schoolSlug=${encodeURIComponent(school.slug)}&format=csv`}
                      className={buttonVariants({
                        variant: "secondary",
                        size: "sm",
                        className: "min-h-[44px]",
                      })}
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>CSV</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
