import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowUpLeft,
  Building2,
  Calendar,
  Clock,
  QrCode,
  ShieldCheck,
  Users,
} from "lucide-react";
import { getCurrentUserContext } from "@/application/auth/actions";
import { TrackIcon } from "@/components/brand/TrackIcon";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  getSchoolCatalogBySlug,
  type SchoolCatalogBundle,
} from "@/infrastructure/supabase/catalog";
import { getTrackStyle } from "@/lib/design-tokens";
import { getUserRoleLabel } from "@/lib/formatters";
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
  const commonSubjects = subjects.filter((s) => s.subject_type === "common");

  const primaryRolePath = (() => {
    switch (userCtx?.role) {
      case "student":
        return `/s/${school.slug}/student`;
      case "teacher":
        return `/s/${school.slug}/teacher`;
      case "gate_scanner":
        return `/s/${school.slug}/scanner`;
      case "school_admin":
        return `/s/${school.slug}/admin`;
      case "super_admin":
        return "/super-admin";
      default:
        return `/s/${school.slug}/student`;
    }
  })();

  const portalRoles = [
    {
      href: `/s/${school.slug}/student`,
      title: "بوابة الطالب",
      meta: "الحصص وتذاكر الدخول",
      code: "STUDENT",
      icon: Calendar,
    },
    {
      href: `/s/${school.slug}/teacher`,
      title: "بوابة المعلم",
      meta: "جدولة المدرجات والحضور",
      code: "TEACHER",
      icon: Users,
    },
    {
      href: `/s/${school.slug}/admin`,
      title: "إدارة المدرسة",
      meta: "القاعات والمناهج والتقارير",
      code: "ADMIN",
      icon: Building2,
    },
    {
      href: `/s/${school.slug}/scanner`,
      title: "ماسح البوابة",
      meta: "توثيق الدخول الفوري",
      code: "SCANNER",
      icon: QrCode,
    },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      {/* School Hero Card */}
      <Card>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={school.logo_url || "/tenants/ali-bin-abi-talib/logo.svg"}
                alt={school.name_ar}
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success" dot>
                  بوابة مفعلة
                </Badge>
                <Badge variant="mono" dir="ltr">
                  {school.slug}
                </Badge>
                {grades[0] && (
                  <Badge variant="primary">{grades[0].name_ar}</Badge>
                )}
              </div>
              <h1 className="mt-2 text-lg font-bold text-[var(--text-primary)] sm:text-xl">
                {school.name_ar}
              </h1>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {school.governorate} · {school.directorate}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {userCtx ? (
              <Link
                href={primaryRolePath}
                className={buttonVariants({ variant: "primary", size: "md" })}
              >
                فتح {getUserRoleLabel(userCtx.role, "ar")}
              </Link>
            ) : (
              <Link
                href="/login"
                className={buttonVariants({ variant: "primary", size: "md" })}
              >
                تسجيل الدخول
              </Link>
            )}
            <Link
              href="/onboarding"
              className={buttonVariants({ variant: "outline", size: "md" })}
            >
              تحديد المسار
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-5 py-3 text-xs text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <span className="tabular-nums">
              فاصل الانتقال الإلزامي: {school.default_buffer_minutes} دقيقة
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="tabular-nums">
              {tracks.length} مسارات · {subjects.length} مادة دراسية
            </span>
          </span>
        </div>
      </Card>

      {/* Role Portal Cards */}
      <section>
        <h2 className="mb-3 text-base font-bold text-[var(--text-primary)]">
          بوابات الوصول السريع
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {portalRoles.map((portal) => {
            const Icon = portal.icon;
            return (
              <Link key={portal.href} href={portal.href} className="group block">
                <Card variant="interactive" className="h-full p-4">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] text-[var(--text-primary)]">
                      <Icon className="h-4 w-4" strokeWidth={1.85} />
                    </span>
                    <ArrowUpLeft className="h-4 w-4 text-[var(--text-muted)] transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                  <p className="mt-3 text-sm font-bold text-[var(--text-primary)]">
                    {portal.title}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{portal.meta}</p>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Active Tracks & Subjects in This School */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-[var(--text-primary)]">
            المسارات المعتمدة بالمدرسة
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {commonSubjects.map((subj) => (
              <Badge key={subj.id} variant="neutral" size="sm">
                {subj.name_ar}
              </Badge>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {tracks.map((track) => {
            const style = getTrackStyle(track.code);
            const assignedSubjects = trackSubjects
              .filter((ts) => ts.track_id === track.id)
              .map((ts) => subjects.find((s) => s.id === ts.subject_id))
              .filter((s): s is NonNullable<typeof s> => Boolean(s));

            return (
              <Card key={track.id}>
                <CardHeader className="pb-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <TrackIcon trackCode={track.code} iconKey={track.icon_key} size="sm" />
                      <CardTitle className="text-sm">{track.name_ar}</CardTitle>
                    </div>
                    <Badge variant="mono" dir="ltr">
                      {track.code}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5">
                  {assignedSubjects.map((subj) => (
                    <span
                      key={subj.id}
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-xs font-medium",
                        subj.subject_type === "track_elective"
                          ? "border-dashed border-[var(--border-strong)] bg-[var(--bg-sunken)] text-[var(--text-secondary)]"
                          : style.badgeClass
                      )}
                    >
                      {subj.name_ar}
                    </span>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
