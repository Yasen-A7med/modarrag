import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Globe2, GraduationCap, School } from "lucide-react";
import { getCurrentUserContext } from "@/application/auth/actions";
import { TrackArtwork } from "@/components/brand/TrackIcon";
import { HeroShowcase } from "@/components/landing/HeroShowcase";
import { SchoolDirectorySearch } from "@/components/landing/SchoolDirectorySearch";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { MotionReveal } from "@/components/motion/MotionPrimitives";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  fetchActiveSchools,
  getSchoolCatalogBySlug,
  type SchoolCatalogBundle,
} from "@/infrastructure/supabase/catalog";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { getPublicEnv } from "@/lib/env";
import { formatArabicNumber, getUserRoleLabel } from "@/lib/formatters";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    stepNum: "1",
    title: "اختر المدرسة والصف",
    desc: "من الصف الأول الابتدائي حتى الثالث الثانوي ونظام البكالوريا.",
    image: "/images/step-school-3d.webp",
  },
  {
    stepNum: "2",
    title: "احجز قاعة أو أونلاين",
    desc: "مقاعد مدرسية منضبطة السعة أو حصص مباشرة مع معلمك.",
    image: "/images/step-seat-3d.webp",
  },
  {
    stepNum: "3",
    title: "تحضير فوري بالاسم",
    desc: "يحضر الطالب باسمه مباشرةً بدون تذاكر ورقية أو رموز معقدة.",
    image: "/images/step-attend-3d.webp",
  },
] as const;

