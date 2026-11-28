"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  FileVideo,
  Globe,
  KeyRound,
  Link2,
  Lock,
  PlayCircle,
  Settings2,
  Trash2,
  UploadCloud,
  UserCheck,
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
import {
  MotionReveal,
  MotionStaggerCard,
  MotionStaggerGrid,
} from "@/components/motion/MotionPrimitives";
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
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/client";
import type { LectureVisibility } from "@/infrastructure/supabase/database.types";
import {
  formatArabicNumber,
  formatCairoDate,
  formatCairoTime,
} from "@/lib/formatters";
import {
  formatFileSizeAr,
  isSupportedLectureVideoMime,
  LECTURE_BUCKET_NAME,
  LECTURE_VISIBILITY_META,
  MAX_LECTURE_UPLOAD_BYTES,
} from "@/lib/lecture-media";
import { cn } from "@/lib/utils";

export interface TeacherLecturesClientProps {
  readonly data: TeacherLecturesWorkspaceData;
}

const VISIBILITY_OPTIONS: readonly {
  readonly value: LectureVisibility;
  readonly icon: typeof Globe;
  readonly activeClass: string;
}[] = [
  {
    value: "public",
    icon: Globe,
    activeClass:
      "border-[#16A34A] bg-emerald-50/80 ring-2 ring-emerald-500/20 dark:border-emerald-400 dark:bg-emerald-500/15",
  },
  {
    value: "attendees_only",
    icon: UserCheck,
    activeClass:
      "border-[#2563EB] bg-[#EEF5FF]/85 ring-2 ring-[#2563EB]/20 dark:border-blue-400 dark:bg-blue-500/15",
  },
  {
    value: "secret",
    icon: KeyRound,
    activeClass:
      "border-[#D97706] bg-amber-50/85 ring-2 ring-amber-500/20 dark:border-amber-400 dark:bg-amber-500/15",
  },
];

