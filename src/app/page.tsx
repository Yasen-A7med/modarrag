import Link from "next/link";
import {
  ArrowUpLeft,
  Building2,
  CheckCircle2,
  Clock,
  Layers,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { ModarragLogo } from "@/components/brand/ModarragLogo";
import { TrackIcon } from "@/components/brand/TrackIcon";
import { LiveBookingPreview } from "@/components/landing/LiveBookingPreview";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getTrackStyle } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import {
  getActiveSchools,
  getSchoolCatalogBySlug,
  type SchoolCatalogBundle,
  type SchoolRow,
} from "@/infrastructure/supabase/catalog";

export const revalidate = 120;

interface FallbackTrackCard {
  readonly code: string;
  readonly nameAr: string;
  readonly iconKey: string;
  readonly coreSubjects: readonly string[];
  readonly hasSecondLangElective: boolean;
}

const FALLBACK_TRACKS: readonly FallbackTrackCard[] = [
  {
    code: "ENG_TRACK",
    nameAr: "مسار الهندسة",
    iconKey: "cpu",
    coreSubjects: ["برمجة", "كيمياء"],
    hasSecondLangElective: false,
  },
  {
    code: "MED_TRACK",
    nameAr: "مسار طب وعلوم الحياة",
    iconKey: "microscope",
    coreSubjects: ["رياضيات", "فيزياء"],
    hasSecondLangElective: false,
  },
  {
    code: "BUS_TRACK",
    nameAr: "مسار الأعمال",
    iconKey: "briefcase",
    coreSubjects: ["إدارة أعمال", "محاسبة"],
    hasSecondLangElective: false,
  },
  {
    code: "ART_TRACK",
    nameAr: "مسار الآداب والفنون",
    iconKey: "book-open",
    coreSubjects: ["علم نفس"],
    hasSecondLangElective: true,
  },
];

const FALLBACK_COMMON_SUBJECTS = [
  "اللغة العربية",
  "اللغة الإنجليزية",
  "التاريخ",
  "الثقافة المالية",
] as const;

const TELEMETRY_TILES = [
  {
    label: "فاصل المدرجات",
    value: "١٥ دقيقة",
    code: "GiST EXCLUSION",
    icon: Clock,
  },
  {
    label: "مسارات البكالوريا",
    value: "٤ مسارات",
    code: "SEC_2_BACC",
    icon: Layers,
  },
  {
    label: "سعة المدرجات",
    value: "١٧٥ مقعداً",
    code: "4 HALLS ACTIVE",
    icon: Building2,
  },
  {
    label: "توثيق البوابة",
    value: "٠٫٢ ثانية",
    code: "HMAC-SHA256",
    icon: QrCode,
  },
] as const;

async function loadLandingData(): Promise<{
  readonly schools: readonly SchoolRow[];
  readonly catalog: SchoolCatalogBundle | null;
}> {
  try {
    const [schools, catalog] = await Promise.all([
      getActiveSchools(),
      getSchoolCatalogBySlug("ali-bin-abi-talib"),
    ]);
    return { schools, catalog };
  } catch {
    return { schools: [], catalog: null };
  }
}

