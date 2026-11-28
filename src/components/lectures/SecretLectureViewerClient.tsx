"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
  Unlock,
  Video,
} from "lucide-react";
import {
  unlockSecretLectureAction,
  type PlaybackMediaPayload,
  type SecretLecturePreviewData,
} from "@/application/lectures/actions";
import { LectureVideoPlayer } from "@/components/lectures/LectureVideoPlayer";
import { MotionReveal } from "@/components/motion/MotionPrimitives";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatArabicNumber, formatCairoDate } from "@/lib/formatters";
import { formatFileSizeAr } from "@/lib/lecture-media";

export interface SecretLectureViewerClientProps {
  readonly schoolSlug: string;
  readonly shareToken: string;
  readonly preview: SecretLecturePreviewData;
  readonly initialPlayback: PlaybackMediaPayload | null;
  readonly initialBlockReason?: string | null;
}

/**
 * Slide 10 Blueprint: Split Secret Lecture Security Gate.
 * Side Navy lecture metadata preview (zero fabricated personal names) +
 * frosted glass password unlock gate leading cleanly to the cinema video player.
 */
export function SecretLectureViewerClient({
  schoolSlug,
  shareToken,
  preview,
  initialPlayback,
  initialBlockReason,
}: SecretLectureViewerClientProps) {
  const { toast } = useToast();
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [unlocking, setUnlocking] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [requiresAuthHint, setRequiresAuthHint] = React.useState(false);
  const [playback, setPlayback] = React.useState<PlaybackMediaPayload | null>(
    initialPlayback
  );

  const handleUnlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg(null);
    setRequiresAuthHint(false);
    setUnlocking(true);

    try {
      const res = await unlockSecretLectureAction({
        schoolSlug,
        shareToken,
        password,
      });

      if (!res.ok) {
        setErrorMsg(res.error.message);
        if (
          res.error.code === "UNAUTHORIZED" ||
          res.error.details?.reason === "AUTH_REQUIRED_FOR_PRIVATE_STREAM"
        ) {
          setRequiresAuthHint(true);
        }
        toast({
          title: "تعذر فتح المحاضرة",
          description: res.error.message,
          variant: "error",
        });
        return;
      }

      toast({ title: "تم التحقق — جاري التشغيل ✓", variant: "success" });
      setPlayback(res.data);
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <MotionReveal className="mx-auto w-full max-w-4xl">
      <div className="grid grid-cols-1 overflow-hidden rounded-[2rem] border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-[0_24px_60px_-22px_rgba(10,31,68,0.2)] lg:grid-cols-12">
        {/* Right Column (RTL): Deep Navy Preview Card */}
        <div className="flex flex-col justify-between gap-6 bg-[#0A1F44] p-6 sm:p-8 text-white lg:col-span-5">
          <div>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-300 ring-1 ring-cyan-400/30">
              {playback ? <Unlock className="h-6 w-6" /> : <Video className="h-6 w-6" />}
            </span>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge
                variant="mono"
                className="border-white/20 bg-white/10 text-cyan-200"
              >
                {preview.subjectNameAr}
              </Badge>
              <Badge
                variant="warning"
                className="border-amber-400/35 bg-amber-400/15 text-amber-200"
              >
                {playback ? "مفتوحة الآن" : "بوابة سرية"}
              </Badge>
            </div>

            <h1 className="mt-3 text-xl font-extrabold leading-snug text-white sm:text-2xl">
              {preview.titleAr}
            </h1>

            {preview.descriptionAr && (
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                {preview.descriptionAr}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-white/12 bg-white/[0.06] p-4 text-xs text-slate-300">
            <p className="font-bold text-white">{preview.schoolNameAr}</p>
            <p>
              {preview.specialtyAr} · كود{" "}
              <span className="font-mono text-cyan-300" dir="ltr">
                {preview.teacherCode}
              </span>
            </p>
            <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-slate-400 tabular-nums">
              <span>{formatCairoDate(preview.createdAt)}</span>
              {preview.durationMinutes && (
                <span>· {formatArabicNumber(preview.durationMinutes)} دقيقة</span>
              )}
              {preview.fileSizeBytes && (
                <span>· {formatFileSizeAr(preview.fileSizeBytes)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Left Column: Unlock Gate or Secure Stream Player */}
        <div className="flex flex-col justify-center p-6 sm:p-8 lg:col-span-7">
          {playback ? (
            <div className="flex flex-col gap-4">
              <LectureVideoPlayer media={playback} />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="h-4 w-4" />
                  رابط تشغيل آمن ومشفر خاص بجلستك
                </span>
                <Link
                  href={`/s/${schoolSlug}/lectures`}
                  className="font-bold text-[#2563EB] hover:underline dark:text-cyan-300"
                >
                  تصفح المحاضرات العامة
                </Link>
              </div>
            </div>
          ) : preview.visibility !== "secret" ? (
            <div className="flex flex-col gap-4 rounded-2xl border border-amber-300 bg-amber-50/90 p-5 dark:border-amber-500/40 dark:bg-amber-500/10">
              <div className="flex items-start gap-2.5 text-sm font-semibold text-amber-900 dark:text-amber-200">
                <Lock className="mt-0.5 h-5 w-5 shrink-0" />
                <span>
                  {initialBlockReason ||
                    "هذه المحاضرة متاحة فقط للطلاب الذين حضروا الحصة وسُجّل حضورهم."}
                </span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <Link
                  href="/login"
                  className={buttonVariants({ variant: "primary", size: "md" })}
                >
                  تسجيل الدخول للتحقق
                </Link>
                <Link
                  href={`/s/${schoolSlug}/lectures`}
                  className={buttonVariants({ variant: "outline", size: "md" })}
                >
                  مكتبة المحاضرات
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleUnlock} className="flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-[var(--text-primary)]">
                  أدخل كلمة مرور المحاضرة
                </h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  اكتب كلمة المرور المرسلة لك من المعلم لفتح الفيديو
                </p>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="flex flex-col gap-2 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                  {requiresAuthHint && (
                    <Link
                      href="/login"
                      className={buttonVariants({
                        variant: "primary",
                        size: "sm",
                        className: "self-start",
                      })}
                    >
                      سجّل دخولك أولاً
                    </Link>
                  )}
                </div>
              )}

              <Input
                label="كلمة المرور"
                type={showPassword ? "text" : "password"}
                inputSize="lg"
                required
                dir="ltr"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                startAdornment={<KeyRound className="h-5 w-5" />}
                endAdornment={
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                    aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                }
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={unlocking}
                leftIcon={<Unlock className="h-5 w-5" />}
              >
                فتح المحاضرة
              </Button>
            </form>
          )}
        </div>
      </div>
    </MotionReveal>
  );
}
