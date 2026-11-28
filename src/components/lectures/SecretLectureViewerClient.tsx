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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
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
 * Clean access gate & cinema player for dedicated share links
 * (/s/[schoolSlug]/lectures/[shareToken]), supporting password-protected secret lectures
 * as well as attendance-gated shared links.
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

      toast({
        title: "تم التحقق — جاري تشغيل المحاضرة",
        variant: "success",
      });
      setPlayback(res.data);
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <MotionReveal className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Card className="overflow-hidden rounded-3xl border-t-4 border-t-[#0A1F44] dark:border-t-cyan-400">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant="neutral">{preview.subjectNameAr}</Badge>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
              {playback ? (
                <>
                  <Unlock className="h-3.5 w-3.5" />
                  <span>تم فتح المحاضرة السرية</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  <span>محاضرة خاصة محمية بكلمة مرور</span>
                </>
              )}
            </span>
          </div>

          <CardTitle className="mt-3 text-2xl">{preview.titleAr}</CardTitle>

          {preview.descriptionAr && (
            <p className="mt-1 text-base text-[var(--text-secondary)]">
              {preview.descriptionAr}
            </p>
          )}

          <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
            <span>{preview.schoolNameAr}</span>
            <span>· {preview.teacherCode}</span>
            <span>· {formatCairoDate(preview.createdAt)}</span>
            {preview.durationMinutes && (
              <span className="tabular-nums">
                · {formatArabicNumber(preview.durationMinutes)} دقيقة
              </span>
            )}
            {preview.fileSizeBytes && (
              <span className="tabular-nums">
                · {formatFileSizeAr(preview.fileSizeBytes)}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {playback ? (
            <div className="flex flex-col gap-4">
              <LectureVideoPlayer media={playback} />
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-semibold">
                  <ShieldCheck className="h-4 w-4" />
                  رابط تشغيل آمن ومشفر خاص بهذه الجلسة
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
                  تسجيل الدخول للتحقق من الحضور
                </Link>
                <Link
                  href={`/s/${schoolSlug}/lectures`}
                  className={buttonVariants({ variant: "outline", size: "md" })}
                >
                  العودة لمكتبة المحاضرات
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleUnlock} className="flex flex-col gap-4 pt-2">
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
                      تسجيل الدخول الآن
                    </Link>
                  )}
                </div>
              )}

              <Input
                label="أدخل كلمة المرور لفتح المحاضرة"
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
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-muted)] cursor-pointer"
                    aria-label={showPassword ? "إخفاء" : "إظهار"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
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
                {unlocking ? "جاري التحقق..." : "فتح وتشغيل المحاضرة"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </MotionReveal>
  );
}
