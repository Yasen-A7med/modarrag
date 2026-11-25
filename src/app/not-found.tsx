import Link from "next/link";
import { Home, School } from "lucide-react";
import { ModarragLogo } from "@/components/brand/ModarragLogo";
import { buttonVariants } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--bg-hero)] px-4 py-12 text-center">
      <Link href="/" className="mb-8 inline-flex">
        <ModarragLogo size="lg" showWordmark />
      </Link>

      <div className="w-full max-w-md rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8 hairline-lift">
        <p className="text-4xl font-bold text-[#0B63CE] dark:text-blue-400 tabular-nums">
          404
        </p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
          هذه الصفحة غير موجودة
        </h1>
        <p className="mt-3 text-base leading-relaxed text-[var(--text-secondary)]">
          ربما تم نقل الرابط أو كتابته بشكل مختلف. يمكنك العودة للرئيسية أو الدخول مباشرة لمدرستك.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className={buttonVariants({ variant: "emerald", size: "lg" })}
          >
            <Home className="h-5 w-5" />
            <span>العودة للرئيسية</span>
          </Link>
          <Link
            href="/s/ali-bin-abi-talib"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            <School className="h-5 w-5" />
            <span>صفحة المدرسة</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
