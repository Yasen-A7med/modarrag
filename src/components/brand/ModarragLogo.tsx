import { cn } from "@/lib/utils";

export interface ModarragLogoProps {
  readonly size?: "sm" | "md" | "lg";
  readonly showWordmark?: boolean;
  readonly showSubtitle?: boolean;
  readonly className?: string;
}

const SIZE_MAP = {
  sm: { box: "h-8 w-8", title: "text-base", sub: "text-[10px]" },
  md: { box: "h-9 w-9", title: "text-lg", sub: "text-[11px]" },
  lg: { box: "h-11 w-11", title: "text-xl", sub: "text-xs" },
} as const;

/**
 * Architectural stepped-amphitheater geometric emblem for Modarrag (مُدَرَّج).
 * Zero human initials, zero gradients/blurs — crisp vector geometry.
 */
export function ModarragLogo({
  size = "md",
  showWordmark = true,
  showSubtitle = false,
  className,
}: ModarragLogoProps) {
  const dims = SIZE_MAP[size];

  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[#1E3A8A] text-white dark:bg-[#172554]",
          dims.box
        )}
        aria-hidden="true"
      >
        <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none">
          {/* Outer architectural arch */}
          <path
            d="M5.5 24.5V14.5C5.5 8.701 10.201 4 16 4C21.799 4 26.5 8.701 26.5 14.5V24.5"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          {/* Amber keystone */}
          <polygon points="16,5.5 18.5,8.5 16,11.5 13.5,8.5" fill="#F59E0B" />
          {/* Three stepped amphitheater tiers (مُدَرَّج) */}
          <path
            d="M8.5 24.5H23.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M10.5 20.5H21.5"
            stroke="currentColor"
            strokeOpacity="0.88"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12.75 16.5H19.25"
            stroke="#F59E0B"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>

      {showWordmark && (
        <span className="flex flex-col leading-tight">
          <span
            className={cn(
              "font-bold tracking-normal text-[var(--text-primary)]",
              dims.title
            )}
          >
            مُدَرَّج
          </span>
          {showSubtitle && (
            <span
              className={cn(
                "font-mono text-[var(--text-muted)] tracking-wider uppercase",
                dims.sub
              )}
              dir="ltr"
            >
              MODARRAG
            </span>
          )}
        </span>
      )}
    </span>
  );
}
