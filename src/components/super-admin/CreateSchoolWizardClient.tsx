"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  createSchoolTenantAction,
  type SuperAdminConsoleData,
} from "@/application/schools/actions";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatArabicNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const BRAND_COLORS = ["#1E3A8A", "#059669", "#D97706", "#0F766E", "#4338CA"] as const;
const BUFFER_PRESETS = [10, 15, 20, 30] as const;

const TEMPLATE_TRACKS_PREVIEW = [
  { code: "ENGINEERING", label: "الهندسة والتكنولوجيا" },
  { code: "MEDICINE_LIFE", label: "الطب وعلوم الحياة" },
  { code: "BUSINESS", label: "الاقتصاد والأعمال" },
  { code: "ARTS_HUMANITIES", label: "الآداب والعلوم الإنسانية" },
] as const;

function slugifyEnglish(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export interface CreateSchoolWizardClientProps {
  readonly existingSchools: SuperAdminConsoleData["schools"];
}

/**
 * 2-Step Create Tenant School Wizard with optional instant SEC_2_BACC template seeding.
 */
export function CreateSchoolWizardClient({
  existingSchools,
}: CreateSchoolWizardClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = React.useState<1 | 2>(1);
  const [nameAr, setNameAr] = React.useState("");
  const [nameEn, setNameEn] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [governorate, setGovernorate] = React.useState("القاهرة");
  const [directorate, setDirectorate] = React.useState("");

  const [brandColorHex, setBrandColorHex] = React.useState("#1E3A8A");
  const [logoUrl, setLogoUrl] = React.useState("");
  const [defaultBufferMinutes, setDefaultBufferMinutes] = React.useState<number>(15);
  const [withBaccalaureateTemplate, setWithBaccalaureateTemplate] =
    React.useState<boolean>(true);

  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [createdResult, setCreatedResult] = React.useState<{
    readonly schoolId: string;
    readonly slug: string;
  } | null>(null);

  const handleNextStep = () => {
    setErrorMsg(null);
    if (nameAr.trim().length < 2 || nameEn.trim().length < 2) {
      setErrorMsg("يرجى كتابة اسم المدرسة باللغتين العربية والإنجليزية (حرفان على الأقل).");
      return;
    }
    if (!/^[a-z0-9-]{2,80}$/.test(slug.trim())) {
      setErrorMsg("المعرف الفريد (Slug) يجب أن يحتوي على حروف إنجليزية صغيرة وأرقام وشرطات (-) فقط.");
      return;
    }
    if (!governorate.trim() || !directorate.trim()) {
      setErrorMsg("يرجى إدخال المحافظة والإدارة التعليمية.");
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const trimmedLogo = logoUrl.trim();
      const result = await createSchoolTenantAction({
        slug: slug.trim().toLowerCase(),
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim(),
        governorate: governorate.trim(),
        directorate: directorate.trim(),
        brandColorHex,
        ...(trimmedLogo ? { logoUrl: trimmedLogo } : {}),
        defaultBufferMinutes,
        withBaccalaureateTemplate,
      });

      if (!result.ok) {
        setErrorMsg(result.error.message);
        toast({
          title: "تعذر إنشاء المدرسة",
          description: result.error.message,
          variant: "error",
        });
        return;
      }

      setCreatedResult(result.data);
      toast({
        title: "تم إنشاء المدرسة وتجهيز البوابة بنجاح",
        description: result.data.slug,
        variant: "success",
      });
      router.refresh();
    } catch {
      setErrorMsg("حدث خطأ غير متوقع أثناء إنشاء المدرسة.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setNameAr("");
    setNameEn("");
    setSlug("");
    setDirectorate("");
    setLogoUrl("");
    setErrorMsg(null);
    setCreatedResult(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
            معالج إنشاء مدرسة جديدة (Multi-Tenant)
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-[var(--text-muted)]">
            إطلاق بوابة مدرسة مستقلة خلال ثوانٍ مع تهيئة مسارات البكالوريا المصرية تلقائياً
          </p>
        </div>
        <Link
          href="/super-admin"
          className={buttonVariants({
            variant: "outline",
            size: "md",
            className: "min-h-[44px]",
          })}
        >
          <ArrowRight className="h-4 w-4" />
          <span>العودة للنظرة الوطنية</span>
        </Link>
      </div>

      {createdResult ? (
        <Card className="border-emerald-300 p-6 dark:border-emerald-500/40">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                تم إطلاق بوابة المدرسة بنجاح
              </h2>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                المعرف:{" "}
                <span className="font-mono font-semibold" dir="ltr">
                  /s/{createdResult.slug}
                </span>
                {withBaccalaureateTemplate && " · تم تفعيل قالب البكالوريا (SEC_2_BACC)"}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Link
              href={`/s/${createdResult.slug}`}
              className={buttonVariants({
                variant: "primary",
                size: "md",
                className: "min-h-[44px]",
              })}
            >
              فتح بوابة المدرسة
            </Link>
            <Link
              href={`/s/${createdResult.slug}/admin/presentation`}
              className={buttonVariants({
                variant: "outline",
                size: "md",
                className: "min-h-[44px]",
              })}
            >
              معاينة عرض الوزارة
            </Link>
            <Button
              variant="secondary"
              size="md"
              className="min-h-[44px]"
              onClick={resetWizard}
            >
              إنشاء مدرسة أخرى
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader className="border-b border-[var(--border-hairline)] pb-4">
            {/* 2-Step Progress Header */}
            <div className="grid grid-cols-2 gap-3">
              <div
                className={cn(
                  "rounded-lg border p-3 transition-colors",
                  step === 1
                    ? "border-[#1E3A8A] bg-blue-50/70 dark:border-blue-500 dark:bg-blue-500/15"
                    : "border-[var(--border-hairline)] bg-[var(--bg-sunken)]"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-primary)]">
                    الخطوة ١ · الهوية والبيانات
                  </span>
                  <Badge variant={step === 1 ? "primary" : "success"}>
                    {step === 1 ? "الحالية" : "مكتمل"}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                  الاسم، المعرف الفريد، المحافظة والإدارة
                </p>
              </div>

              <div
                className={cn(
                  "rounded-lg border p-3 transition-colors",
                  step === 2
                    ? "border-[#1E3A8A] bg-blue-50/70 dark:border-blue-500 dark:bg-blue-500/15"
                    : "border-[var(--border-hairline)] bg-[var(--bg-sunken)]"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-primary)]">
                    الخطوة ٢ · قالب البكالوريا
                  </span>
                  <Badge variant={step === 2 ? "primary" : "neutral"}>
                    {step === 2 ? "الحالية" : "التالية"}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                  البذور التلقائية للمناهج والفاصل الزمني
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {errorMsg && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-xs text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {step === 1 ? (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                      label="اسم المدرسة بالعربية"
                      required
                      placeholder="مدرسة النهضة الثانوية الرسمية"
                      value={nameAr}
                      onChange={(e) => setNameAr(e.target.value)}
                    />
                    <Input
                      label="اسم المدرسة بالإنجليزية"
                      dir="ltr"
                      required
                      placeholder="Al-Nahda Official Secondary School"
                      value={nameEn}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNameEn(val);
                        if (!slug) {
                          setSlug(slugifyEnglish(val));
                        }
                      }}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-end gap-2">
                      <Input
                        label="المعرف الفريد للرابط (Slug)"
                        dir="ltr"
                        required
                        placeholder="al-nahda-secondary"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase())}
                        containerClassName="flex-1"
                        hint="يُستخدم في عنوان البوابة: /s/<slug>"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        className="mb-5 min-h-[40px]"
                        onClick={() => setSlug(slugifyEnglish(nameEn))}
                      >
                        توليد تلقائي
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                      label="المحافظة"
                      required
                      placeholder="القاهرة"
                      value={governorate}
                      onChange={(e) => setGovernorate(e.target.value)}
                    />
                    <Input
                      label="الإدارة التعليمية"
                      required
                      placeholder="إدارة شرق مدينة نصر"
                      value={directorate}
                      onChange={(e) => setDirectorate(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      variant="primary"
                      size="lg"
                      className="min-h-[48px]"
                      onClick={handleNextStep}
                      rightIcon={<ArrowLeft className="h-4 w-4" />}
                    >
                      التالي: إعداد القالب الأكاديمي
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* Baccalaureate Template Switch Card */}
                  <div
                    className={cn(
                      "rounded-xl border p-4 transition-colors",
                      withBaccalaureateTemplate
                        ? "border-[#1E3A8A] bg-blue-50/60 dark:border-blue-500 dark:bg-blue-500/10"
                        : "border-[var(--border-hairline)] bg-[var(--bg-sunken)]"
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <Sparkles className="h-5 w-5 text-[#1E3A8A] dark:text-blue-400" />
                        <div>
                          <p className="text-sm font-bold text-[var(--text-primary)]">
                            تفعيل قالب البكالوريا المصرية تلقائياً (SEC_2_BACC)
                          </p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            إنشاء الصف الثاني الثانوي بكالوريا مع ٤ مسارات و ٤ مواد مشتركة فورياً
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={withBaccalaureateTemplate}
                        onClick={() =>
                          setWithBaccalaureateTemplate((prev) => !prev)
                        }
                        className={cn(
                          "min-h-[40px] rounded-lg border px-4 text-xs font-semibold cursor-pointer",
                          withBaccalaureateTemplate
                            ? "border-[#1E3A8A] bg-[#1E3A8A] text-white dark:border-blue-500 dark:bg-blue-600"
                            : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                        )}
                      >
                        {withBaccalaureateTemplate ? "مفعّل (موصى به)" : "بدون قالب"}
                      </button>
                    </div>

                    {withBaccalaureateTemplate && (
                      <div className="mt-3 grid grid-cols-1 gap-2 border-t border-[var(--border-hairline)] pt-3 sm:grid-cols-2">
                        {TEMPLATE_TRACKS_PREVIEW.map((t) => (
                          <div
                            key={t.code}
                            className="flex items-center justify-between rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-xs"
                          >
                            <span className="font-semibold text-[var(--text-primary)]">
                              {t.label}
                            </span>
                            <span className="font-mono text-[10px] text-[var(--text-muted)]" dir="ltr">
                              {t.code}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Buffer & Visual Config */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs sm:text-sm font-medium text-[var(--text-primary)]">
                        فاصل الانتقال الافتراضي بين الحصص (دقيقة)
                      </span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {BUFFER_PRESETS.map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => setDefaultBufferMinutes(mins)}
                            className={cn(
                              "min-h-[44px] rounded-lg border text-xs font-semibold tabular-nums cursor-pointer",
                              defaultBufferMinutes === mins
                                ? "border-[#1E3A8A] bg-[#1E3A8A] text-white dark:border-blue-500 dark:bg-blue-600"
                                : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                            )}
                          >
                            {formatArabicNumber(mins)} د
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs sm:text-sm font-medium text-[var(--text-primary)]">
                        اللون المؤسسي للمدرسة
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {BRAND_COLORS.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => setBrandColorHex(hex)}
                            className={cn(
                              "h-9 w-9 rounded-md border-2 cursor-pointer",
                              brandColorHex === hex
                                ? "border-slate-900 dark:border-white"
                                : "border-transparent"
                            )}
                            style={{ backgroundColor: hex }}
                            aria-label={hex}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <Input
                    label="رابط شعار المدرسة (اختياري)"
                    dir="ltr"
                    placeholder="/tenants/ali-bin-abi-talib/logo.svg"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    hint="مسار محلي يبدأ بـ / أو رابط https://"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      className="min-h-[44px]"
                      onClick={() => setStep(1)}
                      leftIcon={<ArrowRight className="h-4 w-4" />}
                    >
                      السابق
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      loading={submitting}
                      className="min-h-[48px]"
                      leftIcon={<Layers className="h-4 w-4" />}
                    >
                      إنشاء المدرسة وتفعيل البوابة
                    </Button>
                  </div>
                </>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {/* Existing Tenants Reference List */}
      <Card>
        <CardHeader className="border-b border-[var(--border-hairline)] pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[var(--text-muted)]" />
            <CardTitle className="text-sm">
              المعرفات المستخدمة حالياً ({formatArabicNumber(existingSchools.length)})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 pt-3">
          {existingSchools.map((s) => (
            <Badge key={s.id} variant="mono" dir="ltr">
              {s.slug}
            </Badge>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
