import Image from "next/image";
import Link from "next/link";
import { ArrowRight, LogIn } from "lucide-react";
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
    <Card className="mx-auto max-w-lg rounded-3xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3.5">
          <div className="art-pedestal h-16 w-16 shrink-0 overflow-hidden rounded-2xl p-1">
            <Image
              src={isUnauthorized || isForbidden ? "/images/role-student-3d.webp" : "/images/empty-calm-3d.webp"}
              alt="بوابة الطالب"
              width={64}
              height={64}
              className="h-full w-full rounded-xl object-cover"
            />
          </div>
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
