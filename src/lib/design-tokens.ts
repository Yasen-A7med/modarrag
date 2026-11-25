import type { BookingStatus, HallStatus, SessionStatus, SubjectType } from "@/infrastructure/supabase/database.types";

/**
 * Clean 4-step geometric border-radius ladder for Modarrag.
 */
export const MODARRAG_RADII = {
  sm: "8px",
  md: "12px",
  lg: "16px",
  frame: "16px",
} as const;

export const MODARRAG_BRAND = {
  primary: "#0B63CE",
  primaryHover: "#0950A8",
  primarySoftLight: "#EEF5FF",
  primarySoftDark: "rgba(37, 99, 235, 0.16)",
  emerald: "#16A34A",
  emeraldHover: "#15803D",
  accent: "#D97706",
  danger: "#DC2626",
  info: "#0284C7",
} as const;

export const MODARRAG_SURFACES = {
  light: {
    hero: "#F4F8FF",
    canvas: "#F9FBFD",
    surface: "#FFFFFF",
    sunken: "#F1F5FA",
    elevated: "#FFFFFF",
    hairline: "rgba(15, 23, 42, 0.10)",
    hairlineStrong: "rgba(15, 23, 42, 0.18)",
    textPrimary: "#111827",
    textSecondary: "#4B5563",
    textMuted: "#6B7280",
  },
  dark: {
    hero: "#111724",
    canvas: "#0B0E14",
    surface: "#121722",
    sunken: "#080B10",
    elevated: "#1A2130",
    hairline: "rgba(255, 255, 255, 0.10)",
    hairlineStrong: "rgba(255, 255, 255, 0.20)",
    textPrimary: "#F8FAFC",
    textSecondary: "#CBD5E1",
    textMuted: "#94A3B8",
  },
} as const;

export type TrackKey =
  | "ENG_TRACK"
  | "MED_TRACK"
  | "BUS_TRACK"
  | "ART_TRACK"
  | "ENGINEERING"
  | "MEDICINE_LIFE"
  | "BUSINESS"
  | "ARTS_HUMANITIES";

export interface TrackStyleConfig {
  readonly code: "ENG_TRACK" | "MED_TRACK" | "BUS_TRACK" | "ART_TRACK";
  readonly iconKey: "cpu" | "microscope" | "briefcase" | "book-open";
  readonly hex: string;
  readonly badgeClass: string;
  readonly iconBoxClass: string;
  readonly activeBorderClass: string;
  readonly shortLabelAr: string;
}

const ENG_STYLE: TrackStyleConfig = {
  code: "ENG_TRACK",
  iconKey: "cpu",
  hex: "#0B63CE",
  badgeClass:
    "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-200",
  iconBoxClass:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300",
  activeBorderClass:
    "border-[#0B63CE] ring-2 ring-[#0B63CE]/15 dark:border-blue-400 dark:ring-blue-400/25",
  shortLabelAr: "الهندسة",
};

const MED_STYLE: TrackStyleConfig = {
  code: "MED_TRACK",
  iconKey: "microscope",
  hex: "#16A34A",
  badgeClass:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200",
  iconBoxClass:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
  activeBorderClass:
    "border-emerald-600 ring-2 ring-emerald-600/15 dark:border-emerald-400 dark:ring-emerald-400/25",
  shortLabelAr: "طب وعلوم الحياة",
};

const BUS_STYLE: TrackStyleConfig = {
  code: "BUS_TRACK",
  iconKey: "briefcase",
  hex: "#D97706",
  badgeClass:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200",
  iconBoxClass:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
  activeBorderClass:
    "border-amber-600 ring-2 ring-amber-600/15 dark:border-amber-400 dark:ring-amber-400/25",
  shortLabelAr: "الأعمال",
};

const ART_STYLE: TrackStyleConfig = {
  code: "ART_TRACK",
  iconKey: "book-open",
  hex: "#0284C7",
  badgeClass:
    "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-200",
  iconBoxClass:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300",
  activeBorderClass:
    "border-sky-600 ring-2 ring-sky-600/15 dark:border-sky-400 dark:ring-sky-400/25",
  shortLabelAr: "الآداب والفنون",
};

export const TRACK_STYLE_MAP: Readonly<Record<TrackKey, TrackStyleConfig>> = {
  ENG_TRACK: ENG_STYLE,
  ENGINEERING: ENG_STYLE,
  MED_TRACK: MED_STYLE,
  MEDICINE_LIFE: MED_STYLE,
  BUS_TRACK: BUS_STYLE,
  BUSINESS: BUS_STYLE,
  ART_TRACK: ART_STYLE,
  ARTS_HUMANITIES: ART_STYLE,
};

export function getTrackStyle(codeOrIcon?: string | null): TrackStyleConfig {
  if (!codeOrIcon) {
    return ENG_STYLE;
  }
  const normalized = codeOrIcon.trim().toUpperCase();
  if (normalized in TRACK_STYLE_MAP) {
    return TRACK_STYLE_MAP[normalized as TrackKey];
  }
  switch (codeOrIcon.trim().toLowerCase()) {
    case "microscope":
      return MED_STYLE;
    case "briefcase":
      return BUS_STYLE;
    case "book-open":
      return ART_STYLE;
    default:
      return ENG_STYLE;
  }
}

export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "mono";

export const BOOKING_STATUS_TONES: Readonly<Record<BookingStatus, BadgeTone>> = {
  confirmed: "primary",
  waitlisted: "warning",
  checked_in: "success",
  cancelled_by_student: "neutral",
  cancelled_by_system: "danger",
  no_show: "danger",
};

export const SESSION_STATUS_TONES: Readonly<Record<SessionStatus, BadgeTone>> = {
  scheduled: "success",
  full: "warning",
  ongoing: "info",
  completed: "neutral",
  cancelled: "danger",
};

export const HALL_STATUS_TONES: Readonly<Record<HallStatus, BadgeTone>> = {
  active: "success",
  maintenance: "warning",
  archived: "neutral",
};

export const SUBJECT_TYPE_TONES: Readonly<Record<SubjectType, BadgeTone>> = {
  common: "primary",
  track_core: "info",
  track_elective: "warning",
};

export const MOTION_SPRINGS = {
  snappy: { type: "spring", stiffness: 420, damping: 32, mass: 0.8 },
  drawer: { type: "spring", stiffness: 360, damping: 34, mass: 0.9 },
  subtle: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
} as const;
