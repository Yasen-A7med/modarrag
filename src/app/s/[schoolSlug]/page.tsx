import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarCheck,
  ClipboardCheck,
} from "lucide-react";
import { getCurrentUserContext } from "@/application/auth/actions";
import { TrackIcon } from "@/components/brand/TrackIcon";
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
      icon: CalendarCheck,
      accentClass: "border-t-4 border-t-[#16A34A] dark:border-t-emerald-500",
      iconBg: "bg-emerald-50 text-[#16A34A] dark:bg-emerald-500/15 dark:text-emerald-300",
    },
    {
      href: `/s/${school.slug}/teacher`,
      title: "بوابة المعلم",
      description: "افتح كشف أسماء الطلاب وسجّل الحضور بالاسم أو احجز مدرجاً",
      ctaLabel: "كشوف الحضور",
      icon: ClipboardCheck,
      accentClass: "border-t-4 border-t-[#0B63CE] dark:border-t-blue-500",
      iconBg: "bg-[#EEF5FF] text-[#0B63CE] dark:bg-blue-500/15 dark:text-blue-300",
    },
    {
      href: `/s/${school.slug}/admin`,
      title: "إدارة المدرسة",
      description: "متابعة إشغال القاعات، اعتماد المعلمين، وتقارير الحضور",
      ctaLabel: "لوحة الإدارة",
      icon: Building2,
      accentClass: "border-t-4 border-t-[#D97706] dark:border-t-amber-500",
      iconBg: "bg-amber-50 text-[#B45309] dark:bg-amber-500/15 dark:text-amber-300",
    },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      {/* Friendly School Welcome Card */}
      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 hairline-lift">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={school.logo_url || "/tenants/ali-bin-abi-talib/logo.svg"}
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
      </div>

      {/* 3 Big Clear Doorway Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {portalDoorways.map((doorway) => {
          const Icon = doorway.icon;
          return (
            <Link
              key={doorway.href}
              href={doorway.href}
              className={cn(
                "group flex flex-col justify-between rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 hairline-lift transition-colors hover:border-[var(--border-strong)]",
                doorway.accentClass
              )}
            >
              <div>
                <span
                  className={cn(
                    "inline-flex h-12 w-12 items-center justify-center rounded-xl",
                    doorway.iconBg
                  )}
                >
                  <Icon className="h-6 w-6" />
                </span>
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
          );
        })}
      </div>

      {/* Tracks Summary */}
      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 hairline-lift">
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
                className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-4"
              >
                <div className="flex items-center gap-2.5">
                  <TrackIcon
                    trackCode={track.code}
                    iconKey={track.icon_key}
                    size="sm"
                  />
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    {track.name_ar}
                  </h3>
                </div>
                <p className="mt-2.5 text-sm text-[var(--text-secondary)]">
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
      </div>
    </div>
  );
}
