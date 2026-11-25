import Link from "next/link";
import { AlertCircle, ArrowRight, Lock, LogIn, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { AppError } from "@/domain/common/errors";
import type { UserRole } from "@/infrastructure/supabase/database.types";
import { getUserRoleLabel } from "@/lib/formatters";

export interface StudentAccessGuardProps {
  readonly error: AppError;
  readonly schoolSlug: string;
  readonly userRole?: UserRole | null;
}

/**
 * Clean Arabic fallback surface for unauthorized, forbidden, or missing portal records.
 */
export function StudentAccessGuard({
  error,
  schoolSlug,
  userRole,
}: StudentAccessGuardProps) {
  const isUnauthorized = error.code === "UNAUTHORIZED";
  const isForbidden = error.code === "FORBIDDEN";

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
                ? "تسجيل الدخول مطلوب"
                : isForbidden
                  ? "صلاحية الوصول غير متطابقة"
                  : "تعذر تحميل بيانات البوابة"}
            </CardTitle>
          </div>
          <Badge variant={isUnauthorized ? "primary" : isForbidden ? "warning" : "danger"}>
            {isUnauthorized ? "جلسة غير مسجلة" : isForbidden ? "تقييد صلاحية" : "تنبيه"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          {isUnauthorized
            ? "يلزم تسجيل الدخول بحساب الطالب لعرض الحصص المتاحة وإصدار تذاكر الدخول الرقمية."
            : isForbidden
              ? userRole
                ? `الحساب الحالي مسجل بدور "${getUserRoleLabel(userRole, "ar")}". هذه الصفحة مخصصة لصاحب التذكرة أو حساب الطالب المقيد بالمدرسة.`
                : error.message || "لا تملك صلاحية عرض هذا السجل داخل هذه المدرسة."
              : error.message || "حدث تعذر مؤقت أثناء تحميل البيانات المطلوبة."}
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
