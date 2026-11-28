"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock,
  Copy,
  Film,
  Globe,
  KeyRound,
  Link2,
  Lock,
  Pencil,
  PlayCircle,
  Trash2,
  UploadCloud,
  UserCheck,
  Video,
  Wallet,
} from "lucide-react";
import {
  createLectureUploadIntentAction,
  deleteLectureAction,
  getLecturePlaybackAction,
  publishLectureAction,
  updateLectureAccessAction,
  type PlaybackMediaPayload,
  type TeacherLectureRecord,
  type TeacherLecturesWorkspaceData,
} from "@/application/lectures/actions";
import { LectureVideoPlayer } from "@/components/lectures/LectureVideoPlayer";
import { MotionReveal } from "@/components/motion/MotionPrimitives";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input, SelectInput } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { LectureVisibility } from "@/infrastructure/supabase/database.types";
import { formatArabicNumber, formatCairoDate } from "@/lib/formatters";
import {
  formatFileSizeAr,
  isSupportedLectureVideoMime,
  LECTURE_VISIBILITY_META,
  MAX_LECTURE_UPLOAD_BYTES,
} from "@/lib/lecture-media";
import { cn } from "@/lib/utils";

const VISIBILITY_CHOICES: readonly {
  readonly value: LectureVisibility;
  readonly title: string;
  readonly hint: string;
  readonly icon: typeof Globe;
  readonly activeClass: string;
}[] = [
  {
    value: "public",
    title: "عامة للجميع",
    hint: "تظهر بمكتبة المدرسة مباشرةً",
    icon: Globe,
    activeClass:
      "border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-100",
  },
  {
    value: "attendees_only",
    title: "للحاضرين فقط",
    hint: "تفتح لمن سُجّل حضوره بالحصة",
    icon: UserCheck,
    activeClass:
      "border-[#22D3EE] bg-cyan-50/70 text-[#0A1F44] ring-2 ring-[#22D3EE]/35 shadow-[0_10px_28px_-10px_rgba(34,211,238,0.45)] dark:bg-cyan-500/15 dark:text-cyan-100",
  },
  {
    value: "secret",
    title: "سرية بكلمة مرور",
    hint: "مخفية — برابط خاص وكلمة مرور",
    icon: Lock,
    activeClass:
      "border-amber-500 bg-amber-50/80 text-amber-950 ring-2 ring-amber-500/30 dark:bg-amber-500/15 dark:text-amber-100",
  },
];

export interface TeacherLecturesClientProps {
  readonly data: TeacherLecturesWorkspaceData;
}

/**
 * Slide 3 Blueprint: Teacher Recorded Lectures Studio with Drag/Drop file uploader +
 * video URL switch, 3 large glowing tier selector pills, pricing field, and compact actions table.
 */
