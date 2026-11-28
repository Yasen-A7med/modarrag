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
        title: "تم إنشاء حسابك بنجاح",
        description: "اختر مدرستك ومسارك الدراسي الآن.",
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
    <MotionReveal className="mx-auto w-full max-w-md">
      <Card className="rounded-3xl">
        <CardHeader>
          <div className="flex items-center gap-3.5">
            <div className="art-pedestal h-16 w-16 shrink-0 overflow-hidden rounded-2xl p-1">
              <Image
                src="/images/role-student-3d.webp"
                alt="إنشاء حساب طالب"
                width={64}
                height={64}
                className="h-full w-full rounded-xl object-cover"
              />
            </div>
            <div>
              <CardTitle className="text-2xl">سجّل حسابك في دقيقة</CardTitle>
              <p className="mt-1 text-base text-[var(--text-secondary)]">
                اكتب اسمك كما تحب أن يظهر للمعلم في كشف الحضور
              </p>
            </div>
          </div>
        </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <GoogleSignInButton
          label="التسجيل السريع باستخدام Google"
          initialGoogleEnabled={initialGoogleEnabled}
        />

        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-[var(--border-hairline)]" />
          <span className="mx-3 shrink-0 text-xs font-semibold text-[var(--text-muted)]">
            أو املأ بياناتك يدوياً
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
            label="الاسم الكامل للطالب"
            inputSize="lg"
            required
            minLength={3}
            placeholder="اكتب اسمك الثلاثي كما في المدرسة"
            hint="سيظهر هذا الاسم في كشف حضور الحصة"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            startAdornment={<UserCheck className="h-5 w-5" />}
          />

          <Input
            label="رقم الموبايل"
            type="tel"
            inputSize="lg"
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
            minLength={8}
            autoComplete="new-password"
            dir="ltr"
            placeholder="٨ أحرف أو أرقام على الأقل"
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
            rightIcon={<ArrowLeft className="h-5 w-5" />}
          >
            إنشاء الحساب والمتابعة
          </Button>

          <p className="text-center text-base text-[var(--text-secondary)]">
            لديك حساب بالفعل؟{" "}
            <Link
              href="/login"
              className="font-bold text-[#0B63CE] hover:underline dark:text-blue-400"
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
