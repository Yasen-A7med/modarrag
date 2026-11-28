"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Shield,
  Sparkles,
} from "lucide-react";
import {
  signInDemoRoleAction,
  signInWithPasswordAction,
} from "@/application/auth/actions";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { MotionReveal } from "@/components/motion/MotionPrimitives";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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
  readonly artwork: string;
  readonly accentClass: string;
}

const PRIMARY_DEMO_ROLES: readonly DemoAccountCard[] = [
  {
    roleKey: "student_201",
    labelAr: "طالب الهندسة",
    hintAr: "حجز بالاسم ومتابعة البث",
    artwork: "/images/role-student-3d.webp",
    accentClass:
      "border-[#2563EB]/25 bg-blue-50/60 hover:border-[#2563EB] dark:border-blue-500/30 dark:bg-blue-500/12",
  },
  {
    roleKey: "student_202",
    labelAr: "طالب الآداب",
    hintAr: "مسار الآداب واللغة الثانية",
    artwork: "/images/track-arts.webp",
    accentClass:
      "border-cyan-500/25 bg-cyan-50/60 hover:border-cyan-500 dark:border-cyan-500/30 dark:bg-cyan-500/12",
  },
  {
    roleKey: "teacher_101",
    labelAr: "معلم المادة",
    hintAr: "الحضور، المحاضرات، والمطبعة",
    artwork: "/images/role-teacher-3d.webp",
    accentClass:
      "border-emerald-500/25 bg-emerald-50/60 hover:border-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/12",
  },
  {
    roleKey: "school_admin",
    labelAr: "إدارة المدرسة",
    hintAr: "القاعات، المناهج، وعرض الوزارة",
    artwork: "/images/role-admin-3d.webp",
    accentClass:
      "border-amber-500/25 bg-amber-50/60 hover:border-amber-600 dark:border-amber-500/30 dark:bg-amber-500/12",
  },
] as const;

export interface LoginClientProps {
  readonly initialGoogleEnabled?: boolean;
  readonly initialErrorCode?: string | null;
}

export function LoginClient({
  initialGoogleEnabled,
  initialErrorCode,
}: LoginClientProps = {}) {
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [loadingRole, setLoadingRole] = React.useState<DemoRoleKey | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(
    initialErrorCode === "oauth"
      ? "تعذر إكمال تسجيل الدخول عبر Google. يرجى المحاولة مرة أخرى."
      : null
  );

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

      toast({ title: "أهلاً بك في مُدَرَّج", variant: "success" });
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

      toast({ title: `مرحباً بك — ${labelAr}`, variant: "success" });
      router.push(result.data.redirectTo);
      router.refresh();
    } catch {
      setErrorMsg("تعذر تسجيل الدخول للحساب التجريبي.");
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <MotionReveal className="mx-auto w-full max-w-5xl">
      <div className="grid grid-cols-1 overflow-hidden rounded-[2rem] border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-[0_24px_60px_-22px_rgba(10,31,68,0.16)] lg:grid-cols-12">
        {/* Right Column (RTL first): Instant Role Switcher */}
        <div className="flex flex-col justify-between gap-6 border-b border-[var(--border-hairline)] bg-[#0A1F44]/[0.025] p-6 sm:p-8 lg:col-span-6 lg:border-b-0 lg:border-e dark:bg-white/[0.02]">
          <div>
            <Badge variant="info" size="md">
              <Sparkles className="h-3.5 w-3.5" />
              <span>دخول تجريبي فوري</span>
            </Badge>
            <h1 className="mt-3 text-2xl font-extrabold text-[var(--text-primary)]">
              تجربة بضغطة واحدة
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              اختر الدور الوظيفي للدخول مباشرةً بدون كتابة كلمة مرور
            </p>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PRIMARY_DEMO_ROLES.map((item) => {
                const isBusy = loadingRole === item.roleKey;
                return (
                  <button
                    key={item.roleKey}
                    type="button"
                    disabled={loadingRole !== null || submitting}
                    onClick={() => handleDemoSignIn(item.roleKey, item.labelAr)}
                    className={cn(
                      "group hover-lift-card flex min-h-[82px] w-full items-center gap-3 rounded-2xl border p-3.5 text-start cursor-pointer",
                      "active:scale-[0.98] disabled:opacity-60",
                      item.accentClass
                    )}
                  >
                    <span className="art-pedestal h-12 w-12 shrink-0 overflow-hidden rounded-xl p-1">
                      <Image
                        src={item.artwork}
                        alt={item.labelAr}
                        width={48}
                        height={48}
                        className="h-full w-full rounded-lg object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[var(--text-primary)]">
                        {isBusy ? "جاري الدخول..." : item.labelAr}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        {item.hintAr}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-3">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              إدارة المنصة على مستوى الجمهورية
            </span>
            <button
              type="button"
              disabled={loadingRole !== null || submitting}
              onClick={() => handleDemoSignIn("super_admin", "مشرف المنصة")}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#0A1F44] px-4 text-xs font-bold text-white hover:bg-[#132E5C] cursor-pointer disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              <Shield className="h-4 w-4 text-cyan-300" />
              <span>
                {loadingRole === "super_admin" ? "جاري الدخول..." : "مشرف المنصة"}
              </span>
            </button>
          </div>
        </div>

        {/* Left Column: Standard Google OAuth & Email/Password */}
        <div className="flex flex-col justify-center gap-5 p-6 sm:p-8 lg:col-span-6">
          <div>
            <h2 className="text-xl font-extrabold text-[var(--text-primary)]">
              تسجيل الدخول بحسابك
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              ادخل بالبريد الإلكتروني أو حساب Google الرسمي
            </p>
          </div>

          <GoogleSignInButton initialGoogleEnabled={initialGoogleEnabled} />

          <div className="relative flex items-center py-0.5">
            <div className="flex-grow border-t border-[var(--border-hairline)]" />
            <span className="mx-3 shrink-0 text-xs font-semibold text-[var(--text-muted)]">
              أو بالبريد الإلكتروني
            </span>
            <div className="flex-grow border-t border-[var(--border-hairline)]" />
          </div>

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
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
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
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting}
              disabled={loadingRole !== null}
            >
              دخول
            </Button>

            <p className="text-center text-sm text-[var(--text-secondary)]">
              طالب جديد وليس لديك حساب؟{" "}
              <Link
                href="/register"
                className="font-bold text-[#2563EB] hover:underline dark:text-cyan-300"
              >
                إنشاء حساب طالب
              </Link>
            </p>
          </form>
        </div>
      </div>
    </MotionReveal>
  );
}
