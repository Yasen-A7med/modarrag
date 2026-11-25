"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import {
  signInDemoRoleAction,
  signInWithPasswordAction,
} from "@/application/auth/actions";
import { Badge } from "@/components/ui/Badge";
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
  | "gate_scanner"
  | "super_admin";

interface DemoAccountOption {
  readonly roleKey: DemoRoleKey;
  readonly labelAr: string;
  readonly code: string;
  readonly hintAr: string;
}

const DEMO_ROLES: readonly DemoAccountOption[] = [
  {
    roleKey: "student_201",
    labelAr: "طالب الهندسة",
    code: "S-201",
    hintAr: "بوابة الطالب",
  },
  {
    roleKey: "student_202",
    labelAr: "طالب الآداب",
    code: "S-202",
    hintAr: "اختياري إيطالي",
  },
  {
    roleKey: "teacher_101",
    labelAr: "معلم البرمجة",
    code: "T-101",
    hintAr: "إدارة الحصص",
  },
  {
    roleKey: "school_admin",
    labelAr: "منسق المدرسة",
    code: "AD-101",
    hintAr: "القاعات والمناهج",
  },
  {
    roleKey: "gate_scanner",
    labelAr: "مشرف البوابة",
    code: "GS-101",
    hintAr: "ماسح التذاكر",
  },
  {
    roleKey: "super_admin",
    labelAr: "مدير المنصة",
    code: "SA-001",
    hintAr: "المدارس والتدقيق",
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
        title: "تم تسجيل الدخول",
        variant: "success",
      });
      router.push(result.data.redirectTo);
      router.refresh();
    } catch {
      setErrorMsg("حدث خطأ غير متوقع أثناء التحقق من الحساب.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoSignIn = async (roleKey: DemoRoleKey) => {
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
        title: "تم تفعيل الجلسة التجريبية",
        variant: "success",
      });
      router.push(result.data.redirectTo);
      router.refresh();
    } catch {
      setErrorMsg("تعذر الاتصال بخادم المصادقة.");
    } finally {
      setLoadingRole(null);
    }
  };

  const isBusy = submitting || loadingRole !== null;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      {/* 1-Click Demo Role Switcher Bar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <KeyRound className="h-4 w-4 text-[#1E3A8A] dark:text-blue-400" />
              <span>دخول تجريبي سريع</span>
            </CardTitle>
            <Badge variant="success" dot>
              حسابات معتمدة
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {DEMO_ROLES.map((item) => {
              const activeLoading = loadingRole === item.roleKey;
              return (
                <button
                  key={item.roleKey}
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleDemoSignIn(item.roleKey)}
                  className={cn(
                    "flex min-h-[56px] flex-col items-start justify-between rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-2.5 text-start transition-colors cursor-pointer",
                    "hover:border-[#1E3A8A] hover:bg-[var(--bg-surface)] dark:hover:border-blue-500",
                    "disabled:pointer-events-none disabled:opacity-60",
                    activeLoading && "border-[#1E3A8A] bg-blue-50/70 dark:bg-blue-500/15"
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-1">
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {item.labelAr}
                    </span>
                    <span
                      className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--text-secondary)]"
                      dir="ltr"
                    >
                      {activeLoading ? "..." : item.code}
                    </span>
                  </div>
                  <span className="mt-1 text-[11px] text-[var(--text-muted)]">
                    {item.hintAr}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Standard Password Login Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">تسجيل الدخول</CardTitle>
            <Badge variant="mono" dir="ltr">
              AUTH
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <Input
              label="البريد الإلكتروني"
              type="email"
              inputSize="lg"
              dir="ltr"
              required
              autoComplete="email"
              placeholder="student-s201@ali-bin-abi-talib.modarrag.app"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              startAdornment={<Mail className="h-4 w-4" />}
            />

            <Input
              label="كلمة المرور"
              type={showPassword ? "text" : "password"}
              inputSize="lg"
              dir="ltr"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              startAdornment={<Lock className="h-4 w-4" />}
              endAdornment={
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
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
              disabled={isBusy}
              leftIcon={<ShieldCheck className="h-4 w-4" />}
            >
              دخول
            </Button>

            <div className="flex items-center justify-between border-t border-[var(--border-hairline)] pt-3 text-xs text-[var(--text-muted)]">
              <span>طالب جديد بالمنصة؟</span>
              <Link
                href="/register"
                className="font-semibold text-[#1E3A8A] hover:underline dark:text-blue-400"
              >
                إنشاء حساب
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
