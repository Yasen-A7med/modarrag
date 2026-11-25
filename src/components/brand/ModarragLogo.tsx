import { cn } from "@/lib/utils";

export interface ModarragLogoProps {
  readonly size?: "sm" | "md" | "lg";
  readonly showWordmark?: boolean;
  readonly showSubtitle?: boolean;
  readonly className?: string;
}

const SIZE_MAP = {
  sm: { box: "h-9 w-9", title: "text-lg", sub: "text-xs" },
  md: { box: "h-10 w-10", title: "text-xl", sub: "text-xs" },
  lg: { box: "h-12 w-12", title: "text-2xl", sub: "text-sm" },
} as const;

/**
 * Clean geometric stepped-amphitheater mark for Modarrag (مُدَرَّج).
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
          "inline-flex shrink-0 items-center justify-center rounded-xl bg-[#0B63CE] text-white dark:bg-blue-600",
          dims.box
        )}
        aria-hidden="true"
      >
        <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none">
          <path
            d="M5.5 24.5V14.5C5.5 8.701 10.201 4 16 4C21.799 4 26.5 8.701 26.5 14.5V24.5"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <path
            d="M8.5 24.5H23.5"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <path
            d="M10.5 20H21.5"
            stroke="currentColor"
            strokeOpacity="0.9"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <path
            d="M13 15.5H19"
            stroke="#4ADE80"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </span>

      {showWordmark && (
        <span className="flex flex-col leading-tight">
          <span className={cn("font-bold text-[var(--text-primary)]", dims.title)}>
            مُدَرَّج
          </span>
          {showSubtitle && (
            <span className={cn("font-medium text-[var(--text-muted)]", dims.sub)}>
              السنتر المدرسي الرسمي
            </span>
          )}
        </span>
      )}
    </span>
  );
}
