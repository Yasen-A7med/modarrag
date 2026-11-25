import type { BookingStatus, HallStatus, SessionStatus, SubjectType } from "@/infrastructure/supabase/database.types";

/**
 * Strict 4-step geometric border-radius ladder for Modarrag.
 * Exceeding 16px (or using 24px/32px pill toys) is disallowed across the UI.
 */
export const MODARRAG_RADII = {
  /** Inputs, badges, compact tags, filter chips (6px) */
  sm: "6px",
  /** Buttons, list rows, segmented toggles, nav links (8px) */
  md: "8px",
  /** Cards, panels, dialogs, booking columns (12px) */
  lg: "12px",
  /** Outer hero/device showcase frames only (16px max ceiling) */
  frame: "16px",
} as const;

export const MODARRAG_BRAND = {
  primary: "#1E3A8A",
  primaryHover: "#1D4ED8",
  primarySoftLight: "#EFF6FF",
  primarySoftDark: "rgba(37, 99, 235, 0.16)",
  accent: "#D97706",
  accentSoftLight: "#FFFBEB",
  accentSoftDark: "rgba(217, 119, 6, 0.16)",
  emerald: "#059669",
  emeraldLiveDot: "#22C55E",
  danger: "#DC2626",
  info: "#0284C7",
} as const;

export const MODARRAG_SURFACES = {
  light: {
    canvas: "#F8FAFC",
    surface: "#FFFFFF",
    sunken: "#F5F7FA",
    elevated: "#FFFFFF",
    hairline: "#E2E8F0",
    hairlineStrong: "#CBD5E1",
    textPrimary: "#0F172A",
    textSecondary: "#475569",
    textMuted: "#64748B",
  },
  dark: {
    canvas: "#090D16",
    surface: "#0F1623",
    sunken: "#060911",
    elevated: "#141D2E",
    hairline: "rgba(255, 255, 255, 0.09)",
    hairlineStrong: "rgba(255, 255, 255, 0.16)",
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
  hex: "#2563EB",
  badgeClass:
    "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-200",
  iconBoxClass:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300",
  activeBorderClass: "border-blue-600 ring-1 ring-blue-600/20 dark:border-blue-400 dark:ring-blue-400/25",
  shortLabelAr: "الهندسة",
};

const MED_STYLE: TrackStyleConfig = {
  code: "MED_TRACK",
  iconKey: "microscope",
  hex: "#059669",
  badgeClass:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200",
  iconBoxClass:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
  activeBorderClass:
    "border-emerald-600 ring-1 ring-emerald-600/20 dark:border-emerald-400 dark:ring-emerald-400/25",
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
    "border-amber-600 ring-1 ring-amber-600/20 dark:border-amber-400 dark:ring-amber-400/25",
  shortLabelAr: "الأعمال",
};

const ART_STYLE: TrackStyleConfig = {
  code: "ART_TRACK",
  iconKey: "book-open",
  hex: "#7C3AED",
  badgeClass:
    "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-200",
  iconBoxClass:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300",
  activeBorderClass:
    "border-violet-600 ring-1 ring-violet-600/20 dark:border-violet-400 dark:ring-violet-400/25",
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
  confirmed: "success",
  waitlisted: "warning",
  checked_in: "info",
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
