"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  UserCheck,
} from "lucide-react";
import { signUpStudentAction } from "@/application/auth/actions";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { MotionReveal } from "@/components/motion/MotionPrimitives";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

export interface RegisterClientProps {
  readonly initialGoogleEnabled?: boolean;
}

export function RegisterClient({
  initialGoogleEnabled,
}: RegisterClientProps = {}) {
  const router = useRouter();
  const { toast } = useToast();

  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const result = await signUpStudentAction({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
      });

      if (!result.ok) {
        setErrorMsg(result.error.message);
        toast({
          title: "تعذر إنشاء الحساب",
          description: result.error.message,
          variant: "error",
        });
        return;
      }

      toast({
        title: "تم إنشاء الحساب بنجاح",
        description: "اختر مدرستك وصفك ومسارك الآن.",
        variant: "success",
      });
      router.push("/onboarding");
      router.refresh();
    } catch {
      setErrorMsg("حدث خطأ أثناء تسجيل الحساب. يرجى المحاولة مرة أخرى.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MotionReveal className="mx-auto w-full max-w-lg">
      <Card className="overflow-hidden rounded-[2rem] border-t-4 border-t-[#2563EB] shadow-[0_24px_60px_-22px_rgba(10,31,68,0.16)]">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <div className="art-pedestal h-16 w-16 shrink-0 overflow-hidden rounded-2xl p-1">
              <Image
                src="/images/role-student-3d.webp"
                alt="إنشاء حساب طالب جديد"
                width={64}
                height={64}
                className="h-full w-full rounded-xl object-cover"
              />
            </div>
            <div>
              <CardTitle className="text-2xl font-extrabold">
                إنشاء حساب طالب
              </CardTitle>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                اكتب اسمك الثلاثي ليظهر للمعلم في كشف الحضور
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pt-1">
          <GoogleSignInButton initialGoogleEnabled={initialGoogleEnabled} />

          <div className="relative flex items-center py-0.5">
            <div className="flex-grow border-t border-[var(--border-hairline)]" />
            <span className="mx-3 shrink-0 text-xs font-semibold text-[var(--text-muted)]">
              أو بالتسجيل اليدوي
            </span>
            <div className="flex-grow border-t border-[var(--border-hairline)]" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              label="الاسم الثلاثي"
              required
              minLength={3}
              inputSize="lg"
              autoComplete="name"
              placeholder="الاسم الكامل كما بكشف الفصل"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              startAdornment={<UserCheck className="h-5 w-5" />}
            />

            <Input
              label="رقم الهاتف (اختياري)"
              type="tel"
              inputSize="lg"
              autoComplete="tel"
              dir="ltr"
              placeholder="01000000000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              startAdornment={<Phone className="h-5 w-5" />}
            />

            <Input
              label="البريد الإلكتروني"
              type="email"
              inputSize="lg"
              required
              autoComplete="email"
              dir="ltr"
              placeholder="student@example.com"
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
              autoComplete="new-password"
              dir="ltr"
              placeholder="٦ أحرف أو أرقام على الأقل"
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
              variant="emerald"
              size="lg"
              fullWidth
              loading={submitting}
              rightIcon={<ArrowLeft className="h-5 w-5" />}
            >
              إنشاء حساب
            </Button>

            <p className="text-center text-sm text-[var(--text-secondary)]">
              لديك حساب بالفعل؟{" "}
              <Link
                href="/login"
                className="font-bold text-[#2563EB] hover:underline dark:text-cyan-300"
              >
                تسجيل الدخول
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </MotionReveal>
  );
}
