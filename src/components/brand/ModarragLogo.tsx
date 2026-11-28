import Image from "next/image";
import { cn } from "@/lib/utils";

export interface ModarragLogoProps {
  readonly size?: "sm" | "md" | "lg";
  readonly showWordmark?: boolean;
  readonly showSubtitle?: boolean;
  readonly className?: string;
}

const SIZE_MAP = {
  sm: { box: "h-10 w-10", imgPx: 40, title: "text-lg", sub: "text-xs" },
  md: { box: "h-11 w-11", imgPx: 44, title: "text-xl", sub: "text-xs" },
  lg: { box: "h-14 w-14", imgPx: 56, title: "text-2xl", sub: "text-sm" },
} as const;

/**
 * Official Modarrag (مُدَرَّج) emblem mark and Arabic+Latin lockup aligned with brand guidelines.
 */
export function ModarragLogo({
  size = "md",
  showWordmark = true,
  showSubtitle = false,
  className,
}: ModarragLogoProps) {
  const dims = SIZE_MAP[size];

  return (
    <span className={cn("inline-flex items-center gap-3 select-none", className)}>
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 shadow-sm ring-1 ring-[#0A1F44]/10 dark:bg-white/95 dark:ring-white/25",
          dims.box
        )}
        aria-hidden="true"
      >
        <Image
          src="/images/modarrag-mark.webp"
          alt="شعار مُدَرَّج"
          width={dims.imgPx}
          height={dims.imgPx}
          priority
          className="h-full w-full object-contain"
        />
      </span>

      {showWordmark && (
        <span className="flex flex-col leading-tight">
          <span
            className={cn(
              "font-bold text-[#0A1F44] dark:text-white",
              dims.title
            )}
          >
            مُدَرَّج
          </span>
          {showSubtitle && (
            <span className={cn("font-semibold text-[#2563EB] dark:text-cyan-300", dims.sub)}>
              السنتر المدرسي الرسمي
            </span>
          )}
        </span>
      )}
    </span>
  );
}
