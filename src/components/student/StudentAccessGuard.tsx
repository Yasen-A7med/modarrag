import Link from "next/link";
import { AlertCircle, ArrowRight, Lock, LogIn, ShieldAlert } from "lucide-react";
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
 * Simple, welcoming Arabic access fallback for Student Portal without developer jargon.
 */
export function StudentAccessGuard({
  error,
  schoolSlug,
  userRole,
}: StudentAccessGuardProps) {
  const isUnauthorized = error.code === "UNAUTHORIZED";
  const isForbidden = error.code === "FORBIDDEN";

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)]">
            {isUnauthorized ? (
              <Lock className="h-6 w-6 text-[#0B63CE] dark:text-blue-400" />
            ) : isForbidden ? (
              <ShieldAlert className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            ) : (
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            )}
          </span>
          <CardTitle className="text-xl">
            {isUnauthorized
              ? "سجّل دخولك لعرض حصصك"
              : isForbidden
                ? "هذه الصفحة خاصة بحسابات المدرسة"
                : "تعذر تحميل بيانات الطالب"}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <p className="text-base leading-relaxed text-[var(--text-secondary)]">
          {isUnauthorized
            ? "ادخل بحسابك أو جرّب حساب الطالب الجاهز لمشاهدة الحصص المتاحة وحجز مقعدك باسمك."
            : isForbidden
              ? userRole
                ? `أنت مسجل حالياً بصلاحية (${getUserRoleLabel(userRole, "ar")}). اختر حساب الطالب إذا أردت تجربة الحجز.`
                : error.message
              : error.message}
        </p>

        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Link
            href="/login"
            className={buttonVariants({ variant: "emerald", size: "lg" })}
          >
            <LogIn className="h-5 w-5" />
            <span>تسجيل الدخول</span>
          </Link>

          <Link
            href={`/s/${schoolSlug}`}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            <ArrowRight className="h-5 w-5" />
            <span>العودة لصفحة المدرسة</span>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
