import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { ModarragLogo } from "@/components/brand/ModarragLogo";
import { TrackIcon } from "@/components/brand/TrackIcon";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { buttonVariants } from "@/components/ui/Button";
import {
  getActiveSchools,
  getSchoolCatalogBySlug,
  type SchoolCatalogBundle,
  type SchoolRow,
} from "@/infrastructure/supabase/catalog";
import { getTrackStyle } from "@/lib/design-tokens";
import { formatArabicNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export const revalidate = 120;

interface DisplayTrack {
  readonly code: string;
  readonly nameAr: string;
  readonly iconKey: string;
  readonly subjects: readonly string[];
  readonly hasSecondLang: boolean;
}

const FALLBACK_TRACKS: readonly DisplayTrack[] = [
  {
    code: "ENG_TRACK",
    nameAr: "مسار الهندسة",
    iconKey: "cpu",
    subjects: ["برمجة", "كيمياء"],
    hasSecondLang: false,
  },
  {
    code: "MED_TRACK",
    nameAr: "مسار طب وعلوم الحياة",
    iconKey: "microscope",
    subjects: ["رياضيات", "فيزياء"],
    hasSecondLang: false,
  },
  {
    code: "BUS_TRACK",
    nameAr: "مسار الأعمال",
    iconKey: "briefcase",
    subjects: ["إدارة أعمال", "محاسبة"],
    hasSecondLang: false,
  },
  {
    code: "ART_TRACK",
    nameAr: "مسار الآداب والفنون",
    iconKey: "book-open",
    subjects: ["علم نفس"],
    hasSecondLang: true,
  },
];

const FALLBACK_COMMON_SUBJECTS = [
  "اللغة العربية",
  "اللغة الإنجليزية",
  "التاريخ",
  "الثقافة المالية",
] as const;

const HOW_IT_WORKS_STEPS = [
  {
    num: "١",
    title: "سجّل اسمك ومسارك",
    description: "اختَر مدرستك ومسارك في البكالوريا مرة واحدة فقط برقم هاتفك واسمك.",
    accentClass: "border-t-4 border-t-[#0B63CE] dark:border-t-blue-500",
    numBgClass: "bg-[#EEF5FF] text-[#0B63CE] dark:bg-blue-500/15 dark:text-blue-300",
    icon: UserCheck,
  },
  {
    num: "٢",
    title: "احجز مقعدك بلمسة",
    description: "تصفّح مواعيد حصص موادك داخل المدرسة واحجز مكانك قبل اكتمال القاعة.",
    accentClass: "border-t-4 border-t-[#16A34A] dark:border-t-emerald-500",
    numBgClass: "bg-emerald-50 text-[#16A34A] dark:bg-emerald-500/15 dark:text-emerald-300",
    icon: CalendarCheck,
  },
  {
    num: "٣",
    title: "احضر باسمك فقط",
    description: "بدون تذاكر أو باركود — معلمك يبحث عن اسمك في كشف الحضور ويسجلك بضغطة.",
    accentClass: "border-t-4 border-t-[#D97706] dark:border-t-amber-500",
    numBgClass: "bg-amber-50 text-[#B45309] dark:bg-amber-500/15 dark:text-amber-300",
    icon: ClipboardCheck,
  },
] as const;

export default async function HomePage() {
  const [schools, primaryCatalog]: readonly [
    readonly SchoolRow[],
    SchoolCatalogBundle | null,
  ] = await Promise.all([
    getActiveSchools().catch((): readonly SchoolRow[] => []),
    getSchoolCatalogBySlug("ali-bin-abi-talib").catch(
      (): SchoolCatalogBundle | null => null
    ),
  ]);

  const featuredSchool = schools[0] ?? primaryCatalog?.school ?? null;
  const schoolSlug = featuredSchool?.slug ?? "ali-bin-abi-talib";
  const schoolNameAr = featuredSchool?.name_ar ?? "مدرسة علي بن أبي طالب الثانوية بنين";
  const schoolLocation = featuredSchool
    ? `${featuredSchool.governorate} — ${featuredSchool.directorate}`
    : "القاهرة — إدارة المرج التعليمية";

  const commonSubjects = primaryCatalog
    ? primaryCatalog.subjects
        .filter((s) => s.subject_type === "common")
        .map((s) => s.name_ar)
    : [...FALLBACK_COMMON_SUBJECTS];

  const tracksToRender: readonly DisplayTrack[] = primaryCatalog
    ? primaryCatalog.tracks.map((track) => {
        const mapped = primaryCatalog.trackSubjects
          .filter((ts) => ts.track_id === track.id)
          .map((ts) => primaryCatalog.subjects.find((s) => s.id === ts.subject_id))
          .filter((s): s is NonNullable<typeof s> => Boolean(s));

        return {
          code: track.code,
          nameAr: track.name_ar,
          iconKey: track.icon_key,
          subjects: mapped
            .filter((s) => s.subject_type === "track_core")
            .map((s) => s.name_ar),
          hasSecondLang: mapped.some((s) => s.subject_type === "track_elective"),
        };
      })
    : FALLBACK_TRACKS;

  return (
    <div className="min-h-dvh bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Warm Sky Hero Wrapper */}
      <div className="bg-[var(--bg-hero)] pb-12 sm:pb-16">
        <TopNavbar
          brandHref="/"
          links={[
            { href: "#steps", label: "كيف تبدأ" },
            { href: "#tracks", label: "المسارات" },
            { href: `/s/${schoolSlug}`, label: "بوابة المدرسة" },
          ]}
        />

        {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-10">
            {/* Hero Copy (Start / Right in RTL) */}
            <div className="flex flex-col items-start lg:col-span-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-[var(--bg-surface)] px-4 py-1.5 text-sm font-semibold text-[#0B63CE] dark:border-blue-500/30 dark:text-blue-300">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>السنتر المدرسي الرسمي الآمن</span>
              </div>

              <h1 className="mt-5 text-3xl font-bold text-[var(--text-primary)] sm:text-4xl lg:text-5xl">
                احجز مكانك في مدرج مدرستك{" "}
                <span className="text-[#0B63CE] dark:text-blue-400">
                  باسمك وفي ثانية واحدة
                </span>
              </h1>

              <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg">
                تنظيم رسمي لحصص المراجعة داخل قاعات المدرسة بسعة آمنة ومعلمين معتمدين — بدون تكدس السناتر، وبدون تذاكر معقدة.
              </p>

              <div className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                <Link
                  href={`/s/${schoolSlug}`}
                  className={buttonVariants({
                    variant: "emerald",
                    size: "lg",
                    className: "w-full sm:w-auto shadow-sm",
                  })}
                >
                  <span>ابدأ الحجز الآن</span>
                  <ArrowLeft className="h-5 w-5" />
                </Link>

                <Link
                  href="/login"
                  className={buttonVariants({
                    variant: "outline",
                    size: "lg",
                    className: "w-full sm:w-auto bg-[var(--bg-surface)]",
                  })}
                >
                  <span>جرّب الحسابات الجاهزة</span>
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-[var(--text-secondary)]">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#16A34A] dark:text-emerald-400" />
                  تسجيل حضور بالاسم مباشرة
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#16A34A] dark:text-emerald-400" />
                  مقاعد آمنة ومحددة السعة
                </span>
              </div>
            </div>

            {/* Hero Illustration */}
            <div className="lg:col-span-6">
              <div className="relative overflow-hidden rounded-2xl border border-transparent bg-[#F4F8FF] dark:border-white/10 dark:bg-[#EBF2FF]">
                <Image
                  src="/images/hero-lecture-hall.webp"
                  alt="قاعة مدرج مدرسي منظم ومجهز للطلاب"
                  width={1280}
                  height={714}
                  priority
                  className="h-auto w-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 3 Simple Numbered Steps (Bassthalk Style) */}
      <section id="steps" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="mb-8 text-center sm:mb-10">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
            الموضوع بسيط جداً.. ٣ خطوات فقط
          </h2>
          <p className="mt-2 text-base text-[var(--text-secondary)]">
            مصمم ليكون واضحاً وسهلاً لكل طالب وولي أمر ومعلم من أول مرة
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className={cn(
                  "flex flex-col justify-between rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 hairline-lift",
                  step.accentClass
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={cn(
                        "inline-flex h-12 w-12 items-center justify-center rounded-xl text-2xl font-bold tabular-nums",
                        step.numBgClass
                      )}
                    >
                      {step.num}
                    </span>
                    <Icon className="h-6 w-6 text-[var(--text-muted)]" />
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-[var(--text-primary)]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-base leading-relaxed text-[var(--text-secondary)]">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Baccalaureate Tracks */}
      <section id="tracks" className="bg-[var(--bg-sunken)] py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
                مسارات نظام البكالوريا المصرية
              </h2>
              <p className="mt-2 text-base text-[var(--text-secondary)]">
                تظهر لك حصص مواد مسارك تلقائياً بعد التسجيل
              </p>
            </div>
            <Link
              href="/onboarding"
              className={buttonVariants({ variant: "outline", size: "md" })}
            >
              <span>تحديد المسار الدراسي</span>
            </Link>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tracksToRender.map((track) => {
              const style = getTrackStyle(track.code || track.iconKey);
              return (
                <div
                  key={track.code}
                  className="flex flex-col justify-between rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 hairline-lift"
                  style={{ borderTopWidth: "4px", borderTopColor: style.hex }}
                >
                  <div>
                    <TrackIcon trackCode={track.code} iconKey={track.iconKey} size="lg" />
                    <h3 className="mt-4 text-lg font-bold text-[var(--text-primary)]">
                      {track.nameAr}
                    </h3>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {track.subjects.map((subj) => (
                        <span
                          key={subj}
                          className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-2.5 py-1 text-sm font-medium text-[var(--text-primary)]"
                        >
                          {subj}
                        </span>
                      ))}
                      {track.hasSecondLang && (
                        <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-sm font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
                          + لغة أجنبية ثانية
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Common Subjects */}
          <div className="mt-5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-base font-bold text-[var(--text-primary)]">
                المواد المشتركة لجميع الطلاب:
              </span>
              <div className="flex flex-wrap gap-2">
                {commonSubjects.map((name) => (
                  <span
                    key={name}
                    className="rounded-xl border border-blue-200 bg-[#EEF5FF] px-3.5 py-1.5 text-sm font-semibold text-[#0B63CE] dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Active School Callout */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8 hairline-lift">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4 sm:items-center">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={featuredSchool?.logo_url || "/tenants/ali-bin-abi-talib/logo.svg"}
                  alt={schoolNameAr}
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#16A34A] dark:text-emerald-400">
                  <Building2 className="h-4 w-4" />
                  المدرسة المفعّلة حالياً ({formatArabicNumber(schools.length || 1)})
                </span>
                <h2 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
                  {schoolNameAr}
                </h2>
                <p className="mt-1 text-base text-[var(--text-secondary)]">
                  {schoolLocation}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/s/${schoolSlug}/student`}
                className={buttonVariants({ variant: "emerald", size: "lg" })}
              >
                <span>بوابة الطالب والحجز</span>
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <Link
                href={`/s/${schoolSlug}`}
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                <span>صفحة المدرسة</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Clean Footer */}
      <footer className="border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-col gap-2">
            <ModarragLogo size="sm" showWordmark showSubtitle />
            <p className="max-w-sm text-sm text-[var(--text-muted)]">
              مبادرة مدرسية رسمية لتنظيم الحصص الآمنة وحجز المقاعد بالاسم داخل المدارس الحكومية.
            </p>
          </div>

          <nav className="flex flex-wrap gap-5 text-sm font-semibold text-[var(--text-secondary)]">
            <Link href={`/s/${schoolSlug}`} className="hover:text-[var(--text-primary)]">
              بوابة المدرسة
            </Link>
            <Link href="/login" className="hover:text-[var(--text-primary)]">
              تسجيل الدخول
            </Link>
            <Link href="/register" className="hover:text-[var(--text-primary)]">
              حساب طالب جديد
            </Link>
            <Link href={`/s/${schoolSlug}/admin/presentation`} className="hover:text-[var(--text-primary)]">
              العرض التقديمي
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
