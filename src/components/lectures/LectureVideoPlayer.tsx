"use client";

import * as React from "react";
import type { PlaybackMediaPayload } from "@/application/lectures/actions";

export interface LectureVideoPlayerProps {
  readonly media: PlaybackMediaPayload;
}

/**
 * Shared high-contrast video player rendering either a signed Supabase HTML5
 * video stream or a privacy-enhanced iframe embed.
 */
export function LectureVideoPlayer({ media }: LectureVideoPlayerProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#0A1F44]/15 bg-[#060D1D] shadow-lg">
      {media.kind === "video" ? (
        <video
          key={media.src}
          src={media.src}
          controls
          controlsList="nodownload"
          playsInline
          preload="metadata"
          className="aspect-video w-full bg-black object-contain"
        />
      ) : (
        <div className="relative aspect-video w-full bg-black">
          <iframe
            key={media.src}
            src={media.src}
            title={media.titleAr}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      )}
    </div>
  );
}
