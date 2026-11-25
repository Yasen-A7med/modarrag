"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BookOpen,
  Building2,
  ClipboardCheck,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Mail,
  Shield,
} from "lucide-react";
import {
  signInDemoRoleAction,
  signInWithPasswordAction,
} from "@/application/auth/actions";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

export type DemoRoleKey =
  | "student_201"
  | "student_202"
  | "teacher_101"
  | "school_admin"
  | "super_admin";

interface DemoAccountCard {
  readonly roleKey: DemoRoleKey;
  readonly labelAr: string;
  readonly hintAr: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly accentClass: string;
}

const PRIMARY_DEMO_ROLES: readonly DemoAccountCard[] = [
  {
    roleKey: "student_201",
    labelAr: "طالب الهندسة",
    hintAr: "احجز حصصك بالاسم بضغطة واحدة",
    icon: GraduationCap,
    accentClass: "border-blue-200 bg-[#EEF5FF]/60 hover:border-[#0B63CE] dark:border-blue-500/30 dark:bg-blue-500/10",
  },
  {
    roleKey: "student_202",
    labelAr: "طالب الآداب",
    hintAr: "طالب مسار الآداب واللغة الإيطالية",
    icon: BookOpen,
    accentClass: "border-sky-200 bg-sky-50/70 hover:border-sky-600 dark:border-sky-500/30 dark:bg-sky-500/10",
  },
  {
    roleKey: "teacher_101",
    labelAr: "معلم المادة",
    hintAr: "افتح كشف الأسماء وسجّل الحضور ✓",
    icon: ClipboardCheck,
    accentClass: "border-emerald-200 bg-emerald-50/70 hover:border-[#16A34A] dark:border-emerald-500/30 dark:bg-emerald-500/10",
  },
  {
    roleKey: "school_admin",
    labelAr: "إدارة المدرسة",
    hintAr: "القاعات والمناهج والتقارير اليومية",
    icon: Building2,
    accentClass: "border-amber-200 bg-amber-50/70 hover:border-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10",
  },
] as const;

export function LoginClient() {
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [loadingRole, setLoadingRole] = React.useState<DemoRoleKey | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const result = await signInWithPasswordAction({
        email: email.trim(),
        password,
      });

      if (!result.ok) {
        setErrorMsg(result.error.message);
        toast({
          title: "تعذر تسجيل الدخول",
          description: result.error.message,
          variant: "error",
        });
        return;
      }

      toast({
        title: "أهلاً بك في مُدَرَّج",
        variant: "success",
      });
      router.push(result.data.redirectTo);
      router.refresh();
    } catch {
      setErrorMsg("تعذر الاتصال الآن. يرجى المحاولة مرة أخرى.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoSignIn = async (roleKey: DemoRoleKey, labelAr: string) => {
    setErrorMsg(null);
    setLoadingRole(roleKey);

    try {
      const result = await signInDemoRoleAction({ roleKey });

      if (!result.ok) {
        setErrorMsg(result.error.message);
        toast({
          title: "تعذر الدخول التجريبي",
          description: result.error.message,
          variant: "error",
        });
        return;
      }

      toast({
        title: `مرحباً بك — ${labelAr}`,
        variant: "success",
      });
      router.push(result.data.redirectTo);
      router.refresh();
    } catch {
      setErrorMsg("تعذر تسجيل الدخول للحساب التجريبي.");
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {/* 1-Tap Friendly Demo Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">تجربة فورية بضغطة واحدة</CardTitle>
          <p className="text-base text-[var(--text-secondary)]">
            اختَر دورك لتدخل مباشرةً بدون كتابة كلمة مرور
          </p>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PRIMARY_DEMO_ROLES.map((item) => {
              const Icon = item.icon;
              const isBusy = loadingRole === item.roleKey;
              return (
                <button
                  key={item.roleKey}
                  type="button"
                  disabled={loadingRole !== null || submitting}
                  onClick={() => handleDemoSignIn(item.roleKey, item.labelAr)}
                  className={cn(
                    "flex min-h-[76px] items-center gap-3.5 rounded-2xl border p-4 text-start transition-[border-color,transform] cursor-pointer",
                    "active:scale-[0.98] disabled:opacity-60",
                    item.accentClass
                  )}
                >
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-surface)] text-[#0B63CE] shadow-xs dark:text-blue-300">
                    <Icon className="h-6 w-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-[var(--text-primary)]">
                      {isBusy ? "جاري الدخول..." : item.labelAr}
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                      {item.hintAr}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border-hairline)] pt-3">
            <span className="text-sm text-[var(--text-muted)]">
              لإدارة المدارس على مستوى المحافظة:
            </span>
            <button
              type="button"
              disabled={loadingRole !== null || submitting}
              onClick={() => handleDemoSignIn("super_admin", "مشرف المنصة العام")}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-3.5 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-strong)] cursor-pointer disabled:opacity-60"
            >
              <Shield className="h-4 w-4 text-[#0B63CE] dark:text-blue-400" />
              <span>
                {loadingRole === "super_admin" ? "جاري الدخول..." : "مشرف المنصة"}
              </span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Standard Email / Password Sign-In */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">أو ادخل بحسابك المسجل</CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
              >
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <Input
              label="البريد الإلكتروني"
              type="email"
              inputSize="lg"
              required
              autoComplete="email"
              dir="ltr"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              startAdornment={<Mail className="h-5 w-5" />}
            />

            <Input
              label="كلمة المرور"
              type={showPassword ? "text" : "password"}
              inputSize="lg"
              required
              minLength={6}
              autoComplete="current-password"
              dir="ltr"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              startAdornment={<Lock className="h-5 w-5" />}
              endAdornment={
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              }
            />

            <Button
              type="submit"
              variant="emerald"
              size="lg"
              fullWidth
              loading={submitting}
              disabled={loadingRole !== null}
            >
              تسجيل الدخول
            </Button>

            <p className="text-center text-base text-[var(--text-secondary)]">
              طالب جديد وليس لديك حساب؟{" "}
              <Link
                href="/register"
                className="font-bold text-[#0B63CE] hover:underline dark:text-blue-400"
              >
                أنشئ حسابك هنا
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
