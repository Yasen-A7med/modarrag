import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUserContext } from "@/application/auth/actions";
import { TrackArtwork } from "@/components/brand/TrackIcon";
import {
  MotionReveal,
  MotionStaggerCard,
  MotionStaggerGrid,
} from "@/components/motion/MotionPrimitives";
import { buttonVariants } from "@/components/ui/Button";
import {
  getSchoolCatalogBySlug,
  type SchoolCatalogBundle,
} from "@/infrastructure/supabase/catalog";
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

  const { school, tracks, subjects, trackSubjects } = catalog;
  const commonSubjects = subjects.filter((s) => s.subject_type === "common");

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
      description: "تصفّح حصص موادك واحجز مقعدك باسمك بضغطة واحدة",
      ctaLabel: "احجز حصتك",
      artwork: "/images/role-student-3d.webp",
      accentClass: "border-t-4 border-t-[#2563EB] dark:border-t-blue-500",
    },
    {
      href: `/s/${school.slug}/lectures`,
      title: "المحاضرات المسجلة",
      description: "شاهد فيديوهات المراجعة والمحاضرات المرفوعة من معلمي المدرسة",
      ctaLabel: "مكتبة الفيديو",
      artwork: "/images/step-attend-3d.webp",
      accentClass: "border-t-4 border-t-[#0891B2] dark:border-t-cyan-400",
    },
    {
      href: `/s/${school.slug}/teacher`,
      title: "بوابة المعلم",
      description: "سجّل الحضور بالاسم، ارفع محاضرات مسجلة، أو احجز مدرجاً",
      ctaLabel: "كشوف الحضور والفيديو",
      artwork: "/images/role-teacher-3d.webp",
      accentClass: "border-t-4 border-t-[#16A34A] dark:border-t-emerald-500",
    },
    {
      href: `/s/${school.slug}/admin`,
      title: "إدارة المدرسة",
      description: "متابعة إشغال القاعات، اعتماد المعلمين، وتقارير الحضور",
      ctaLabel: "لوحة الإدارة",
      artwork: "/images/role-admin-3d.webp",
      accentClass: "border-t-4 border-t-[#D97706] dark:border-t-amber-500",
    },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      {/* Friendly School Welcome Card with ambient backdrop */}
      <MotionReveal className="ambient-mesh rounded-3xl border border-[#2563EB]/20 p-6 hairline-lift dark:border-cyan-500/25">
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
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                {school.name_ar}
              </h1>
              <p className="mt-1 text-base text-[var(--text-secondary)]">
                {school.governorate} — {school.directorate}
              </p>
            </div>
          </div>

          <Link
            href={userCtx ? primaryRolePath : `/s/${school.slug}/student`}
            className={buttonVariants({ variant: "emerald", size: "lg" })}
          >
            <span>{userCtx ? "الدخول لبوابتك الآن" : "دخول بوابة الطالب"}</span>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>
      </MotionReveal>

      {/* 4 Big Clear Doorway Cards with 3D Sculptures */}
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
                <div className="art-pedestal inline-flex h-20 w-20 overflow-hidden rounded-2xl p-1.5">
                  <Image
                    src={doorway.artwork}
                    alt={doorway.title}
                    width={80}
                    height={80}
                    className="h-full w-full rounded-xl object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <h2 className="mt-4 text-xl font-bold text-[var(--text-primary)]">
                  {doorway.title}
                </h2>
                <p className="mt-2 text-base leading-relaxed text-[var(--text-secondary)]">
                  {doorway.description}
                </p>
              </div>

              <div className="mt-5 inline-flex items-center gap-2 text-base font-bold text-[#0B63CE] dark:text-blue-400">
                <span>{doorway.ctaLabel}</span>
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              </div>
            </Link>
          </MotionStaggerCard>
        ))}
      </MotionStaggerGrid>

      {/* Tracks Summary with 3D Thumbnails */}
      <MotionReveal className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 hairline-lift">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            المسارات المتاحة بالمدرسة
          </h2>
          <span className="text-sm text-[var(--text-muted)]">
            تشمل المواد المشتركة: {commonSubjects.map((s) => s.name_ar).join("، ")}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tracks.map((track) => {
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
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    {track.name_ar}
                  </h3>
                </div>
                <p className="mt-3 text-sm text-[var(--text-secondary)]">
                  {subs
                    .filter((s) => s.subject_type === "track_core")
                    .map((s) => s.name_ar)
                    .join(" · ")}
                  {subs.some((s) => s.subject_type === "track_elective")
                    ? " + لغة ثانية"
                    : ""}
                </p>
              </div>
            );
          })}
        </div>
      </MotionReveal>
    </div>
  );
}
