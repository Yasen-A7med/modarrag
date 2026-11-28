import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { getCurrentUserContext } from "@/application/auth/actions";
import { TrackArtwork } from "@/components/brand/TrackIcon";
import {
  MotionReveal,
  MotionStaggerCard,
  MotionStaggerGrid,
} from "@/components/motion/MotionPrimitives";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import {
  getSchoolCatalogBySlug,
  type SchoolCatalogBundle,
} from "@/infrastructure/supabase/catalog";
import { formatArabicNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export interface SchoolPortalPageProps {
  readonly params: Promise<{ readonly schoolSlug: string }>;
}

export default async function SchoolPortalPage({ params }: SchoolPortalPageProps) {
  const { schoolSlug } = await params;
  const [catalog, userCtx]: readonly [
    SchoolCatalogBundle | null,
    Awaited<ReturnType<typeof getCurrentUserContext>> | null,
  ] = await Promise.all([
    getSchoolCatalogBySlug(schoolSlug) as Promise<SchoolCatalogBundle | null>,
    getCurrentUserContext().catch(() => null),
  ]);

  if (!catalog) {
    notFound();
  }

  const { school, grades, tracks, subjects, trackSubjects } = catalog;
  const bacGrade = grades.find((g) => g.code === "SEC_2_BACC") ?? grades[0];
  const featuredTracks = tracks.filter((t) => !bacGrade || t.grade_id === bacGrade.id);
  const commonSubjects = subjects.filter(
    (s) => s.subject_type === "common" && (!bacGrade || s.grade_id === bacGrade.id)
  );

  const primaryRolePath = (() => {
    switch (userCtx?.role) {
      case "student":
        return `/s/${school.slug}/student`;
      case "teacher":
      case "gate_scanner":
        return `/s/${school.slug}/teacher`;
      case "school_admin":
        return `/s/${school.slug}/admin`;
      case "super_admin":
        return "/super-admin";
      default:
        return `/s/${school.slug}/student`;
    }
  })();

  const portalDoorways = [
    {
      href: `/s/${school.slug}/student`,
      title: "بوابة الطالب",
      description: "احجز حصصك بالاسم أو تابع البث المباشر",
      ctaLabel: "دخول الطالب",
      artwork: "/images/role-student-3d.webp",
      accentClass: "border-t-4 border-t-[#2563EB] dark:border-t-blue-500",
    },
    {
      href: `/s/${school.slug}/lectures`,
      title: "المحاضرات المسجلة",
      description: "فيديوهات المراجعة العامة وللحاضرين",
      ctaLabel: "مكتبة الفيديو",
      artwork: "/images/step-attend-3d.webp",
      accentClass: "border-t-4 border-t-[#22D3EE] dark:border-t-cyan-400",
    },
    {
      href: `/s/${school.slug}/teacher`,
      title: "بوابة المعلم",
      description: "الحضور بالاسم، المحاضرات، والمطبعة",
      ctaLabel: "لوحة المعلم",
      artwork: "/images/role-teacher-3d.webp",
      accentClass: "border-t-4 border-t-[#16A34A] dark:border-t-emerald-500",
    },
    {
      href: `/s/${school.slug}/admin`,
      title: "إدارة المدرسة",
      description: "القاعات، المناهج، وعرض الوزارة",
      ctaLabel: "لوحة الإدارة",
      artwork: "/images/role-admin-3d.webp",
      accentClass: "border-t-4 border-t-[#D97706] dark:border-t-amber-500",
    },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      {/* Slide 7 Blueprint: Institutional Lockup + Student Banner */}
      <MotionReveal className="ambient-mesh rounded-[2rem] border border-[#2563EB]/20 p-6 sm:p-8 hairline-lift dark:border-cyan-500/25">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-[#0A1F44]/10 bg-white p-1.5 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={school.logo_url || "/tenants/ali-bin-abi-talib/logo.webp"}
                alt={school.name_ar}
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="primary" size="sm" dot>
                  {school.tenant_type === "center" ? "سنتر تعليمي معتمد" : "بوابة مدرسة معتمدة"}
                </Badge>
                <Badge variant="info" size="sm">
                  <GraduationCap className="h-3.5 w-3.5" />
                  <span>{formatArabicNumber(grades.length)} صفاً مفعلاً</span>
                </Badge>
              </div>
              <h1 className="mt-2 text-2xl font-extrabold text-[#0A1F44] dark:text-white">
                {school.name_ar}
              </h1>
              <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                {school.governorate} · {school.directorate}
              </p>
            </div>
          </div>

          <Link
            href={userCtx ? primaryRolePath : `/s/${school.slug}/student`}
            className={buttonVariants({ variant: "primary", size: "lg", className: "px-7" })}
          >
            <span>{userCtx ? "ادخل بوابتك" : "دخول الطالب"}</span>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>
      </MotionReveal>

      {/* 4 Crisp Doorway Cards */}
      <MotionStaggerGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {portalDoorways.map((doorway) => (
          <MotionStaggerCard key={doorway.href}>
            <Link
              href={doorway.href}
              className={cn(
                "group hover-lift-card flex h-full flex-col justify-between rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 hairline-lift",
                doorway.accentClass
              )}
            >
              <div>
                <div className="art-pedestal inline-flex h-18 w-18 overflow-hidden rounded-2xl p-1.5">
                  <Image
                    src={doorway.artwork}
                    alt={doorway.title}
                    width={72}
                    height={72}
                    className="h-full w-full rounded-xl object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                </div>
                <h2 className="mt-4 text-lg font-extrabold text-[var(--text-primary)]">
                  {doorway.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {doorway.description}
                </p>
              </div>

              <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-[#2563EB] dark:text-cyan-300">
                <span>{doorway.ctaLabel}</span>
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              </div>
            </Link>
          </MotionStaggerCard>
        ))}
      </MotionStaggerGrid>

      {/* Track Strip + K-12 Stages Overview */}
      <MotionReveal className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 hairline-lift">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-[var(--text-primary)]">
              المسارات والصفوف المتاحة
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              المواد المشتركة: {commonSubjects.map((s) => s.name_ar).join(" · ")}
            </p>
          </div>
          <Link
            href="/onboarding"
            className="text-xs font-bold text-[#2563EB] hover:underline dark:text-cyan-300"
          >
            اختر صفك ومسارك الآن ←
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {featuredTracks.map((track) => {
            const subs = trackSubjects
              .filter((ts) => ts.track_id === track.id)
              .map((ts) => subjects.find((s) => s.id === ts.subject_id))
              .filter((s): s is NonNullable<typeof s> => Boolean(s));

            return (
              <div
                key={track.id}
                className="group hover-lift-card rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-4"
              >
                <div className="flex items-center gap-3">
                  <TrackArtwork
                    trackCode={track.code}
                    iconKey={track.icon_key}
                    size="sm"
                  />
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    {track.name_ar}
                  </h3>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {subs.slice(0, 4).map((sub) => (
                    <span
                      key={sub.id}
                      className="rounded-md bg-[var(--bg-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]"
                    >
                      {sub.name_ar}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {grades.length > 1 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-[var(--border-hairline)] pt-4">
            <span className="text-xs font-bold text-[var(--text-muted)] me-1">
              الصفوف المفعلة:
            </span>
            {grades.map((g) => (
              <Badge key={g.id} variant="neutral" size="sm">
                {g.name_ar}
              </Badge>
            ))}
          </div>
        )}
      </MotionReveal>
    </div>
  );
}
