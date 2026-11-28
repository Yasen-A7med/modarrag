"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  Globe,
  Lock,
  PlayCircle,
  UserCheck,
  Video,
  Wallet,
} from "lucide-react";
import {
  getLecturePlaybackAction,
  type PlaybackMediaPayload,
  type SchoolLecturesCatalogData,
  type StudentLectureCardItem,
} from "@/application/lectures/actions";
import { LectureVideoPlayer } from "@/components/lectures/LectureVideoPlayer";
import {
  AnimatedFilterTabs,
  MotionReveal,
  MotionStaggerCard,
  MotionStaggerGrid,
} from "@/components/motion/MotionPrimitives";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { formatArabicNumber, formatCairoDate } from "@/lib/formatters";
import {
  formatFileSizeAr,
  LECTURE_VISIBILITY_META,
} from "@/lib/lecture-media";
import { cn } from "@/lib/utils";

export interface SchoolLecturesClientProps {
  readonly data: SchoolLecturesCatalogData;
}

/**
 * Slide 9 Blueprint: Recorded Lectures Library with Deep Navy (#0A1F44) header,
 * subject pill filter, and responsive Bento video grid featuring live SVG artwork.
 */
export function SchoolLecturesClient({ data }: SchoolLecturesClientProps) {
  const { toast } = useToast();
  const [selectedSubjectId, setSelectedSubjectId] = React.useState<string>("all");
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [activePlayback, setActivePlayback] = React.useState<{
    readonly lecture: StudentLectureCardItem;
    readonly media: PlaybackMediaPayload;
  } | null>(null);

  const filterOptions = React.useMemo(
    () => [
      { id: "all", label: `الكل (${formatArabicNumber(data.lectures.length)})` },
      ...data.subjects
        .filter((s) => data.lectures.some((l) => l.subjectId === s.id))
        .map((s) => ({ id: s.id, label: s.nameAr })),
    ],
    [data.lectures, data.subjects]
  );

  const visibleLectures = React.useMemo(() => {
    if (selectedSubjectId === "all") return data.lectures;
    return data.lectures.filter((l) => l.subjectId === selectedSubjectId);
  }, [data.lectures, selectedSubjectId]);

  const handleWatch = async (lecture: StudentLectureCardItem) => {
    setLoadingId(lecture.id);
    try {
      const res = await getLecturePlaybackAction({
        schoolSlug: data.schoolSlug,
        lectureId: lecture.id,
      });

      if (!res.ok) {
        toast({
          title: "تعذر فتح المحاضرة",
          description: res.error.message,
          variant: "error",
        });
        return;
      }

      setActivePlayback({ lecture, media: res.data });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Slide 9 Deep Navy Video Showcase Banner */}
      <MotionReveal className="rounded-[2rem] bg-[#0A1F44] p-6 sm:p-8 text-white shadow-[0_22px_50px_-18px_rgba(10,31,68,0.45)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge
              variant="mono"
              className="border-cyan-400/35 bg-cyan-400/15 text-cyan-200"
            >
              {data.schoolNameAr}
            </Badge>
            <h1 className="mt-2.5 text-2xl font-extrabold text-white sm:text-3xl">
              مكتبة المحاضرات المسجلة
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              محاضرات المراجعة العامة والحصص المخصصة لمن حضر بالمدرسة أو الأونلاين
            </p>
          </div>

          <Link
            href={`/s/${data.schoolSlug}/student`}
            className={buttonVariants({
              variant: "outline",
              size: "md",
              className:
                "border-white/25 bg-white/10 text-white hover:bg-white/20 shrink-0",
            })}
          >
            جدول الحصص
          </Link>
        </div>

        <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-3.5 py-2 text-xs font-medium text-cyan-200">
          <Lock className="h-3.5 w-3.5 text-amber-300 shrink-0" />
          <span>
            المحاضرات السرية مخفية تماماً هنا وتُفتح بالرابط وكلمة المرور من المعلم
          </span>
        </div>
      </MotionReveal>

      {/* Subject Pill Filter */}
      {filterOptions.length > 1 && (
        <AnimatedFilterTabs
          layoutId="lectures-subject-filter"
          ariaLabel="تصفية المحاضرات حسب المادة"
          options={filterOptions}
          value={selectedSubjectId}
          onChange={setSelectedSubjectId}
        />
      )}

      {/* Bento Video Cards Grid */}
      {visibleLectures.length === 0 ? (
        <Card className="rounded-3xl p-10 text-center">
          <Video className="mx-auto h-10 w-10 text-[#2563EB] dark:text-cyan-400" />
          <h2 className="mt-3 text-xl font-bold text-[var(--text-primary)]">
            لا توجد محاضرات مسجلة حالياً
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            عند رفع المعلمين لمقاطع المراجعة ستظهر هنا مباشرة.
          </p>
        </Card>
      ) : (
        <MotionStaggerGrid className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleLectures.map((lecture, idx) => {
            const meta = LECTURE_VISIBILITY_META[lecture.visibility];
            const isPublic = lecture.visibility === "public";
            const isFeatured = idx === 0 && visibleLectures.length >= 3;

            return (
              <MotionStaggerCard
                key={lecture.id}
                className={cn(
                  "hover-lift-card group flex flex-col justify-between overflow-hidden rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] hairline-lift",
                  isFeatured && "md:col-span-2 lg:col-span-2"
                )}
              >
                {/* Crisp Dark Geometric Video Thumbnail Header (100% live vector art) */}
                <div>
                  <div className="relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br from-[#0A1F44] via-[#132E5C] to-[#1E3A8A] p-5 text-white">
                    <svg
                      className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
                      viewBox="0 0 400 160"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle cx="340" cy="30" r="90" stroke="#22D3EE" strokeWidth="1.5" />
                      <circle cx="60" cy="140" r="70" stroke="#2563EB" strokeWidth="1.5" />
                    </svg>

                    <div className="relative z-10 flex w-full items-start justify-between gap-2 self-start">
                      <span className="rounded-lg bg-white/15 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-xs">
                        {lecture.subjectNameAr}
                      </span>

                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold backdrop-blur-xs",
                          meta.badgeClass
                        )}
                      >
                        {isPublic ? (
                          <Globe className="h-3.5 w-3.5" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5" />
                        )}
                        <span>{meta.shortLabelAr}</span>
                      </span>
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-cyan-300/40 bg-white/10 text-cyan-200 shadow-lg backdrop-blur-md transition-transform duration-200 group-hover:scale-110">
                        {lecture.canWatch ? (
                          <PlayCircle className="h-7 w-7" />
                        ) : (
                          <Lock className="h-6 w-6 text-amber-300" />
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 pb-3">
                    <h2 className="text-lg font-extrabold text-[var(--text-primary)]">
                      {lecture.titleAr}
                    </h2>

                    {lecture.descriptionAr && (
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">
                        {lecture.descriptionAr}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                      <span>{lecture.teacherCode}</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="h-3.5 w-3.5" />
                        {lecture.durationMinutes
                          ? `${formatArabicNumber(lecture.durationMinutes)} دقيقة`
                          : formatCairoDate(lecture.createdAt)}
                      </span>
                      {lecture.fileSizeBytes && (
                        <span className="tabular-nums">
                          {formatFileSizeAr(lecture.fileSizeBytes)}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                        <Wallet className="h-3.5 w-3.5" />
                        {lecture.priceEgp > 0
                          ? `${formatArabicNumber(lecture.priceEgp)} ج.م`
                          : "مجانية"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 border-t border-[var(--border-hairline)] px-5 py-4">
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold",
                      lecture.canWatch
                        ? "bg-emerald-50/90 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200"
                        : "bg-amber-50/90 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200"
                    )}
                  >
                    {lecture.canWatch ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : (
                      <Lock className="h-4 w-4 shrink-0" />
                    )}
                    <span>{lecture.accessReasonAr}</span>
                  </div>

                  {lecture.canWatch ? (
                    <Button
                      variant={isPublic ? "emerald" : "primary"}
                      size="md"
                      fullWidth
                      loading={loadingId === lecture.id}
                      onClick={() => handleWatch(lecture)}
                      leftIcon={<PlayCircle className="h-5 w-5" />}
                    >
                      تشغيل المحاضرة
                    </Button>
                  ) : lecture.requiresLoginToCheck ? (
                    <Link
                      href="/login"
                      className={buttonVariants({
                        variant: "outline",
                        size: "md",
                        fullWidth: true,
                      })}
                    >
                      سجّل للتحقق من الحضور
                    </Link>
                  ) : (
                    <Button variant="secondary" size="md" fullWidth disabled>
                      مخصصة للحاضرين ✓
                    </Button>
                  )}
                </div>
              </MotionStaggerCard>
            );
          })}
        </MotionStaggerGrid>
      )}

      {/* Cinema Playback Dialog */}
      <Dialog
        open={activePlayback !== null}
        onOpenChange={(open) => {
          if (!open) setActivePlayback(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          {activePlayback && (
            <>
              <DialogHeader>
                <DialogTitle>{activePlayback.lecture.titleAr}</DialogTitle>
                <DialogDescription>
                  {activePlayback.lecture.subjectNameAr} ·{" "}
                  {activePlayback.lecture.teacherCode}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-3">
                <LectureVideoPlayer media={activePlayback.media} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