export function TeacherLecturesClient({ data }: TeacherLecturesClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [editedById, setEditedById] = React.useState<
    Record<string, { readonly titleAr: string; readonly visibility: LectureVisibility }>
  >({});
  const [deletedIds, setDeletedIds] = React.useState<readonly string[]>([]);

  const lectures = React.useMemo(
    () =>
      data.lectures
        .filter((l) => !deletedIds.includes(l.id))
        .map((l) => {
          const override = editedById[l.id];
          return override ? { ...l, ...override } : l;
        }),
    [data.lectures, deletedIds, editedById]
  );
  const [sourceMode, setSourceMode] = React.useState<"file" | "url">("file");
  const [subjectId, setSubjectId] = React.useState(data.subjects[0]?.id ?? "");
  const [sessionId, setSessionId] = React.useState("");
  const [titleAr, setTitleAr] = React.useState("");
  const [descriptionAr, setDescriptionAr] = React.useState("");
  const [visibility, setVisibility] = React.useState<LectureVisibility>("public");
  const [priceEgp, setPriceEgp] = React.useState("0");
  const [secretPassword, setSecretPassword] = React.useState("");
  const [externalUrl, setExternalUrl] = React.useState("");
  const [durationMinutes, setDurationMinutes] = React.useState("");
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);

  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [previewData, setPreviewData] = React.useState<{
    readonly titleAr: string;
    readonly media: PlaybackMediaPayload;
  } | null>(null);
  const [editTarget, setEditTarget] = React.useState<TeacherLectureRecord | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editVisibility, setEditVisibility] = React.useState<LectureVisibility>("public");
  const [editSessionId, setEditSessionId] = React.useState("");
  const [editPassword, setEditPassword] = React.useState("");
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<TeacherLectureRecord | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_LECTURE_UPLOAD_BYTES) {
      toast({
        title: "حجم الملف يتجاوز ٥٠ ميجابايت",
        description: "يمكنك استخدام خيار «رابط فيديو» للملفات الكبيرة.",
        variant: "error",
      });
      return;
    }
    if (!isSupportedLectureVideoMime(file.type)) {
      toast({
        title: "صيغة غير مدعومة",
        description: "الصيغ المدعومة: MP4، WebM، MOV.",
        variant: "error",
      });
      return;
    }
    setSelectedFile(file);
  };

  const handlePublish = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!subjectId) {
      toast({ title: "يرجى اختيار المادة الدراسية", variant: "error" });
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);
    try {
      let storagePath: string | null = null;
      let fileSizeBytes: number | null = null;
      let mimeType: string | null = null;

      if (sourceMode === "file") {
        if (!selectedFile) {
          toast({ title: "اختر ملف فيديو أو تحول لرابط فيديو", variant: "error" });
          return;
        }
        const intent = await createLectureUploadIntentAction({
          schoolSlug: data.schoolSlug,
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
          fileSizeBytes: selectedFile.size,
        });
        if (!intent.ok) {
          toast({
            title: "تعذر تجهيز الرفع",
            description: intent.error.message,
            variant: "error",
          });
          return;
        }

        setUploadProgress(40);
        const upRes = await fetch(intent.data.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": selectedFile.type },
          body: selectedFile,
        });
        if (!upRes.ok) {
          toast({ title: "فشل رفع الفيديو إلى التخزين السحابي", variant: "error" });
          return;
        }
        setUploadProgress(100);
        storagePath = intent.data.storagePath;
        fileSizeBytes = selectedFile.size;
        mimeType = selectedFile.type;
      }

      const parsedDuration = durationMinutes
        ? Number.parseInt(durationMinutes, 10)
        : null;
      const parsedPrice = Math.max(0, Number.parseInt(priceEgp || "0", 10) || 0);

      const pubRes = await publishLectureAction({
        schoolSlug: data.schoolSlug,
        subjectId,
        sessionId: sessionId || null,
        titleAr: titleAr.trim(),
        descriptionAr: descriptionAr.trim() || undefined,
        visibility,
        priceEgp: parsedPrice,
        storagePath,
        externalVideoUrl: sourceMode === "url" ? externalUrl.trim() : null,
        fileSizeBytes,
        mimeType,
        durationMinutes:
          parsedDuration && !Number.isNaN(parsedDuration) ? parsedDuration : null,
        secretPassword: visibility === "secret" ? secretPassword.trim() : undefined,
      });

      if (!pubRes.ok) {
        toast({
          title: "تعذر نشر المحاضرة",
          description: pubRes.error.message,
          variant: "error",
        });
        return;
      }

      toast({ title: "تم نشر المحاضرة بنجاح ✓", variant: "success" });
      setTitleAr("");
      setDescriptionAr("");
      setExternalUrl("");
      setSecretPassword("");
      setSelectedFile(null);
      setUploadProgress(0);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = async (lecture: TeacherLectureRecord) => {
    const shareUrl = `${window.location.origin}/s/${data.schoolSlug}/lectures/${lecture.shareToken}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedId(lecture.id);
      toast({
        title:
          lecture.visibility === "secret"
            ? "تم نسخ الرابط السري ✓"
            : "تم نسخ رابط المحاضرة ✓",
        variant: "success",
      });
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: "تعذر النسخ التلقائي", variant: "warning" });
    }
  };

  const handlePreview = async (lecture: TeacherLectureRecord) => {
    const res = await getLecturePlaybackAction({
      schoolSlug: data.schoolSlug,
      lectureId: lecture.id,
    });
    if (!res.ok) {
      toast({
        title: "تعذر تشغيل المعاينة",
        description: res.error.message,
        variant: "error",
      });
      return;
    }
    setPreviewData({ titleAr: lecture.titleAr, media: res.data });
  };

  const openEditDialog = (lecture: TeacherLectureRecord) => {
    setEditTarget(lecture);
    setEditTitle(lecture.titleAr);
    setEditVisibility(lecture.visibility);
    setEditSessionId(lecture.sessionId ?? "");
    setEditPassword("");
  };

  const handleSaveEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      const res = await updateLectureAccessAction({
        schoolSlug: data.schoolSlug,
        lectureId: editTarget.id,
        titleAr: editTitle.trim(),
        visibility: editVisibility,
        sessionId: editSessionId || null,
        newSecretPassword: editPassword.trim() || undefined,
      });
      if (!res.ok) {
        toast({
          title: "تعذر التحديث",
          description: res.error.message,
          variant: "error",
        });
        return;
      }
      setEditedById((prev) => ({
        ...prev,
        [editTarget.id]: {
          titleAr: editTitle.trim(),
          visibility: editVisibility,
        },
      }));
      toast({ title: "تم حفظ التعديلات ✓", variant: "success" });
      setEditTarget(null);
      router.refresh();
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await deleteLectureAction({
        schoolSlug: data.schoolSlug,
        lectureId: deleteTarget.id,
      });
      if (!res.ok) {
        toast({
          title: "تعذر الحذف",
          description: res.error.message,
          variant: "error",
        });
        return;
      }
      setDeletedIds((prev) => [...prev, deleteTarget.id]);
      toast({ title: "تم حذف المحاضرة ✓", variant: "success" });
      setDeleteTarget(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Studio Upload Card */}
      <MotionReveal>
        <Card className="overflow-hidden rounded-[2rem]">
          <CardHeader className="border-b border-[var(--border-hairline)] pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Badge variant="info" size="md">
                  استوديو المحاضرات المسجلة
                </Badge>
                <CardTitle className="mt-2 text-2xl font-extrabold">
                  نشر محاضرة مسجلة
                </CardTitle>
              </div>

              <div className="inline-flex rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setSourceMode("file")}
                  className={cn(
                    "inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 font-bold cursor-pointer",
                    sourceMode === "file"
                      ? "bg-[#0A1F44] text-white dark:bg-blue-600"
                      : "text-[var(--text-secondary)]"
                  )}
                >
                  <UploadCloud className="h-3.5 w-3.5" />
                  <span>رفع فيديو</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode("url")}
                  className={cn(
                    "inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 font-bold cursor-pointer",
                    sourceMode === "url"
                      ? "bg-[#2563EB] text-white"
                      : "text-[var(--text-secondary)]"
                  )}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  <span>رابط فيديو</span>
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-5">
            <form onSubmit={handlePublish} className="flex flex-col gap-5">
              {/* Drag / Drop or Link Source */}
              {sourceMode === "file" ? (
                <div className="rounded-2xl border-2 border-dashed border-[#2563EB]/35 bg-[var(--bg-sunken)] p-6 text-center transition-colors hover:border-[#2563EB]">
                  <label className="flex cursor-pointer flex-col items-center gap-2">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0A1F44] text-cyan-300">
                      <Film className="h-6 w-6" />
                    </span>
                    <span className="text-sm font-extrabold text-[var(--text-primary)]">
                      {selectedFile
                        ? `${selectedFile.name} (${formatFileSizeAr(selectedFile.size)})`
                        : "اسحب ملف الفيديو هنا أو اضغط للاختيار"}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      MP4 أو WebM — حتى ٥٠ ميجابايت، أو اختر «رابط فيديو» للمحاضرات الطويلة
                    </span>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      className="sr-only"
                      onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                    />
                  </label>

                  {uploadProgress > 0 && (
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full bg-[#2563EB] transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <Input
                  label="رابط الفيديو (YouTube أو Google Drive أو Vimeo)"
                  type="url"
                  required
                  dir="ltr"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  startAdornment={<Link2 className="h-4 w-4" />}
                />
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Input
                  label="عنوان المحاضرة"
                  required
                  placeholder="مثال: حل امتحانات الوحدة الثانية"
                  value={titleAr}
                  onChange={(e) => setTitleAr(e.target.value)}
                  containerClassName="lg:col-span-2"
                />

                <SelectInput
                  label="المادة"
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                >
                  {data.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nameAr}
                    </option>
                  ))}
                </SelectInput>

                <Input
                  label="سعر المحاضرة (ج.م)"
                  type="number"
                  min={0}
                  max={10000}
                  dir="ltr"
                  value={priceEgp}
                  onChange={(e) => setPriceEgp(e.target.value)}
                  startAdornment={<Wallet className="h-4 w-4" />}
                />
              </div>

              {/* Slide 3: 3 Glowing Visibility Selector Pills */}
              <div className="flex flex-col gap-2">
                <span className="text-sm font-bold text-[var(--text-primary)]">
                  صلاحية المشاهدة
                </span>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {VISIBILITY_CHOICES.map((opt) => {
                    const Icon = opt.icon;
                    const active = visibility === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setVisibility(opt.value)}
                        className={cn(
                          "flex min-h-[76px] items-center gap-3 rounded-2xl border p-4 text-start transition-all cursor-pointer",
                          active
                            ? opt.activeClass
                            : "border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]"
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        <div>
                          <p className="text-sm font-extrabold">{opt.title}</p>
                          <p className="mt-0.5 text-xs opacity-80">{opt.hint}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {visibility === "attendees_only" && (
                  <SelectInput
                    label="الحصة المرتبطة للتحقق من الحضور"
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    containerClassName="sm:col-span-2"
                  >
                    <option value="">اختر الحصة...</option>
                    {data.sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.titleAr} ({s.subjectNameAr})
                      </option>
                    ))}
                  </SelectInput>
                )}

                {visibility === "secret" && (
                  <Input
                    label="كلمة مرور المحاضرة السرية"
                    type="text"
                    required
                    minLength={4}
                    dir="ltr"
                    placeholder="مثال: Phys2026"
                    value={secretPassword}
                    onChange={(e) => setSecretPassword(e.target.value)}
                    startAdornment={<KeyRound className="h-4 w-4" />}
                    containerClassName="sm:col-span-2"
                  />
                )}

                <Input
                  label="المدة التقريبية (دقائق)"
                  type="number"
                  min={1}
                  max={600}
                  dir="ltr"
                  placeholder="60"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={submitting}
                leftIcon={<Video className="h-5 w-5" />}
              >
                نشر المحاضرة الآن
              </Button>
            </form>
          </CardContent>
        </Card>
      </MotionReveal>

      {/* Published Lectures List */}
      <Card>
        <CardHeader className="border-b border-[var(--border-hairline)] pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-extrabold">
              المحاضرات المنشورة ({formatArabicNumber(lectures.length)})
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {lectures.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--text-muted)]">
              لم ترفع أي محاضرات مسجلة بعد.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-hairline)]">
              {lectures.map((lecture) => {
                const meta = LECTURE_VISIBILITY_META[lecture.visibility];
                return (
                  <div
                    key={lecture.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="neutral">{lecture.subjectNameAr}</Badge>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold",
                            meta.badgeClass
                          )}
                        >
                          {meta.shortLabelAr}
                        </span>
                        {lecture.priceEgp > 0 && (
                          <Badge variant="warning">
                            {formatArabicNumber(lecture.priceEgp)} ج.م
                          </Badge>
                        )}
                      </div>

                      <h3 className="mt-1.5 text-base font-extrabold text-[var(--text-primary)]">
                        {lecture.titleAr}
                      </h3>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)] tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatCairoDate(lecture.createdAt)}
                        </span>
                        {lecture.sessionTitleAr && (
                          <span>· مرتبطة بـ: {lecture.sessionTitleAr}</span>
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyLink(lecture)}
                        leftIcon={
                          copiedId === lecture.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )
                        }
                      >
                        {lecture.visibility === "secret" ? "نسخ الرابط السري" : "نسخ الرابط"}
                      </Button>

                      <Button
                        size="icon"
                        variant="outline"
                        aria-label="معاينة الفيديو"
                        onClick={() => handlePreview(lecture)}
                      >
                        <PlayCircle className="h-4 w-4 text-[#2563EB]" />
                      </Button>

                      <Button
                        size="icon"
                        variant="outline"
                        aria-label="تعديل المحاضرة"
                        onClick={() => openEditDialog(lecture)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Button
                        size="icon"
                        variant="outline"
                        aria-label="حذف"
                        onClick={() => setDeleteTarget(lecture)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog
        open={previewData !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewData(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          {previewData && (
            <>
              <DialogHeader>
                <DialogTitle>{previewData.titleAr}</DialogTitle>
              </DialogHeader>
              <div className="mt-3">
                <LectureVideoPlayer media={previewData.media} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Lecture Dialog */}
      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل إعدادات المحاضرة</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="mt-4 flex flex-col gap-4">
            <Input
              label="عنوان المحاضرة"
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
            <SelectInput
              label="الصلاحية"
              value={editVisibility}
              onChange={(e) =>
                setEditVisibility(e.target.value as LectureVisibility)
              }
            >
              <option value="public">عامة للجميع</option>
              <option value="attendees_only">للحاضرين فقط</option>
              <option value="secret">سرية بكلمة مرور</option>
            </SelectInput>
            {editVisibility === "secret" && (
              <Input
                label="كلمة مرور جديدة (اختياري)"
                type="text"
                dir="ltr"
                placeholder="اتركه فارغاً للإبقاء على الحالية"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
              />
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditTarget(null)}
              >
                إلغاء
              </Button>
              <Button type="submit" variant="primary" loading={savingEdit}>
                حفظ التعديلات
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف المحاضرة نهائياً</DialogTitle>
            <DialogDescription>
              هل تريد حذف «{deleteTarget?.titleAr}» وملفها المسجل؟
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              تراجع
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={deleting}
              onClick={handleDelete}
            >
              نعم، احذف المحاضرة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
