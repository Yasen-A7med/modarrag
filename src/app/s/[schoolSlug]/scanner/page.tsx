import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, ArrowRight, Lock, LogIn, ShieldAlert } from "lucide-react";
import { getCurrentUserContext } from "@/application/auth/actions";
import { getScannerSessions } from "@/application/attendance/actions";
import { GateScannerClient } from "@/components/scanner/GateScannerClient";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getSchoolBySlug } from "@/infrastructure/supabase/catalog";
import { getUserRoleLabel } from "@/lib/formatters";

export const metadata: Metadata = {
  title: "ماسح تذاكر البوابة",
};

export const dynamic = "force-dynamic";

export interface GateScannerPageProps {
  readonly params: Promise<{ readonly schoolSlug: string }>;
}

export default async function GateScannerPage({
  params,
}: GateScannerPageProps) {
  const { schoolSlug } = await params;

  const [scannerResult, school, userCtx] = await Promise.all([
    getScannerSessions(schoolSlug),
    getSchoolBySlug(schoolSlug).catch(() => null),
    getCurrentUserContext().catch(() => null),
  ]);

  if (!scannerResult.ok) {
    const isUnauthorized = scannerResult.error.code === "UNAUTHORIZED";
    const isForbidden = scannerResult.error.code === "FORBIDDEN";

    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] text-[var(--text-primary)]">
                {isUnauthorized ? (
                  <Lock className="h-5 w-5 text-[#1E3A8A] dark:text-blue-400" />
                ) : isForbidden ? (
                  <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                )}
              </span>
              <CardTitle>
                {isUnauthorized
                  ? "تسجيل الدخول مطلوب لتشغيل الماسح"
                  : isForbidden
                    ? "صلاحية مشرف البوابة مطلوبة"
                    : "تعذر تحميل بيانات البوابة"}
              </CardTitle>
            </div>
            <Badge variant={isUnauthorized ? "primary" : isForbidden ? "warning" : "danger"}>
              {isUnauthorized ? "غير مسجل" : isForbidden ? "تقييد وصول" : "خطأ"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {isUnauthorized
              ? "يلزم تسجيل الدخول بحساب مشرف البوابة أو المعلم أو منسق المدرسة لتشغيل ماسح تذاكر QR."
              : isForbidden
                ? userCtx
                  ? `الحساب الحالي مسجل بدور "${getUserRoleLabel(userCtx.role, "ar")}". تشغيل ماسح البوابة متاح فقط لحسابات مشرف البوابة أو منسق المدرسة أو المعلم المعتمد داخل نفس المدرسة.`
                  : scannerResult.error.message
                : scannerResult.error.message}
          </p>

          <div className="flex flex-wrap items-center gap-2.5">
            {isUnauthorized ? (
              <>
                <Link
                  href="/login"
                  className={buttonVariants({ variant: "primary", size: "md" })}
                >
                  <LogIn className="h-4 w-4 shrink-0" />
                  <span>تسجيل الدخول</span>
                </Link>
                <Link
                  href={`/s/${schoolSlug}`}
                  className={buttonVariants({ variant: "outline", size: "md" })}
                >
                  <ArrowRight className="h-4 w-4 shrink-0" />
                  <span>صفحة المدرسة</span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  href={`/s/${schoolSlug}`}
                  className={buttonVariants({ variant: "primary", size: "md" })}
                >
                  <ArrowRight className="h-4 w-4 shrink-0" />
                  <span>العودة لصفحة المدرسة</span>
                </Link>
                <Link
                  href="/login"
                  className={buttonVariants({ variant: "outline", size: "md" })}
                >
                  <LogIn className="h-4 w-4 shrink-0" />
                  <span>تبديل الحساب</span>
                </Link>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <GateScannerClient
      schoolSlug={schoolSlug}
      schoolNameAr={school?.name_ar ?? schoolSlug}
      initialData={scannerResult.data}
    />
  );
}
