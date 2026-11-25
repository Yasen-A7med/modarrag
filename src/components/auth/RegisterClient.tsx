"use client";

import * as React from "react";
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
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

export function RegisterClient() {
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
        title: "تم إنشاء الحساب",
        description: "جاري الانتقال لاستكمال بيانات المدرسة والمسار.",
        variant: "success",
      });
      router.push("/onboarding");
      router.refresh();
    } catch {
      setErrorMsg("حدث خطأ أثناء تسجيل الحساب. يرجى المحاولة مجدداً.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">حساب طالب جديد</CardTitle>
          <Badge variant="primary">البكالوريا</Badge>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            label="الاسم أو الرمز التعريفي للطالب"
            inputSize="lg"
            required
            minLength={3}
            placeholder="مثال: طالب ٢ بكالوريا — كود S-205"
            hint="اكتب البيان التعريفي المطابق لسجل المدرسة"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            startAdornment={<UserCheck className="h-4 w-4" />}
          />

          <Input
            label="رقم الهاتف المحمول"
            type="tel"
            inputMode="tel"
            inputSize="lg"
            dir="ltr"
            required
            placeholder="01012345678"
            hint="رقم الطالب للتنبيهات وتأكيد الحجز"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            startAdornment={<Phone className="h-4 w-4" />}
          />

          <Input
            label="البريد الإلكتروني"
            type="email"
            inputSize="lg"
            dir="ltr"
            required
            autoComplete="email"
            placeholder="student-s205@modarrag.app"
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
            minLength={8}
            autoComplete="new-password"
            placeholder="••••••••"
            hint="٨ أحرف على الأقل"
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
            rightIcon={<ArrowLeft className="h-4 w-4" />}
            className="mt-1 h-[52px]"
          >
            متابعة التسجيل
          </Button>

          <div className="flex items-center justify-between border-t border-[var(--border-hairline)] pt-3 text-xs text-[var(--text-muted)]">
            <span>لديك حساب مسجل؟</span>
            <Link
              href="/login"
              className="font-semibold text-[#1E3A8A] hover:underline dark:text-blue-400"
            >
              تسجيل الدخول
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
