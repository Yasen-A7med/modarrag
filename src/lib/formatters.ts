import type {
  BookingStatus,
  SessionStatus,
  SubjectType,
  UserRole,
} from "@/infrastructure/supabase/database.types";

export const CAIRO_TIME_ZONE = "Africa/Cairo" as const;

export const USER_ROLE_LABELS: Readonly<
  Record<UserRole, { readonly ar: string; readonly en: string }>
> = {
  super_admin: { ar: "مشرف المنصة", en: "Platform Admin" },
  school_admin: { ar: "منسق المدرسة", en: "School Coordinator" },
  teacher: { ar: "معلم المادة", en: "Subject Teacher" },
  student: { ar: "طالب مقيد", en: "Enrolled Student" },
  gate_scanner: { ar: "مشرف البوابة", en: "Gate Scanner" },
};

export const BOOKING_STATUS_LABELS: Readonly<
  Record<BookingStatus, { readonly ar: string; readonly en: string }>
> = {
  confirmed: { ar: "مؤكد", en: "Confirmed" },
  waitlisted: { ar: "قائمة انتظار", en: "Waitlisted" },
  cancelled_by_student: { ar: "ملغي بواسطة الطالب", en: "Cancelled by Student" },
  cancelled_by_system: { ar: "ملغي بواسطة النظام", en: "Cancelled by System" },
  checked_in: { ar: "تم الحضور", en: "Checked In" },
  no_show: { ar: "لم يحضر", en: "No Show" },
};

export const SESSION_STATUS_LABELS: Readonly<
  Record<SessionStatus, { readonly ar: string; readonly en: string }>
> = {
  scheduled: { ar: "متاحة للحجز", en: "Scheduled" },
  full: { ar: "مكتملة المقاعد", en: "Full" },
  ongoing: { ar: "جارية الآن", en: "Ongoing" },
  completed: { ar: "منتهية", en: "Completed" },
  cancelled: { ar: "ملغاة", en: "Cancelled" },
};

export const SUBJECT_TYPE_LABELS: Readonly<
  Record<SubjectType, { readonly ar: string; readonly en: string }>
> = {
  common: { ar: "مادة مشتركة", en: "Common Subject" },
  track_core: { ar: "مادة تخصصية", en: "Track Core" },
  track_elective: { ar: "مادة اختيارية", en: "Track Elective" },
};

function toValidDate(input: Date | string): Date {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid date value provided to Cairo formatter");
  }
  return date;
}

/**
 * Formats a numeric value using Egyptian Arabic tabular numerals (Eastern Arabic digits
 * by default, or Latin digits when `useEasternDigits: false`).
 */
export function formatArabicNumber(
  value: number,
  options: { readonly useEasternDigits?: boolean; readonly maximumFractionDigits?: number } = {}
): string {
  const locale = options.useEasternDigits === false ? "ar-EG-u-nu-latn" : "ar-EG";
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: options.maximumFractionDigits ?? 0,
  }).format(value);
}

/** Formats a date string or Date in `Africa/Cairo` timezone. */
export function formatCairoDate(
  input: Date | string,
  options: {
    readonly locale?: "ar-EG" | "ar-EG-u-nu-latn" | "en-GB";
    readonly includeWeekday?: boolean;
  } = {}
): string {
  const date = toValidDate(input);
  const locale = options.locale ?? "ar-EG";

  return new Intl.DateTimeFormat(locale, {
    timeZone: CAIRO_TIME_ZONE,
    ...(options.includeWeekday ? { weekday: "long" } : {}),
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Formats wall-clock time in `Africa/Cairo` timezone (12h Arabic AM/PM by default). */
export function formatCairoTime(
  input: Date | string,
  options: {
    readonly locale?: "ar-EG" | "ar-EG-u-nu-latn" | "en-GB";
    readonly hour12?: boolean;
  } = {}
): string {
  const date = toValidDate(input);
  const locale = options.locale ?? "ar-EG";

  return new Intl.DateTimeFormat(locale, {
    timeZone: CAIRO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: options.hour12 ?? true,
  }).format(date);
}

/** Returns a stable `YYYY-MM-DD` day bucket key in `Africa/Cairo` timezone. */
export function formatCairoDayKey(input: Date | string): string {
  const date = toValidDate(input);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CAIRO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Formats a session time range on a single Cairo calendar day, e.g. `٠٤:٠٠ م – ٠٦:٠٠ م`. */
export function formatCairoTimeRange(
  startsAt: Date | string,
  endsAt: Date | string,
  locale: "ar-EG" | "ar-EG-u-nu-latn" | "en-GB" = "ar-EG"
): string {
  return `${formatCairoTime(startsAt, { locale })} – ${formatCairoTime(endsAt, { locale })}`;
}

/** Formats seat occupancy count cleanly for tabular display. */
export function formatSeatOccupancyAr(bookedSeats: number, maxCapacity: number): string {
  const remaining = Math.max(0, maxCapacity - bookedSeats);
  return `${formatArabicNumber(remaining)} / ${formatArabicNumber(maxCapacity)} مقعد متاح`;
}

/** Formats duration in minutes as concise Arabic text. */
export function formatDurationAr(durationMinutes: number): string {
  if (durationMinutes === 60) {
    return "ساعة واحدة";
  }
  if (durationMinutes === 120) {
    return "ساعتان";
  }
  return `${formatArabicNumber(durationMinutes)} دقيقة`;
}

export function getUserRoleLabel(role: UserRole, lang: "ar" | "en" = "ar"): string {
  return USER_ROLE_LABELS[role][lang];
}

export function getBookingStatusLabel(
  status: BookingStatus,
  lang: "ar" | "en" = "ar"
): string {
  return BOOKING_STATUS_LABELS[status][lang];
}

export function getSessionStatusLabel(
  status: SessionStatus,
  lang: "ar" | "en" = "ar"
): string {
  return SESSION_STATUS_LABELS[status][lang];
}

export function getSubjectTypeLabel(
  subjectType: SubjectType,
  lang: "ar" | "en" = "ar"
): string {
  return SUBJECT_TYPE_LABELS[subjectType][lang];
}
