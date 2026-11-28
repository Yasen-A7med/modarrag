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
import {
  formatArabicNumber,
  formatCairoDate,
} from "@/lib/formatters";
import {
  formatFileSizeAr,
  LECTURE_VISIBILITY_META,
} from "@/lib/lecture-media";
import { cn } from "@/lib/utils";

export interface SchoolLecturesClientProps {
  readonly data: SchoolLecturesCatalogData;
}

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
      {/* Header Banner */}
      <MotionReveal className="ambient-mesh rounded-3xl border border-[#2563EB]/20 p-6 hairline-lift dark:border-cyan-500/25">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[#2563EB] dark:text-cyan-300">
              {data.schoolNameAr}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-[#0A1F44] dark:text-[var(--text-primary)]">
              مكتبة المحاضرات المسجلة
            </h1>
            <p className="mt-1 text-base text-[var(--text-secondary)]">
              تشمل المحاضرات العامة للجميع والمحاضرات المخصصة لمن حضر الحصة وسُجّل حضوره.
            </p>
          </div>

          <Link
            href={`/s/${data.schoolSlug}/student`}
            className={buttonVariants({
              variant: "outline",
              size: "md",
              className: "bg-[var(--bg-surface)]/95 shrink-0",
            })}
          >
            جدول الحصص المباشرة
          </Link>
        </div>

        <p className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]/90 px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)]">
          <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          <span>
            المحاضرات السرية مخفية ولا تظهر هنا — وتُفتح فقط من الرابط الخاص وكلمة المرور التي يرسلها المعلم.
          </span>
        </p>
      </MotionReveal>

      {/* Subject Filter Bar */}
      {filterOptions.length > 1 && (
        <AnimatedFilterTabs
          layoutId="lectures-subject-filter"
          ariaLabel="تصفية المحاضرات حسب المادة"
          options={filterOptions}
          value={selectedSubjectId}
          onChange={setSelectedSubjectId}
        />
      )}

      {/* Lectures Grid */}
      {visibleLectures.length === 0 ? (
        <Card className="rounded-3xl p-10 text-center">
          <Video className="mx-auto h-10 w-10 text-[#2563EB] dark:text-cyan-400" />
          <h2 className="mt-3 text-xl font-bold text-[var(--text-primary)]">
            لا توجد محاضرات مسجلة متاحة حالياً
          </h2>
          <p className="mt-1 text-base text-[var(--text-secondary)]">
            عند قيام معلمي المدرسة برفع فيديوهات المراجعة ستظهر لك هنا مباشرة.
          </p>
        </Card>
      ) : (
        <MotionStaggerGrid className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleLectures.map((lecture) => {
            const meta = LECTURE_VISIBILITY_META[lecture.visibility];
            const isPublic = lecture.visibility === "public";
            return (
              <MotionStaggerCard
                key={lecture.id}
                className={cn(
                  "hover-lift-card flex flex-col justify-between gap-4 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 hairline-lift",
                  isPublic
                    ? "border-t-4 border-t-[#16A34A] dark:border-t-emerald-500"
                    : "border-t-4 border-t-[#2563EB] dark:border-t-blue-500"
                )}
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="neutral">{lecture.subjectNameAr}</Badge>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold",
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

                  <h3 className="mt-3 text-lg font-bold text-[var(--text-primary)]">
                    {lecture.titleAr}
                  </h3>

                  {lecture.descriptionAr && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-[var(--text-secondary)]">
                      {lecture.descriptionAr}
                    </p>
                  )}

                  <div className="mt-3 flex flex-col gap-1 text-xs text-[var(--text-muted)]">
                    <span>المعلم: {lecture.teacherCode}</span>
                    {lecture.sessionTitleAr && (
                      <span>الحصة المرتبطة: {lecture.sessionTitleAr}</span>
                    )}
                    <div className="flex flex-wrap gap-3 pt-1">
                      <span className="inline-flex items-center gap-1">
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
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 border-t border-[var(--border-hairline)] pt-3">
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
                      size="lg"
                      fullWidth
                      loading={loadingId === lecture.id}
                      onClick={() => handleWatch(lecture)}
                      leftIcon={<PlayCircle className="h-5 w-5" />}
                    >
                      شاهد المحاضرة الآن
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
                      سجّل دخولك للتحقق من الحضور
                    </Link>
                  ) : (
                    <Button variant="secondary" size="md" fullWidth disabled>
                      مخصصة لمن حضر الحصة ✓
                    </Button>
                  )}
                </div>
              </MotionStaggerCard>
            );
          })}
        </MotionStaggerGrid>
      )}

      {/* Video Player Modal */}
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
                  {activePlayback.lecture.subjectNameAr} · {activePlayback.lecture.teacherCode}
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
