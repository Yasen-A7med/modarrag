import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  LayoutGrid,
  ShieldCheck,
  UserCheck,
  Zap,
} from "lucide-react";
import { ModarragLogo } from "@/components/brand/ModarragLogo";
import { TrackArtwork } from "@/components/brand/TrackIcon";
import { HeroShowcase } from "@/components/landing/HeroShowcase";
import { TopNavbar } from "@/components/layout/TopNavbar";
import {
  MotionMetricBar,
  MotionReveal,
  MotionStaggerCard,
  MotionStaggerGrid,
} from "@/components/motion/MotionPrimitives";
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
    artwork: "/images/step-school-3d.webp",
    artworkAlt: "مجسم ثلاثي الأبعاد لبوابة المدرسة وبطاقة تسجيل الطالب",
    icon: UserCheck,
  },
  {
    num: "٢",
    title: "احجز مقعدك بلمسة",
    description: "تصفّح مواعيد حصص موادك داخل المدرسة واحجز مكانك قبل اكتمال القاعة.",
    accentClass: "border-t-4 border-t-[#16A34A] dark:border-t-emerald-500",
    numBgClass: "bg-emerald-50 text-[#16A34A] dark:bg-emerald-500/15 dark:text-emerald-300",
    artwork: "/images/step-seat-3d.webp",
    artworkAlt: "مجسم ثلاثي الأبعاد لمقعد مدرج مريح وعلامة الحجز المؤكد",
    icon: CalendarCheck,
  },
  {
    num: "٣",
    title: "احضر باسمك فقط",
    description: "بدون تذاكر أو باركود — معلمك يبحث عن اسمك في كشف الحضور ويسجلك بضغطة.",
    accentClass: "border-t-4 border-t-[#D97706] dark:border-t-amber-500",
    numBgClass: "bg-amber-50 text-[#B45309] dark:bg-amber-500/15 dark:text-amber-300",
    artwork: "/images/step-attend-3d.webp",
    artworkAlt: "مجسم ثلاثي الأبعاد لكشف الحضور الإلكتروني وتسجيل الأسماء",
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
      {/* Atmospheric Radiant Hero Backdrop */}
      <div className="ambient-mesh pb-12 sm:pb-16">
        <TopNavbar
          brandHref="/"
          links={[
            { href: "#steps", label: "كيف تبدأ" },
            { href: "#tracks", label: "المسارات" },
            { href: `/s/${schoolSlug}`, label: "بوابة المدرسة" },
          ]}
        />

        <HeroShowcase schoolSlug={schoolSlug} />
      </div>

      {/* Tactile Bento Strip (4 Quick Clarity Signals) */}
      <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <MotionStaggerGrid className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MotionStaggerCard className="hover-lift-card flex min-h-[146px] flex-col justify-between rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 hairline-lift">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-[#254EDB] dark:bg-blue-950/60 dark:text-blue-300">
                <Zap className="h-5 w-5" />
              </span>
              <span className="text-xl font-bold text-[var(--text-primary)] tabular-nums">
                ٣ ثوانٍ
              </span>
            </div>
            <div className="mt-5">
              <p className="text-sm font-bold text-[var(--text-primary)]">حجز بضغطة</p>
              <MotionMetricBar
                percentage={84}
                trackClassName="mt-2.5 h-1.5"
                barClassName="bg-[#254EDB] dark:bg-blue-500"
              />
            </div>
          </MotionStaggerCard>

          <MotionStaggerCard className="hover-lift-card flex min-h-[146px] flex-col justify-between rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 hairline-lift">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                <LayoutGrid className="h-5 w-5" />
              </span>
              <span className="text-xl font-bold text-[var(--text-primary)] tabular-nums">
                سعة منضبطة
              </span>
            </div>
            <div className="mt-5">
              <p className="text-sm font-bold text-[var(--text-primary)]">قاعات آمنة منظمة</p>
              <MotionMetricBar
                percentage={72}
                trackClassName="mt-2.5 h-1.5"
                barClassName="bg-teal-600 dark:bg-teal-400"
              />
            </div>
          </MotionStaggerCard>

          <MotionStaggerCard className="hover-lift-card flex min-h-[146px] flex-col justify-between rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 hairline-lift">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-[#16A34A] dark:bg-emerald-950/60 dark:text-emerald-300">
                <ClipboardCheck className="h-5 w-5" />
              </span>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-[#16A34A] dark:text-emerald-300">
                فوري
              </span>
            </div>
            <div className="mt-5">
              <p className="text-sm font-bold text-[var(--text-primary)]">الحضور بالاسم</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">بدون ورق أو تذاكر</p>
            </div>
          </MotionStaggerCard>

          <MotionStaggerCard className="hover-lift-card flex min-h-[146px] flex-col justify-between rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 hairline-lift">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <span className="text-xl font-bold text-[var(--text-primary)] tabular-nums">
                ١٠٠٪
              </span>
            </div>
            <div className="mt-5">
              <p className="text-sm font-bold text-[var(--text-primary)]">أمان كامل</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">إشراف مدرسي رسمي</p>
            </div>
          </MotionStaggerCard>
        </MotionStaggerGrid>
      </section>

      {/* 3 Simple Numbered Steps anchored by 3D Frosted Artworks */}
      <section id="steps" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <MotionReveal className="mb-8 text-center sm:mb-10">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
            الموضوع بسيط جداً.. ٣ خطوات فقط
          </h2>
          <p className="mt-2 text-base text-[var(--text-secondary)]">
            مصمم ليكون واضحاً وسهلاً لكل طالب وولي أمر ومعلم من أول مرة
          </p>
        </MotionReveal>

        <MotionStaggerGrid className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <MotionStaggerCard
                key={step.num}
                className={cn(
                  "group hover-lift-card flex flex-col justify-between rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 hairline-lift",
                  step.accentClass
                )}
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <span
                      className={cn(
                        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl font-bold tabular-nums",
                        step.numBgClass
                      )}
                    >
                      {step.num}
                    </span>

                    <div className="art-pedestal h-24 w-24 shrink-0 overflow-hidden rounded-2xl p-1.5">
                      <Image
                        src={step.artwork}
                        alt={step.artworkAlt}
                        width={96}
                        height={96}
                        loading="eager"
                        className="h-full w-full rounded-xl object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex items-center gap-2">
                    <Icon className="h-5 w-5 text-[var(--text-muted)]" />
                    <h3 className="text-xl font-bold text-[var(--text-primary)]">
                      {step.title}
                    </h3>
                  </div>
                  <p className="mt-2 text-base leading-relaxed text-[var(--text-secondary)]">
                    {step.description}
                  </p>
                </div>
              </MotionStaggerCard>
            );
          })}
        </MotionStaggerGrid>
      </section>

      {/* Baccalaureate Tracks Showcase */}
      <section id="tracks" className="bg-[var(--bg-sunken)] py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <MotionReveal className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </MotionReveal>

          <MotionStaggerGrid className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tracksToRender.map((track) => {
              const style = getTrackStyle(track.code || track.iconKey);
              return (
                <MotionStaggerCard
                  key={track.code}
                  className="group hover-lift-card flex flex-col justify-between rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 hairline-lift"
                  style={{ borderTopWidth: "4px", borderTopColor: style.hex }}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <TrackArtwork
                        trackCode={track.code}
                        iconKey={track.iconKey}
                        size="lg"
                      />
                    </div>
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
                </MotionStaggerCard>
              );
            })}
          </MotionStaggerGrid>

          {/* Common Subjects */}
          <MotionReveal className="mt-5 rounded-3xl border border-[#2563EB]/20 bg-gradient-to-l from-[#EEF5FF]/80 via-[var(--bg-surface)] to-[#ECFEFF]/70 p-5 dark:border-cyan-500/25 dark:from-[#0A1F44]/60 dark:via-[var(--bg-surface)] dark:to-[#083344]/40 hairline-lift">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-base font-bold text-[#0A1F44] dark:text-[var(--text-primary)]">
                المواد المشتركة لجميع الطلاب:
              </span>
              <div className="flex flex-wrap gap-2">
                {commonSubjects.map((name, idx) => {
                  const pillColors = [
                    "border-blue-200 bg-[#EEF5FF] text-[#1D4ED8] dark:border-blue-500/35 dark:bg-blue-500/15 dark:text-blue-200",
                    "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-500/35 dark:bg-cyan-500/15 dark:text-cyan-200",
                    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-200",
                    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-200",
                  ];
                  return (
                    <span
                      key={name}
                      className={cn(
                        "rounded-xl border px-3.5 py-1.5 text-sm font-bold",
                        pillColors[idx % pillColors.length]
                      )}
                    >
                      {name}
                    </span>
                  );
                })}
              </div>
            </div>
          </MotionReveal>
        </div>
      </section>

      {/* Active School Callout */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <MotionReveal className="hover-lift-card ambient-mesh rounded-3xl border border-[#2563EB]/20 p-6 sm:p-8 hairline-lift dark:border-cyan-500/25">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4 sm:items-center">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-[#0A1F44]/10 bg-white p-1.5 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={featuredSchool?.logo_url || "/tenants/ali-bin-abi-talib/logo.webp"}
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

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href={`/s/${schoolSlug}/student`}
                className={buttonVariants({ variant: "primary", size: "lg" })}
              >
                <span>بوابة الطالب والحجز</span>
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <Link
                href={`/s/${schoolSlug}/lectures`}
                className={buttonVariants({ variant: "emerald", size: "lg" })}
              >
                <span>المحاضرات المسجلة</span>
              </Link>
              <Link
                href={`/s/${schoolSlug}`}
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "bg-[var(--bg-surface)]/95",
                })}
              >
                <span>صفحة المدرسة</span>
              </Link>
            </div>
          </div>
        </MotionReveal>
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
            <Link href={`/s/${schoolSlug}/lectures`} className="hover:text-[var(--text-primary)]">
              المحاضرات المسجلة
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
