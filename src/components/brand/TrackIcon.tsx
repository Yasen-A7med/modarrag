import Image from "next/image";
import { BookOpen, Briefcase, Cpu, Microscope } from "lucide-react";
import { getTrackStyle } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

const TRACK_ARTWORK_MAP = {
  cpu: {
    src: "/images/track-engineering.webp",
    alt: "مجسم ثلاثي الأبعاد لمسار الهندسة",
  },
  microscope: {
    src: "/images/track-medicine.webp",
    alt: "مجسم ثلاثي الأبعاد لمسار طب وعلوم الحياة",
  },
  briefcase: {
    src: "/images/track-business.webp",
    alt: "مجسم ثلاثي الأبعاد لمسار الأعمال",
  },
  "book-open": {
    src: "/images/track-arts.webp",
    alt: "مجسم ثلاثي الأبعاد لمسار الآداب والفنون",
  },
} as const;

export function getTrackArtwork(codeOrIcon?: string | null): {
  readonly src: string;
  readonly alt: string;
} {
  const style = getTrackStyle(codeOrIcon);
  return TRACK_ARTWORK_MAP[style.iconKey];
}

export interface TrackArtworkProps {
  readonly trackCode?: string | null;
  readonly iconKey?: string | null;
  readonly size?: "sm" | "md" | "lg";
  readonly className?: string;
}

const ART_SIZES = {
  sm: { box: "h-12 w-12", px: 48 },
  md: { box: "h-16 w-16", px: 64 },
  lg: { box: "h-20 w-20", px: 80 },
} as const;

/**
 * Tactile 3D frosted acrylic artwork tile mapped to each Baccalaureate track.
 */
export function TrackArtwork({
  trackCode,
  iconKey,
  size = "md",
  className,
}: TrackArtworkProps) {
  const art = getTrackArtwork(trackCode ?? iconKey);
  const dims = ART_SIZES[size];

  return (
    <div
      className={cn(
        "art-pedestal shrink-0 overflow-hidden rounded-2xl p-1",
        dims.box,
        className
      )}
    >
      <Image
        src={art.src}
        alt={art.alt}
        width={dims.px}
        height={dims.px}
        loading="eager"
        className="h-full w-full rounded-xl object-cover transition-transform duration-300 ease-out group-hover:scale-105"
      />
    </div>
  );
}

export interface TrackIconProps {
  readonly iconKey?: string | null;
  readonly trackCode?: string | null;
  readonly size?: "sm" | "md" | "lg";
  readonly className?: string;
}

const SIZE_CLASSES = {
  sm: { box: "h-8 w-8", icon: "h-4 w-4" },
  md: { box: "h-10 w-10", icon: "h-5 w-5" },
  lg: { box: "h-12 w-12", icon: "h-6 w-6" },
} as const;

/**
 * Crisp 2px vector icon badge mapped to Egyptian Baccalaureate specialized tracks.
 */
export function TrackIcon({
  iconKey,
  trackCode,
  size = "md",
  className,
}: TrackIconProps) {
  const style = getTrackStyle(trackCode ?? iconKey);
  const dims = SIZE_CLASSES[size];

  const IconComponent = (() => {
    switch (style.iconKey) {
      case "microscope":
        return Microscope;
      case "briefcase":
        return Briefcase;
      case "book-open":
        return BookOpen;
      case "cpu":
      default:
        return Cpu;
    }
  })();

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg border",
        style.iconBoxClass,
        dims.box,
        className
      )}
      aria-hidden="true"
    >
      <IconComponent className={dims.icon} strokeWidth={1.85} />
    </span>
  );
}