export default async function HomePage() {
  const env = getPublicEnv();
  const defaultSlug = env.NEXT_PUBLIC_DEFAULT_SCHOOL_SLUG;

  const supabase = await createSupabaseServerClient();
  const [schools, catalog, userCtx] = await Promise.all([
    fetchActiveSchools(supabase).catch(() => []),
    getSchoolCatalogBySlug(defaultSlug).catch(
      (): SchoolCatalogBundle | null => null
    ),
    getCurrentUserContext().catch(() => null),
  ]);

  const primarySchool =
    schools.find((s) => s.slug === defaultSlug) ?? schools[0] ?? null;
  const schoolPortalHref = primarySchool ? `/s/${primarySchool.slug}` : "/login";

  const bacGradeId =
    catalog?.grades.find((g) => g.code === "SEC_2_BACC")?.id ??
    catalog?.grades[0]?.id;

  const tracks = (catalog?.tracks ?? []).filter(
    (t) => !bacGradeId || t.grade_id === bacGradeId
  );
  const commonSubjects = (catalog?.subjects ?? []).filter(
    (s) => s.subject_type === "common" && (!bacGradeId || s.grade_id === bacGradeId)
  );

  return (
    <div className="min-h-dvh bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <TopNavbar
        brandHref="/"
        links={[
          { href: "/", label: "الرئيسية", active: true },
          { href: schoolPortalHref, label: "بوابة المدرسة" },
          {
            href: primarySchool ? `/s/${primarySchool.slug}/lectures` : "/login",
            label: "المحاضرات المسجلة",
          },
        ]}
        user={
          userCtx
            ? {
                role: userCtx.role,
                roleLabelAr: getUserRoleLabel(userCtx.role, "ar"),
                codeLabel: userCtx.fullName,
              }
            : null
        }
        ctaHref="/login"
        ctaLabel="ابدأ الآن"
      />

      {/* Section 1: Serene Institutional Split Hero */}
      <section className="ambient-mesh border-b border-[var(--border-hairline)]">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-12 lg:py-16">
          <MotionReveal className="flex flex-col items-start gap-5 lg:col-span-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary" size="md" dot>
                السنتر المدرسي الرسمي · حضوري وأونلاين
              </Badge>
              <Badge variant="info" size="md">
                <GraduationCap className="h-3.5 w-3.5" />
                <span>من ١ ابتدائي إلى ٣ ثانوي وبكالوريا</span>
              </Badge>
            </div>

            <h1 className="text-3xl font-extrabold leading-[1.2] text-[#0A1F44] dark:text-white sm:text-4xl lg:text-5xl">
              احجز مقعدك المدرسي
              <span className="mt-1 block text-[#2563EB] dark:text-cyan-300">
                في دقائق وبمنتهى النظام
              </span>
            </h1>

            <p className="max-w-lg text-base leading-relaxed text-[var(--text-secondary)]">
              منصة مدرسية متكاملة لحجز حصص المراجعة بالاسم داخل مدرجات المدرسة أو أونلاين من البيت،
              مع مكتبة محاضرات مسجلة ومطبعة مذكرات معتمدة.
            </p>

            <div className="flex w-full flex-col gap-3 pt-1 sm:w-auto sm:flex-row">
              <Link
                href={userCtx ? schoolPortalHref : "/login"}
                className={buttonVariants({
                  variant: "primary",
                  size: "lg",
                  className: "min-h-[54px] px-7 text-base",
                })}
              >
                <span>{userCtx ? "ادخل بوابتك الآن" : "ابدأ الحجز الآن"}</span>
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <Link
                href="#schools-directory"
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "min-h-[54px] bg-[var(--bg-surface)] px-6 text-base",
                })}
              >
                <School className="h-5 w-5" />
                <span>اختر مدرستك</span>
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-semibold text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                تحضير بالاسم بدون تذاكر
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Globe2 className="h-4 w-4 text-[#2563EB] dark:text-cyan-300" />
                مدرج مدرسي + بث مباشر
              </span>
            </div>
          </MotionReveal>

          <div className="lg:col-span-6">
            <HeroShowcase />
          </div>
        </div>
      </section>

      {/* Section 2: 3 Clean Numbered Steps */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((item) => (
            <Card key={item.stepNum} className="hover-lift-card p-5">
              <div className="flex items-start gap-4">
                <div className="art-pedestal h-16 w-16 shrink-0 overflow-hidden rounded-2xl p-1">
                  <Image
                    src={item.image}
                    alt={item.title}
                    width={64}
                    height={64}
                    className="h-full w-full rounded-xl object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <Badge variant="primary" size="sm">
                    خطوة {item.stepNum}
                  </Badge>
                  <h2 className="mt-2 text-base font-extrabold text-[var(--text-primary)]">
                    {item.title}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {item.desc}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Section 3: Live Searchable School & Center Directory */}
      <section
        id="schools-directory"
        className="mx-auto max-w-6xl px-4 pb-12 sm:px-6"
      >
        <div className="rounded-[2rem] border border-[var(--border-hairline)] bg-[var(--bg-sunken)]/60 p-5 sm:p-8">
          <SchoolDirectorySearch
            schools={schools.map((s) => ({
              id: s.id,
              slug: s.slug,
              nameAr: s.name_ar,
              governorate: s.governorate,
              directorate: s.directorate,
              logoUrl: s.logo_url,
              tenantType: s.tenant_type,
            }))}
          />
        </div>
      </section>

      {/* Section 4: Baccalaureate Specialized Tracks + Common Subjects */}
      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-extrabold text-[var(--text-primary)] sm:text-2xl">
              مسارات البكالوريا التخصصية
            </h2>
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
              تنظيم آلي للمواد المشتركة والتخصصية دون تداخل المواعيد
            </p>
          </div>
          {catalog?.grades && catalog.grades.length > 0 && (
            <Badge variant="neutral" size="md">
              {formatArabicNumber(catalog.grades.length)} صفاً دراسياً مفعلاً
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tracks.map((track) => (
            <Link
              key={track.id}
              href={schoolPortalHref}
              className="group block"
            >
              <Card variant="interactive" className="flex h-full items-center gap-3.5 p-4">
                <TrackArtwork trackCode={track.code} size="md" />
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    {track.name_ar}
                  </h3>
                  <p className="mt-0.5 text-xs font-medium text-[#2563EB] dark:text-cyan-300">
                    عرض الحصص ←
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {commonSubjects.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-3">
            <span className="text-xs font-bold text-[var(--text-muted)]">
              المواد المشتركة:
            </span>
            {commonSubjects.map((subj) => (
              <Badge key={subj.id} variant="neutral" size="sm">
                {subj.name_ar}
              </Badge>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-[var(--text-muted)] sm:px-6">
          <span>مُدَرَّج — المنصة المدرسية المنظمة لحصص المراجعة والمحاضرات</span>
          <span>معزولة بالمدرسة · تحضير بالاسم · بث أونلاين</span>
        </div>
      </footer>
    </div>
  );
}
