"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Laptop,
  Layers,
  MapPin,
  Smartphone,
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

const BRAND_COLORS = ["#2563EB", "#0A1F44", "#22D3EE", "#D4AF37", "#16A34A"] as const;
const BUFFER_PRESETS = [10, 15, 20, 30] as const;

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
 * Slide 12 Blueprint: Split-Screen Create School / Center Tenant Wizard
 * (Right: Config Form with K-12 & Baccalaureate presets; Left: Real-Time Mobile Phone Preview).
 */
export function CreateSchoolWizardClient({
  existingSchools,
}: CreateSchoolWizardClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [nameAr, setNameAr] = React.useState("");
  const [nameEn, setNameEn] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [tenantType, setTenantType] = React.useState<"school" | "center">("school");
  const [governorate, setGovernorate] = React.useState("القاهرة");
  const [directorate, setDirectorate] = React.useState("مدينة نصر");

  const [brandColorHex, setBrandColorHex] = React.useState("#2563EB");
  const [logoUrl, setLogoUrl] = React.useState("");
  const [defaultBufferMinutes, setDefaultBufferMinutes] = React.useState<number>(15);
  const [withBaccalaureateTemplate, setWithBaccalaureateTemplate] = React.useState(true);
  const [withK12Template, setWithK12Template] = React.useState(true);

  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [createdResult, setCreatedResult] = React.useState<{
    readonly schoolId: string;
    readonly slug: string;
  } | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg(null);

    if (nameAr.trim().length < 2 || nameEn.trim().length < 2) {
      setErrorMsg("يرجى إدخال اسم المنشأة بالعربية والإنجليزية.");
      return;
    }
    if (!/^[a-z0-9-]{2,80}$/.test(slug.trim())) {
      setErrorMsg("المعرف الفريد (Slug) يجب أن يكون أحرفاً إنجليزية صغيرة وأرقاماً و(-) فقط.");
      return;
    }

    setSubmitting(true);
    try {
      const trimmedLogo = logoUrl.trim();
      const result = await createSchoolTenantAction({
        slug: slug.trim().toLowerCase(),
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim(),
        governorate: governorate.trim(),
        directorate: directorate.trim(),
        tenantType,
        brandColorHex,
        ...(trimmedLogo ? { logoUrl: trimmedLogo } : {}),
        defaultBufferMinutes,
        withBaccalaureateTemplate,
        withK12Template,
      });

      if (!result.ok) {
        setErrorMsg(result.error.message);
        toast({
          title: "تعذر إنشاء المنشأة",
          description: result.error.message,
          variant: "error",
        });
        return;
      }

      setCreatedResult(result.data);
      toast({
        title: "تم إطلاق البوابة بنجاح ✓",
        description: result.data.slug,
        variant: "success",
      });
      router.refresh();
    } catch {
      setErrorMsg("حدث خطأ غير متوقع أثناء الإنشاء.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge variant="info" size="md">
            معالج التأسيس الفوري
          </Badge>
          <h1 className="mt-2 text-2xl font-extrabold text-[var(--text-primary)]">
            إنشاء مدرسة أو سنتر معتمد
          </h1>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
            أطلق بوابة جديدة معزولة البيانات مع قوالب الصفوف K-12 والبكالوريا خلال ثوانٍ
          </p>
        </div>

        <Link
          href="/super-admin"
          className={buttonVariants({ variant: "outline", size: "md" })}
        >
          <ArrowRight className="h-4 w-4" />
          <span>النظرة الوطنية</span>
        </Link>
      </div>

      {createdResult ? (
        <Card className="border-emerald-300 p-6 dark:border-emerald-500/40">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-[var(--text-primary)]">
                تم إطلاق بوابة «{nameAr}» بنجاح
              </h2>
              <p className="mt-1 text-xs font-mono text-[var(--text-secondary)]" dir="ltr">
                /s/{createdResult.slug}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link
              href={`/s/${createdResult.slug}`}
              className={buttonVariants({ variant: "primary", size: "md" })}
            >
              فتح البوابة الجديدة
            </Link>
            <Button
              variant="outline"
              onClick={() => {
                setCreatedResult(null);
                setNameAr("");
                setNameEn("");
                setSlug("");
              }}
            >
              إنشاء منشأة أخرى
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Right Form Column */}
          <Card className="lg:col-span-7">
            <CardHeader className="border-b border-[var(--border-hairline)] pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-extrabold">
                <Building2 className="h-4 w-4 text-[#2563EB]" />
                <span>بيانات المنشأة والهوية</span>
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-5">
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {errorMsg && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-800 dark:bg-red-500/10 dark:text-red-300"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="inline-flex w-fit rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setTenantType("school")}
                    className={cn(
                      "min-h-[38px] rounded-lg px-4 font-bold cursor-pointer",
                      tenantType === "school"
                        ? "bg-[#0A1F44] text-white dark:bg-blue-600"
                        : "text-[var(--text-secondary)]"
                    )}
                  >
                    مدرسة رسمية
                  </button>
                  <button
                    type="button"
                    onClick={() => setTenantType("center")}
                    className={cn(
                      "min-h-[38px] rounded-lg px-4 font-bold cursor-pointer",
                      tenantType === "center"
                        ? "bg-[#2563EB] text-white"
                        : "text-[var(--text-secondary)]"
                    )}
                  >
                    سنتر تعليمي معتمد
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="الاسم بالعربية"
                    required
                    placeholder="مثال: مدرسة النهضة الثانوية"
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                  />
                  <Input
                    label="الاسم بالإنجليزية"
                    required
                    dir="ltr"
                    placeholder="Al-Nahda High School"
                    value={nameEn}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNameEn(v);
                      if (!slug || slug === slugifyEnglish(nameEn)) {
                        setSlug(slugifyEnglish(v));
                      }
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Input
                    label="المعرف الفريد (Slug)"
                    required
                    dir="ltr"
                    placeholder="al-nahda"
                    value={slug}
                    onChange={(e) => setSlug(slugifyEnglish(e.target.value))}
                  />
                  <Input
                    label="المحافظة"
                    required
                    value={governorate}
                    onChange={(e) => setGovernorate(e.target.value)}
                  />
                  <Input
                    label="الإدارة التعليمية"
                    required
                    value={directorate}
                    onChange={(e) => setDirectorate(e.target.value)}
                  />
                </div>

                <Input
                  label="رابط الشعار (اختياري)"
                  dir="ltr"
                  placeholder="https://... أو /tenants/..."
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                />

                {/* Color Swatches */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      لون الهوية الرئيسي
                    </span>
                    <div className="mt-2 flex gap-2.5">
                      {BRAND_COLORS.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => setBrandColorHex(hex)}
                          className={cn(
                            "h-9 w-9 rounded-full border-2 transition-transform cursor-pointer",
                            brandColorHex === hex
                              ? "scale-110 border-white ring-2 ring-[#2563EB]"
                              : "border-transparent"
                          )}
                          style={{ backgroundColor: hex }}
                          aria-label={`اختر اللون ${hex}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      فاصل الصيانة (دقائق)
                    </span>
                    <div className="mt-2 flex gap-1.5">
                      {BUFFER_PRESETS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setDefaultBufferMinutes(m)}
                          className={cn(
                            "h-9 rounded-lg border px-2.5 text-xs font-bold cursor-pointer tabular-nums",
                            defaultBufferMinutes === m
                              ? "border-[#2563EB] bg-[#2563EB] text-white"
                              : "border-[var(--border-hairline)] bg-[var(--bg-sunken)] text-[var(--text-secondary)]"
                          )}
                        >
                          {formatArabicNumber(m)} د
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Preset Switches */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setWithBaccalaureateTemplate((v) => !v)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-2xl border p-3.5 text-start cursor-pointer",
                      withBaccalaureateTemplate
                        ? "border-[#2563EB] bg-blue-50/70 dark:bg-blue-500/15"
                        : "border-[var(--border-hairline)] bg-[var(--bg-sunken)]"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="h-4 w-4 text-[#2563EB]" />
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        تطبيق قالب البكالوريا
                      </span>
                    </div>
                    <Badge variant={withBaccalaureateTemplate ? "primary" : "neutral"}>
                      {withBaccalaureateTemplate ? "مفعل ✓" : "معطل"}
                    </Badge>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWithK12Template((v) => !v)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-2xl border p-3.5 text-start cursor-pointer",
                      withK12Template
                        ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-500/15"
                        : "border-[var(--border-hairline)] bg-[var(--bg-sunken)]"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Layers className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        صفوف K-12 الكاملة
                      </span>
                    </div>
                    <Badge variant={withK12Template ? "success" : "neutral"}>
                      {withK12Template ? "مفعل ✓" : "معطل"}
                    </Badge>
                  </button>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={submitting}
                >
                  إطلاق البوابة وحفظ المنشأة
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Slide 12 Signature Left Column: Real-Time Live Mobile Phone Frame Preview */}
          <div className="lg:col-span-5 flex flex-col items-center justify-start">
            <div className="sticky top-6 w-full max-w-[330px] rounded-[2.75rem] border-[8px] border-[#0A1F44] bg-[var(--bg-canvas)] p-4 shadow-[0_24px_60px_-18px_rgba(10,31,68,0.35)]">
              {/* Notch + Status Indicator */}
              <div className="mx-auto mb-4 flex w-24 items-center justify-center rounded-full bg-[#0A1F44] py-1">
                <Smartphone className="h-3 w-3 text-cyan-300" />
              </div>

              {/* Dynamic Preview Header */}
              <div
                className="rounded-2xl p-4 text-white shadow-sm transition-colors"
                style={{ backgroundColor: brandColorHex }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1">
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoUrl}
                        alt="معاينة"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Building2 className="h-6 w-6 text-[#0A1F44]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="inline-block rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-bold">
                      {tenantType === "center" ? "سنتر تعليمي معتمد" : "بوابة مدرسة"}
                    </span>
                    <p className="mt-1 truncate text-sm font-extrabold">
                      {nameAr || "اسم المدرسة يظهر هنا"}
                    </p>
                  </div>
                </div>
                <p className="mt-2 flex items-center gap-1 text-[11px] text-white/85">
                  <MapPin className="h-3 w-3" />
                  <span>
                    {governorate || "المحافظة"} · {directorate || "الإدارة"}
                  </span>
                </p>
              </div>

              {/* Preview Sample Session Cards */}
              <div className="mt-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)]">
                  <span>معاينة شاشة الطالب</span>
                  <span dir="ltr" className="font-mono">
                    /s/{slug || "school"}
                  </span>
                </div>

                <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="primary" size="sm">
                      حصة المراجعة
                    </Badge>
                    <Badge variant="info" size="sm">
                      <Laptop className="h-3 w-3" /> حضوري وأونلاين
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs font-extrabold text-[var(--text-primary)]">
                    الرياضيات — {withK12Template ? "كافة الصفوف K-12" : "البكالوريا"}
                  </p>
                  <div
                    className="mt-2.5 flex h-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                    style={{ backgroundColor: brandColorHex }}
                  >
                    احجز مقعدك
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-3 py-2 text-[11px] text-[var(--text-secondary)]">
                  إجمالي المنشآت المفعلة حالياً: {formatArabicNumber(existingSchools.length)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
