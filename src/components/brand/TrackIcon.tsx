import { BookOpen, Briefcase, Cpu, Microscope } from "lucide-react";
import { getTrackStyle } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

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