export default async function NationalLandingPage() {
  const { schools, catalog } = await loadLandingData();

  const tracksToRender: readonly FallbackTrackCard[] = catalog
    ? catalog.tracks.map((track) => {
        const mapped = catalog.trackSubjects
          .filter((ts) => ts.track_id === track.id)
          .map((ts) => catalog.subjects.find((s) => s.id === ts.subject_id))
          .filter((s): s is NonNullable<typeof s> => Boolean(s));

        const coreSubjects = mapped
          .filter((s) => s.subject_type === "track_core")
          .map((s) => s.name_ar);
        const hasSecondLangElective = mapped.some(
          (s) => s.subject_type === "track_elective"
        );

        return {
          code: track.code,
          nameAr: track.name_ar,
          iconKey: track.icon_key,
          coreSubjects,
          hasSecondLangElective,
        };
      })
    : FALLBACK_TRACKS;

  const commonSubjects = catalog
    ? catalog.subjects
        .filter((s) => s.subject_type === "common")
        .map((s) => s.name_ar)
    : FALLBACK_COMMON_SUBJECTS;

  const primarySchool =
    schools.find((s) => s.slug === "ali-bin-abi-talib") ??
    catalog?.school ?? {
      id: "11111111-1111-4111-8111-111111111101",
      slug: "ali-bin-abi-talib",
      name_ar: "مدرسة علي بن أبي طالب الثانوية بنين",
      name_en: "Ali Ibn Abi Talib Boys Secondary School",
      governorate: "القاهرة",
      directorate: "إدارة المرج التعليمية",
      logo_url: "/tenants/ali-bin-abi-talib/logo.svg",
      brand_color_hex: "#1E3A8A",
      default_buffer_minutes: 15,
      is_active: true,
    };

  const displaySchools = schools.length > 0 ? schools : [primarySchool];

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <TopNavbar
        brandHref="/"
        links={[
          { href: "#preview", label: "المعاينة" },
          { href: "#tracks", label: "المسارات" },
          { href: "#schools", label: "المدارس" },
        ]}
      />

      {/* Hero Section: Architectural Grid + Strict Minimal-Text Budget */}
      <section className="arch-grid-bg border-b border-[var(--border-hairline)]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <Badge variant="primary" size="md" dot dotColorClass="bg-emerald-500">
              منظومة البكالوريا المصرية · ٢٠٢٦
            </Badge>

            <h1 className="mt-4 text-3xl font-bold leading-tight text-[var(--text-primary)] sm:text-5xl">
              إدارة مدرجات الثانوية بدقة
            </h1>

            <p className="mt-3 text-sm text-[var(--text-secondary)] sm:text-base">
              حجز مقاعد، تنظيم مسارات، وتوثيق حضور بالرمز.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/register"
                className={buttonVariants({ variant: "primary", size: "lg" })}
              >
                ابدأ الحجز
              </Link>
              <Link
                href="/login"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                دخول تجريبي
              </Link>
            </div>
          </div>

          {/* Interactive Cal.com-style Live Booking Preview */}
          <div id="preview" className="mt-10 scroll-mt-20">
            <LiveBookingPreview />
          </div>
        </div>
      </section>

      {/* 4 Telemetry Bento Tiles */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {TELEMETRY_TILES.map((tile) => {
            const Icon = tile.icon;
            return (
              <Card key={tile.code} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[var(--text-muted)]">
                    {tile.label}
                  </span>
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-sunken)] text-[var(--text-secondary)]">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                </div>
                <p className="mt-2.5 text-xl font-bold text-[var(--text-primary)] tabular-nums sm:text-2xl">
                  {tile.value}
                </p>
                <p
                  className="mt-1 font-mono text-[11px] text-[var(--text-muted)]"
                  dir="ltr"
                >
                  {tile.code}
                </p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* 4 Baccalaureate Tracks Showcase */}
      <section
        id="tracks"
        className="mx-auto max-w-7xl scroll-mt-20 px-4 py-8 sm:px-6"
      >
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
              مسارات البكالوريا الأربعة
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              الصف الثاني الثانوي — قيد إلكتروني موحد
            </p>
          </div>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A8A] hover:underline dark:text-blue-400"
          >
            <span>اختيار المسار</span>
            <ArrowUpLeft className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tracksToRender.map((track) => {
            const style = getTrackStyle(track.code);
            return (
              <Card key={track.code} variant="interactive">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <TrackIcon trackCode={track.code} iconKey={track.iconKey} size="md" />
                    <Badge variant="mono" dir="ltr">
                      {track.code}
                    </Badge>
                  </div>
                  <CardTitle className="mt-3 text-base">{track.nameAr}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {track.coreSubjects.map((subj) => (
                      <span
                        key={subj}
                        className={cn(
                          "rounded-md border px-2 py-1 text-xs font-medium",
                          style.badgeClass
                        )}
                      >
                        {subj}
                      </span>
                    ))}
                  </div>
                  {track.hasSecondLangElective && (
                    <div className="mt-1 rounded-md border border-dashed border-[var(--border-strong)] bg-[var(--bg-sunken)] px-2.5 py-1.5 text-[11px] text-[var(--text-secondary)]">
                      اختياري: إيطالي · فرنسي · ألماني
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 4 Common Core Subjects Strip */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-3 hairline-lift">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>المواد المشتركة لجميع المسارات</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {commonSubjects.map((subject) => (
              <Badge key={subject} variant="neutral" size="md">
                {subject}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* Tenant #1 & Active Schools Showcase */}
      <section
        id="schools"
        className="mx-auto max-w-7xl scroll-mt-20 px-4 py-8 pb-14 sm:px-6"
      >
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
              المدارس المعتمدة بالمنصة
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              بوابات مستقلة ومعزولة لكل مدرسة
            </p>
          </div>
          <Badge variant="success" dot>
            {displaySchools.length} مدرسة مفعلة
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {displaySchools.map((school) => (
            <Card key={school.slug} variant="interactive" className="overflow-hidden">
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={school.logo_url || "/tenants/ali-bin-abi-talib/logo.svg"}
                      alt={school.name_ar}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="primary" size="sm">
                        نموذج رائد
                      </Badge>
                      <Badge variant="mono" size="sm" dir="ltr">
                        {school.slug}
                      </Badge>
                    </div>
                    <h3 className="mt-1.5 truncate text-base font-bold text-[var(--text-primary)]">
                      {school.name_ar}
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {school.governorate} · {school.directorate}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/s/${school.slug}`}
                    className={buttonVariants({ variant: "primary", size: "md" })}
                  >
                    دخول المدرسة
                  </Link>
                  <Link
                    href="/login"
                    className={buttonVariants({ variant: "outline", size: "md" })}
                  >
                    تجربة
                  </Link>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-5 py-2.5 text-xs text-[var(--text-secondary)]">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>نظام البكالوريا المصرية</span>
                </span>
                <span className="tabular-nums">
                  فاصل المدرجات: {school.default_buffer_minutes} دقيقة
                </span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Architectural Footer */}
      <footer className="border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-[var(--text-muted)] sm:px-6">
          <div className="flex items-center gap-2.5">
            <ModarragLogo size="sm" showWordmark />
            <span>· منظومة حجز المدرجات المدرسية</span>
          </div>
          <div className="flex items-center gap-3 font-mono" dir="ltr">
            <span>Africa/Cairo</span>
            <span>·</span>
            <span>modarrag.app</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
