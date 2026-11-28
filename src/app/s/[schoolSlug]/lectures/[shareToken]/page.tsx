import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getLecturePlaybackAction,
  getSecretLecturePreviewAction,
  unlockSecretLectureAction,
  type PlaybackMediaPayload,
} from "@/application/lectures/actions";
import { SecretLectureViewerClient } from "@/components/lectures/SecretLectureViewerClient";

export const metadata: Metadata = {
  title: "محاضرة مسجلة",
};

export const dynamic = "force-dynamic";

export interface SecretLecturePageProps {
  readonly params: Promise<{
    readonly schoolSlug: string;
    readonly shareToken: string;
  }>;
}

export default async function SecretLecturePage({
  params,
}: SecretLecturePageProps) {
  const { schoolSlug, shareToken } = await params;
  const previewRes = await getSecretLecturePreviewAction(schoolSlug, shareToken);

  if (!previewRes.ok) {
    notFound();
  }

  let initialPlayback: PlaybackMediaPayload | null = null;
  let initialBlockReason: string | null = null;

  if (previewRes.data.visibility === "secret") {
    if (previewRes.data.alreadyUnlocked) {
      const unlocked = await unlockSecretLectureAction({
        schoolSlug,
        shareToken,
        password: "__lease_verified__",
      });
      if (unlocked.ok) {
        initialPlayback = unlocked.data;
      }
    }
  } else {
    const playbackRes = await getLecturePlaybackAction({
      schoolSlug,
      lectureId: previewRes.data.lectureId,
    });
    if (playbackRes.ok) {
      initialPlayback = playbackRes.data;
    } else {
      initialBlockReason = playbackRes.error.message;
    }
  }

  return (
    <SecretLectureViewerClient
      schoolSlug={schoolSlug}
      shareToken={shareToken}
      preview={previewRes.data}
      initialPlayback={initialPlayback}
      initialBlockReason={initialBlockReason}
    />
  );
}
