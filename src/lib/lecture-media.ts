import type { LectureVisibility } from "@/infrastructure/supabase/database.types";
import { formatArabicNumber } from "@/lib/formatters";

export const LECTURE_BUCKET_NAME = "lectures" as const;

export const MAX_LECTURE_UPLOAD_BYTES = 52_428_800; // 50 MB matching Supabase Storage config

export const ALLOWED_LECTURE_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
] as const;

export const LECTURE_VISIBILITY_META: Readonly<
  Record<
    LectureVisibility,
    {
      readonly labelAr: string;
      readonly shortLabelAr: string;
      readonly descriptionAr: string;
      readonly badgeClass: string;
    }
  >
> = {
  public: {
    labelAr: "عامة — متاحة للجميع",
    shortLabelAr: "عامة للجميع",
    descriptionAr: "يمكن لأي طالب أو زائر في صفحة المدرسة مشاهدتها مباشرة بدون شروط.",
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-200",
  },
  attendees_only: {
    labelAr: "للحاضرين في الحصة فقط",
    shortLabelAr: "للحاضرين فقط",
    descriptionAr: "تفتح تلقائياً فقط للطلاب الذين حضروا الحصة المرتبطة وتم تسجيل حضورهم.",
    badgeClass:
      "border-blue-200 bg-[#EEF5FF] text-[#1D4ED8] dark:border-blue-500/35 dark:bg-blue-500/15 dark:text-blue-200",
  },
  secret: {
    labelAr: "سرية ومخفية — برابط وكلمة مرور",
    shortLabelAr: "سرية ومخفية",
    descriptionAr: "تختفي تماماً من قوائم المدرسة ولا تفتح إلا لمن يملك الرابط الخاص وكلمة المرور.",
    badgeClass:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-200",
  },
};

export interface ResolvedLecturePlaybackSource {
  readonly kind: "video" | "iframe";
  readonly src: string;
}

/**
 * Validates and converts external video URLs (YouTube, Vimeo, Google Drive, direct HTTPS MP4/WebM)
 * into a safe player source allowed by CSP, rejecting unsafe protocols.
 */
export function resolveExternalVideoEmbed(rawUrl: string): ResolvedLecturePlaybackSource | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") {
    return null;
  }

  const host = parsed.hostname.toLowerCase();

  // YouTube (youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, youtube.com/embed/)
  if (
    host === "youtu.be" ||
    host === "www.youtu.be" ||
    host === "youtube.com" ||
    host === "www.youtube.com" ||
    host === "m.youtube.com" ||
    host === "www.youtube-nocookie.com"
  ) {
    let videoId: string | null = null;
    if (host.endsWith("youtu.be")) {
      videoId = parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (parsed.pathname === "/watch") {
      videoId = parsed.searchParams.get("v");
    } else {
      const parts = parsed.pathname.split("/").filter(Boolean);
      if ((parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") && parts[1]) {
        videoId = parts[1];
      }
    }

    if (videoId && /^[A-Za-z0-9_-]{6,20}$/.test(videoId)) {
      return {
        kind: "iframe",
        src: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`,
      };
    }
    return null;
  }

  // Vimeo (vimeo.com/123456)
  if (host === "vimeo.com" || host === "www.vimeo.com" || host === "player.vimeo.com") {
    const idPart = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
    if (/^\d{5,15}$/.test(idPart)) {
      return {
        kind: "iframe",
        src: `https://player.vimeo.com/video/${idPart}`,
      };
    }
    return null;
  }

  // Google Drive (drive.google.com/file/d/<id>/view)
  if (host === "drive.google.com") {
    const match = parsed.pathname.match(/\/file\/d\/([A-Za-z0-9_-]{10,80})/);
    if (match?.[1]) {
      return {
        kind: "iframe",
        src: `https://drive.google.com/file/d/${match[1]}/preview`,
      };
    }
    return null;
  }

  // Direct HTML5 video URLs over HTTPS
  const lowerPath = parsed.pathname.toLowerCase();
  if (
    lowerPath.endsWith(".mp4") ||
    lowerPath.endsWith(".webm") ||
    lowerPath.endsWith(".mov") ||
    lowerPath.endsWith(".m4v")
  ) {
    return {
      kind: "video",
      src: parsed.toString(),
    };
  }

  return null;
}

export function isSupportedLectureVideoMime(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  return (ALLOWED_LECTURE_VIDEO_MIME_TYPES as readonly string[]).includes(normalized);
}

export function sanitizeStorageFileExtension(fileName: string, mimeType: string): string {
  const normalizedMime = mimeType.trim().toLowerCase();
  if (normalizedMime === "video/webm") return "webm";
  if (normalizedMime === "video/quicktime") return "mov";
  if (normalizedMime === "video/x-matroska") return "mkv";
  const extMatch = fileName.trim().toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  if (extMatch?.[1] && ["mp4", "webm", "mov", "mkv"].includes(extMatch[1])) {
    return extMatch[1];
  }
  return "mp4";
}

export function formatFileSizeAr(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) {
    return "";
  }
  if (bytes < 1024 * 1024) {
    return `${formatArabicNumber(Math.max(1, Math.round(bytes / 1024)))} ك.ب`;
  }
  return `${formatArabicNumber(bytes / (1024 * 1024), { maximumFractionDigits: 1 })} م.ب`;
}