export function TeacherLecturesClient({ data }: TeacherLecturesClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Upload & publish state
  const [sourceMode, setSourceMode] = React.useState<"file" | "url">("file");
  const [titleAr, setTitleAr] = React.useState("");
  const [descriptionAr, setDescriptionAr] = React.useState("");
  const [subjectId, setSubjectId] = React.useState(data.subjects[0]?.id ?? "");
  const [visibility, setVisibility] = React.useState<LectureVisibility>("public");
  const [sessionId, setSessionId] = React.useState(data.sessions[0]?.id ?? "");
  const [secretPassword, setSecretPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [durationMinutes, setDurationMinutes] = React.useState("");
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [externalVideoUrl, setExternalVideoUrl] = React.useState("");
  const [uploadingState, setUploadingState] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Playback / Copy / Edit / Delete states
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [playingMedia, setPlayingMedia] = React.useState<PlaybackMediaPayload | null>(null);
  const [loadingPlayerId, setLoadingPlayerId] = React.useState<string | null>(null);
  const [editTarget, setEditTarget] = React.useState<TeacherLectureRecord | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editVisibility, setEditVisibility] = React.useState<LectureVisibility>("public");
  const [editSessionId, setEditSessionId] = React.useState("");
  const [editPassword, setEditPassword] = React.useState("");
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<TeacherLectureRecord | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!isSupportedLectureVideoMime(file.type || "video/mp4")) {
      toast({
        title: "صيغة الملف غير مدعومة",
        description: "يرجى اختيار فيديو بصيغة MP4 أو WebM أو MOV.",
        variant: "error",
      });
      event.target.value = "";
      return;
    }

    if (file.size > MAX_LECTURE_UPLOAD_BYTES) {
      toast({
        title: "حجم الملف أكبر من ٥٠ ميجابايت",
        description:
          "الحد الأقصى للرفع المباشر هو ٥٠ ميجابايت. يمكنك ضغط الفيديو أو لصق رابط يوتيوب / درايف في التبويب المجاور.",
        variant: "info",
      });
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
  };

  const handlePublish = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!subjectId) {
      toast({ title: "اختر المادة أولاً", variant: "error" });
      return;
    }

    if (visibility === "attendees_only" && !sessionId) {
      toast({
        title: "اختر الحصة المرتبطة",
        description: "لتقييد المشاهدة على الحاضرين فقط، حدد الحصة المدرسية.",
        variant: "error",
      });
      return;
    }

    if (visibility === "secret" && secretPassword.trim().length < 4) {
      toast({
        title: "أدخل كلمة مرور قوية",
        description: "اكتب كلمة مرور من ٤ أحرف أو أرقام على الأقل لحماية الرابط السري.",
        variant: "error",
      });
      return;
    }

    if (sourceMode === "file" && !selectedFile) {
      toast({ title: "اختر ملف الفيديو أولاً", variant: "error" });
      return;
    }

    if (sourceMode === "url" && !externalVideoUrl.trim()) {
      toast({ title: "أدخل رابط الفيديو أولاً", variant: "error" });
      return;
    }

    setSubmitting(true);
    try {
      let storagePath: string | null = null;
      let fileSizeBytes: number | null = null;
      let mimeType: string | null = null;

      if (sourceMode === "file" && selectedFile) {
        setUploadingState("جاري تجهيز الرفع الآمن...");
        const resolvedMime = selectedFile.type || "video/mp4";
        const intent = await createLectureUploadIntentAction({
          schoolSlug: data.schoolSlug,
          fileName: selectedFile.name,
          mimeType: resolvedMime,
          fileSizeBytes: selectedFile.size,
        });

        if (!intent.ok) {
          toast({
            title: "تعذر بدء رفع الفيديو",
            description: intent.error.message,
            variant: "error",
          });
          return;
        }

        setUploadingState("جاري رفع ملف المحاضرة المسجلة...");
        const supabase = createSupabaseBrowserClient();
        const { error: uploadErr } = await supabase.storage
          .from(LECTURE_BUCKET_NAME)
          .uploadToSignedUrl(intent.data.storagePath, intent.data.token, selectedFile, {
            contentType: resolvedMime,
          });

        if (uploadErr) {
          toast({
            title: "فشل رفع ملف الفيديو",
            description: uploadErr.message,
            variant: "error",
          });
          return;
        }

        storagePath = intent.data.storagePath;
        fileSizeBytes = selectedFile.size;
        mimeType = resolvedMime;
      }

      setUploadingState("جاري حفظ بيانات المحاضرة...");
      const durationNum = Number.parseInt(durationMinutes, 10);
      const published = await publishLectureAction({
        schoolSlug: data.schoolSlug,
        subjectId,
        sessionId: visibility === "attendees_only" || sessionId ? sessionId || null : null,
        titleAr: titleAr.trim(),
        descriptionAr: descriptionAr.trim() || undefined,
        visibility,
        storagePath,
        externalVideoUrl: sourceMode === "url" ? externalVideoUrl.trim() : null,
        fileSizeBytes,
        mimeType,
        durationMinutes: Number.isFinite(durationNum) && durationNum > 0 ? durationNum : null,
        secretPassword: visibility === "secret" ? secretPassword.trim() : undefined,
      });

      if (!published.ok) {
        toast({
          title: "تعذر نشر المحاضرة",
          description: published.error.message,
          variant: "error",
        });
        return;
      }

      toast({
        title: "تم رفع ونشر المحاضرة بنجاح!",
        description:
          visibility === "secret"
            ? "يمكنك الآن نسخ الرابط السري من القائمة بالأسفل وإرساله مع كلمة المرور."
            : "المحاضرة متاحة الآن حسب مستوى الخصوصية الذي اخترته.",
        variant: "success",
      });

      setTitleAr("");
      setDescriptionAr("");
      setSelectedFile(null);
      setExternalVideoUrl("");
      setSecretPassword("");
      setDurationMinutes("");
      router.refresh();
    } finally {
      setSubmitting(false);
      setUploadingState(null);
    }
  };

  const handleCopyShareLink = async (lecture: TeacherLectureRecord) => {
    const shareUrl = `${window.location.origin}/s/${data.schoolSlug}/lectures/${lecture.shareToken}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopiedId(lecture.id);
    toast({
      title: "تم نسخ رابط المحاضرة",
      description:
        lecture.visibility === "secret"
          ? "أرسل هذا الرابط مع كلمة المرور للشخص المصرّح له فقط."
          : "تم نسخ الرابط المباشر بنجاح.",
      variant: "success",
    });
    setTimeout(() => {
      setCopiedId((prev) => (prev === lecture.id ? null : prev));
    }, 2500);
  };

  const handlePreviewLecture = async (lecture: TeacherLectureRecord) => {
    setLoadingPlayerId(lecture.id);
    try {
      const res = await getLecturePlaybackAction({
        schoolSlug: data.schoolSlug,
        lectureId: lecture.id,
      });

      if (!res.ok) {
        toast({
          title: "تعذر تشغيل الفيديو",
          description: res.error.message,
          variant: "error",
        });
        return;
      }

      setPlayingMedia(res.data);
    } finally {
      setLoadingPlayerId(null);
    }
  };

  const openEditDialog = (lecture: TeacherLectureRecord) => {
    setEditTarget(lecture);
    setEditTitle(lecture.titleAr);
    setEditVisibility(lecture.visibility);
    setEditSessionId(lecture.sessionId ?? data.sessions[0]?.id ?? "");
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
        sessionId: editVisibility === "attendees_only" ? editSessionId || null : null,
        newSecretPassword: editPassword.trim() || undefined,
      });

      if (!res.ok) {
        toast({
          title: "تعذر حفظ التعديلات",
          description: res.error.message,
          variant: "error",
        });
        return;
      }

      toast({ title: "تم تحديث إعدادات الوصول للمحاضرة", variant: "success" });
      setEditTarget(null);
      router.refresh();
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await deleteLectureAction({
        schoolSlug: data.schoolSlug,
        lectureId: deleteTarget.id,
      });

      if (!res.ok) {
        toast({
          title: "تعذر حذف المحاضرة",
          description: res.error.message,
          variant: "error",
        });
        return;
      }

      toast({ title: "تم حذف المحاضرة والملف بنجاح", variant: "success" });
      setDeleteTarget(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header Summary */}
      <MotionReveal className="ambient-mesh rounded-3xl border border-[#2563EB]/20 p-6 hairline-lift dark:border-cyan-500/25">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[#2563EB] dark:text-cyan-300">
              {data.schoolNameAr}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-[#0A1F44] dark:text-[var(--text-primary)]">
              رفع المحاضرات المسجلة والتحكم في صلاحية المشاهدة
            </h1>
            <p className="mt-1 text-base text-[var(--text-secondary)]">
              اختر الفيديو ثم حدد هل يشاهده الجميع، أم من حضر الحصة فقط، أم برابط سري وكلمة مرور.
            </p>
          </div>
          <Link
            href={`/s/${data.schoolSlug}/lectures`}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border border-[#2563EB]/25 bg-[var(--bg-surface)] px-4 text-sm font-bold text-[#2563EB] hover:border-[#2563EB] dark:text-cyan-300"
          >
            <PlayCircle className="h-4 w-4" />
            <span>معاينة مكتبة المدرسة</span>
          </Link>
        </div>
      </MotionReveal>

      {/* Upload & Access Selection Form */}
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <UploadCloud className="h-5 w-5 text-[#2563EB] dark:text-cyan-400" />
            <span>إضافة محاضرة مسجلة جديدة</span>
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handlePublish} className="flex flex-col gap-5">
            {/* Step 1: Metadata */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="عنوان المحاضرة"
                inputSize="lg"
                required
                minLength={3}
                placeholder="مثال: مراجعة التفاضل والتكامل — الوحدة الثانية"
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-[var(--text-primary)]">
                  المادة الدراسية
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  required
                  className="min-h-[48px] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 text-base font-medium text-[var(--text-primary)] focus:border-[#2563EB] focus:outline-none"
                >
                  {data.subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.nameAr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Input
                  label="وصف مختصر (اختياري)"
                  inputSize="md"
                  placeholder="أبرز النقاط المشروحة في هذا الفيديو للطلاب..."
                  value={descriptionAr}
                  onChange={(e) => setDescriptionAr(e.target.value)}
                />
              </div>

              <Input
                label="مدة الفيديو بالدقائق (اختياري)"
                type="number"
                inputSize="md"
                min={1}
                max={600}
                dir="ltr"
                placeholder="45"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </div>

            {/* Step 2: Source Switcher (File Upload vs External Link) */}
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSourceMode("file")}
                  className={cn(
                    "inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 text-sm font-bold cursor-pointer transition-colors",
                    sourceMode === "file"
                      ? "border-[#2563EB] bg-[#2563EB] text-white"
                      : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                  )}
                >
                  <FileVideo className="h-4 w-4" />
                  <span>رفع ملف فيديو من جهازك (حتى ٥٠ م.ب)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode("url")}
                  className={cn(
                    "inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 text-sm font-bold cursor-pointer transition-colors",
                    sourceMode === "url"
                      ? "border-[#2563EB] bg-[#2563EB] text-white"
                      : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                  )}
                >
                  <Link2 className="h-4 w-4" />
                  <span>أو إضافة رابط فيديو كبير (YouTube / Drive / Vimeo)</span>
                </button>
              </div>

              {sourceMode === "file" ? (
                <div className="mt-4">
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#2563EB]/35 bg-[var(--bg-surface)] p-6 text-center transition-colors hover:border-[#2563EB]">
                    <UploadCloud className="h-8 w-8 text-[#2563EB] dark:text-cyan-400" />
                    <span className="mt-2 text-base font-bold text-[var(--text-primary)]">
                      {selectedFile
                        ? `تم اختيار: ${selectedFile.name} (${formatFileSizeAr(selectedFile.size)})`
                        : "اضغط هنا لاختيار فيديو المحاضرة (MP4 / WebM / MOV)"}
                    </span>
                    <span className="mt-1 text-xs text-[var(--text-muted)]">
                      يُرفع الفيديو إلى خادم خاص محمي ولا يُفتح إلا لمن تمنحه الصلاحية.
                    </span>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </label>
                </div>
              ) : (
                <div className="mt-4">
                  <Input
                    label="رابط الفيديو الآمن (HTTPS)"
                    type="url"
                    inputSize="lg"
                    dir="ltr"
                    placeholder="https://www.youtube.com/watch?v=... أو رابط Google Drive / Vimeo"
                    value={externalVideoUrl}
                    onChange={(e) => setExternalVideoUrl(e.target.value)}
                    hint="يبقى الرابط مخفياً في الخادم ولا يُعرض إلا للطالب المستوفي شروط الوصول."
                  />
                </div>
              )}
            </div>

            {/* Step 3: 3-Tier Visibility Selector */}
            <div className="flex flex-col gap-3">
              <label className="text-base font-bold text-[var(--text-primary)]">
                من يحق له مشاهدة هذه المحاضرة؟
              </label>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {VISIBILITY_OPTIONS.map((opt) => {
                  const meta = LECTURE_VISIBILITY_META[opt.value];
                  const Icon = opt.icon;
                  const isActive = visibility === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setVisibility(opt.value)}
                      className={cn(
                        "flex flex-col items-start gap-2 rounded-2xl border p-4 text-start transition-all cursor-pointer",
                        isActive
                          ? opt.activeClass
                          : "border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]"
                      )}
                    >
                      <div className="flex w-full items-center justify-between">
                        <Icon className="h-5 w-5 text-[#0A1F44] dark:text-cyan-300" />
                        <span
                          className={cn(
                            "h-4 w-4 rounded-full border-2",
                            isActive
                              ? "border-[#2563EB] bg-[#2563EB]"
                              : "border-[var(--border-strong)]"
                          )}
                        />
                      </div>
                      <p className="text-base font-bold text-[var(--text-primary)]">
                        {meta.labelAr}
                      </p>
                      <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                        {meta.descriptionAr}
                      </p>
                    </button>
                  );
                })}
              </div>

              {visibility === "attendees_only" && (
                <div className="mt-2 rounded-2xl border border-blue-200 bg-[#EEF5FF]/70 p-4 dark:border-blue-500/35 dark:bg-blue-500/12">
                  <label className="block text-sm font-bold text-[#0A1F44] dark:text-blue-200">
                    اختر الحصة المدرسية المرتبطة (للتحقق من كشف الحضور تلقائياً)
                  </label>
                  {data.sessions.length === 0 ? (
                    <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
                      لا توجد حصص مسجلة لك حتى الآن. احجز قاعة لحصة أولاً ليتم ربط الحاضرين بها.
                    </p>
                  ) : (
                    <select
                      value={sessionId}
                      onChange={(e) => setSessionId(e.target.value)}
                      required
                      className="mt-2 min-h-[48px] w-full rounded-xl border border-blue-200 bg-[var(--bg-surface)] px-3.5 text-sm font-semibold text-[var(--text-primary)] focus:border-[#2563EB] focus:outline-none dark:border-blue-500/40"
                    >
                      {data.sessions.map((sess) => (
                        <option key={sess.id} value={sess.id}>
                          {sess.subjectNameAr} — {sess.titleAr} (
                          {formatCairoDate(sess.startsAt)} · {formatCairoTime(sess.startsAt)})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {visibility === "secret" && (
                <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-500/35 dark:bg-amber-500/12">
                  <Input
                    label="كلمة مرور المحاضرة السرية"
                    type={showPassword ? "text" : "password"}
                    inputSize="lg"
                    required
                    minLength={4}
                    dir="ltr"
                    placeholder="اكتب كلمة سر مخصصة لهذه المحاضرة (٤ أحرف فأكثر)"
                    hint="لن تظهر هذه المحاضرة في قوائم المدرسة أبداً — ولن تفتح إلا عبر الرابط الخاص + هذه الكلمة."
                    value={secretPassword}
                    onChange={(e) => setSecretPassword(e.target.value)}
                    startAdornment={<KeyRound className="h-5 w-5" />}
                    endAdornment={
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-muted)] cursor-pointer"
                        aria-label={showPassword ? "إخفاء" : "إظهار"}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    }
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              {uploadingState ? (
                <span className="text-sm font-semibold text-[#2563EB] dark:text-cyan-300">
                  {uploadingState}
                </span>
              ) : (
                <span className="text-xs text-[var(--text-muted)]">
                  يمكنك تعديل خصوصية المحاضرة أو حذفها في أي وقت لاحقاً.
                </span>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={submitting}
                leftIcon={<UploadCloud className="h-5 w-5" />}
              >
                {submitting ? "جاري الرفع والحفظ..." : "رفع ونشر المحاضرة"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Teacher Uploaded Lectures List */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">
          محاضراتي المسجلة ({formatArabicNumber(data.lectures.length)})
        </h2>

        {data.lectures.length === 0 ? (
          <Card className="rounded-3xl p-8 text-center">
            <p className="text-lg font-bold text-[var(--text-primary)]">
              لم ترفع أي محاضرات مسجلة بعد
            </p>
            <p className="mt-1 text-base text-[var(--text-secondary)]">
              استخدم النموذج بالأعلى لرفع أول فيديو وتحديد من يحق له مشاهدته.
            </p>
          </Card>
        ) : (
          <MotionStaggerGrid className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.lectures.map((lec) => {
              const meta = LECTURE_VISIBILITY_META[lec.visibility];
              const isCopied = copiedId === lec.id;
              return (
                <MotionStaggerCard
                  key={lec.id}
                  className="hover-lift-card flex flex-col justify-between gap-4 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 hairline-lift"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="neutral">{lec.subjectNameAr}</Badge>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold",
                          meta.badgeClass
                        )}
                      >
                        {lec.visibility === "secret" && <Lock className="h-3.5 w-3.5" />}
                        <span>{meta.shortLabelAr}</span>
                      </span>
                    </div>

                    <h3 className="mt-3 text-lg font-bold text-[var(--text-primary)]">
                      {lec.titleAr}
                    </h3>

                    {lec.descriptionAr && (
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">
                        {lec.descriptionAr}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
                      {lec.sessionTitleAr && (
                        <span className="rounded-lg bg-[var(--bg-sunken)] px-2.5 py-1">
                          الحصة: {lec.sessionTitleAr}
                        </span>
                      )}
                      {lec.fileSizeBytes && (
                        <span className="rounded-lg bg-[var(--bg-sunken)] px-2.5 py-1 tabular-nums">
                          الحجم: {formatFileSizeAr(lec.fileSizeBytes)}
                        </span>
                      )}
                      {lec.durationMinutes && (
                        <span className="rounded-lg bg-[var(--bg-sunken)] px-2.5 py-1 tabular-nums">
                          {formatArabicNumber(lec.durationMinutes)} دقيقة
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 border-t border-[var(--border-hairline)] pt-3">
                    <Button
                      variant="primary"
                      size="sm"
                      loading={loadingPlayerId === lec.id}
                      onClick={() => handlePreviewLecture(lec)}
                      leftIcon={<PlayCircle className="h-4 w-4" />}
                    >
                      تشغيل
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyShareLink(lec)}
                      leftIcon={
                        isCopied ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )
                      }
                    >
                      {lec.visibility === "secret" ? "نسخ الرابط السري" : "نسخ الرابط"}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(lec)}
                      leftIcon={<Settings2 className="h-4 w-4" />}
                    >
                      تعديل الصلاحية
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(lec)}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400"
                      leftIcon={<Trash2 className="h-4 w-4" />}
                    >
                      حذف
                    </Button>
                  </div>
                </MotionStaggerCard>
              );
            })}
          </MotionStaggerGrid>
        )}
      </section>

      {/* Video Player Preview Dialog */}
      <Dialog
        open={playingMedia !== null}
        onOpenChange={(open) => {
          if (!open) setPlayingMedia(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          {playingMedia && (
            <>
              <DialogHeader>
                <DialogTitle>{playingMedia.titleAr}</DialogTitle>
              </DialogHeader>
              <div className="mt-3">
                <LectureVideoPlayer media={playingMedia} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Visibility / Password Dialog */}
      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open && !savingEdit) setEditTarget(null);
        }}
      >
        <DialogContent>
          {editTarget && (
            <>
              <DialogHeader>
                <DialogTitle>تعديل إعدادات وصول المحاضرة</DialogTitle>
                <DialogDescription>
                  غيّر العنوان أو مستوى الصلاحية أو جدّد كلمة المرور للمحاضرة السرية.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSaveEdit} className="mt-4 flex flex-col gap-4">
                <Input
                  label="عنوان المحاضرة"
                  inputSize="md"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-[var(--text-primary)]">
                    صلاحية المشاهدة
                  </label>
                  <select
                    value={editVisibility}
                    onChange={(e) => setEditVisibility(e.target.value as LectureVisibility)}
                    className="min-h-[46px] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 text-sm font-semibold text-[var(--text-primary)]"
                  >
                    <option value="public">عامة — متاحة للجميع</option>
                    <option value="attendees_only">للحاضرين في الحصة فقط</option>
                    <option value="secret">سرية ومخفية — برابط وكلمة مرور</option>
                  </select>
                </div>

                {editVisibility === "attendees_only" && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-bold text-[var(--text-primary)]">
                      الحصة المرتبطة
                    </label>
                    <select
                      value={editSessionId}
                      onChange={(e) => setEditSessionId(e.target.value)}
                      required
                      className="min-h-[46px] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 text-sm font-semibold text-[var(--text-primary)]"
                    >
                      {data.sessions.map((sess) => (
                        <option key={sess.id} value={sess.id}>
                          {sess.subjectNameAr} — {sess.titleAr}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {editVisibility === "secret" && (
                  <Input
                    label="كلمة مرور جديدة (اختياري للإبقاء على الحالية)"
                    type="password"
                    dir="ltr"
                    minLength={4}
                    placeholder="اتركه فارغاً للإبقاء على كلمة المرور الحالية"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                  />
                )}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={savingEdit}
                    onClick={() => setEditTarget(null)}
                  >
                    إلغاء
                  </Button>
                  <Button type="submit" variant="primary" loading={savingEdit}>
                    حفظ التعديلات
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف المحاضرة نهائياً؟</DialogTitle>
            <DialogDescription>
              سيتم حذف «{deleteTarget?.titleAr}» وملف الفيديو الخاص بها بشكل دائم.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              تراجع
            </Button>
            <Button variant="danger" loading={deleting} onClick={handleConfirmDelete}>
              نعم، احذف المحاضرة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
