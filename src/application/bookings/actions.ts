"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ok, err, type ActionResult } from "@/domain/common/result";
import { evaluateStudentSubjectEligibility } from "@/domain/academic/eligibility";
import type { SubjectCategory } from "@/domain/academic/schemas";
import { checkRateLimit } from "@/infrastructure/security/rate-limiter";
import { verifyTurnstileToken } from "@/infrastructure/security/turnstile";
import {
  createSupabaseServerClient,
  getAuthenticatedUser,
} from "@/infrastructure/supabase/server";
import type {
  BookingStatus,
  BookStudentSeatRpcResult,
  CancelStudentBookingRpcResult,
  Database,
  SessionStatus,
  SubjectType,
} from "@/infrastructure/supabase/database.types";

const SUBJECT_CATEGORY_MAP: Record<SubjectType, SubjectCategory> = {
  common: "COMMON",
  track_core: "TRACK_CORE",
  track_elective: "TRACK_ELECTIVE",
};

const schoolSlugSchema = z.string().trim().min(1).max(80);

const bookSeatInputSchema = z.object({
  sessionId: z.string().uuid("معرف الحصة غير صالح."),
  schoolSlug: z.string().trim().min(1).max(80).optional(),
  turnstileToken: z.string().trim().min(1).optional(),
});

const cancelBookingInputSchema = z.object({
  bookingId: z.string().uuid("معرف الحجز غير صالح."),
  schoolSlug: z.string().trim().min(1).max(80).optional(),
});

export interface StudentPortalEnrollment {
  readonly id: string;
  readonly gradeId: string;
  readonly trackId: string;
  readonly trackNameAr: string;
  readonly gradeNameAr: string;
  readonly selectedElectiveSubjectId: string | null;
  readonly isActive: boolean;
}

export interface StudentPortalSession {
  readonly id: string;
  readonly subjectId: string;
  readonly isEligible: boolean;
  readonly titleAr: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly maxCapacity: number;
  readonly bookedSeatsCount: number;
  readonly status: SessionStatus;
  readonly deliveryMode: "in_person" | "online";
  readonly meetingUrl: string | null;
  readonly priceEgp: number;
  readonly hallNameAr: string;
  readonly subjectNameAr: string;
  readonly teacherSpecialtyAr: string;
}

export interface StudentPortalBooking {
  readonly id: string;
  readonly sessionId: string;
  readonly status: BookingStatus;
  readonly attendanceFlag: "on_time" | "late" | "absent_deducted";
  readonly lateMinutes: number;
  readonly deductionEgp: number;
  readonly seatNumber: string | null;
  readonly waitlistPosition: number | null;
  readonly bookedAt: string;
  readonly sessionTitleAr: string;
  readonly sessionStartsAt: string;
  readonly sessionEndsAt: string;
  readonly deliveryMode: "in_person" | "online";
  readonly meetingUrl: string | null;
  readonly priceEgp: number;
  readonly hallNameAr: string;
  readonly subjectNameAr: string;
  readonly teacherSpecialtyAr: string;
}

export interface StudentPortalNotification {
  readonly id: string;
  readonly type: string;
  readonly titleAr: string;
  readonly bodyAr: string;
  readonly isRead: boolean;
  readonly createdAt: string;
}

export interface StudentPortalData {
  readonly studentName: string;
  readonly vatRatePct: number;
  readonly enrollment: StudentPortalEnrollment | null;
  readonly eligibleSubjectIds: readonly string[];
  readonly sessions: readonly StudentPortalSession[];
  readonly bookings: readonly StudentPortalBooking[];
  readonly notifications: readonly StudentPortalNotification[];
}

/**
 * Loads the student's school enrollment, eligible lecture sessions, bookings,
 * and notifications for name-based seat reservation.
 */
export async function getStudentPortalData(
  schoolSlug: string
): Promise<ActionResult<StudentPortalData>> {
  const parsedSlug = schoolSlugSchema.safeParse(schoolSlug);
  if (!parsedSlug.success) {
    return err("VALIDATION_ERROR", "رابط المدرسة غير صحيح.");
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "يرجى تسجيل الدخول بحسابك أولاً.");
  }

  const supabase = await createSupabaseServerClient();

  const [{ data: school }, { data: profile }] = await Promise.all([
    supabase
      .from("schools")
      .select("id, slug, is_active, vat_rate_pct")
      .eq("slug", parsedSlug.data.toLowerCase())
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("id, role, school_id, full_name, is_active")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (!school) {
    return err("NOT_FOUND", "المدرسة المطلوبة غير موجودة.");
  }

  if (!profile) {
    return err("NOT_FOUND", "تعذر العثور على ملف المستخدم.");
  }

  if (!profile.is_active) {
    return err("FORBIDDEN", "هذا الحساب غير مفعل حالياً.");
  }

  const isPrivilegedViewer =
    profile.role === "super_admin" ||
    ((profile.role === "school_admin" || profile.role === "teacher") &&
      profile.school_id === school.id);

  if (
    profile.role !== "student" &&
    !isPrivilegedViewer
  ) {
    return err("FORBIDDEN", "صلاحية الوصول غير متاحة لهذا الحساب.");
  }

  if (
    profile.role === "student" &&
    profile.school_id !== null &&
    profile.school_id !== school.id
  ) {
    return err("FORBIDDEN", "حسابك مسجل في مدرسة أخرى.");
  }

  const cutoffIso = new Date(Date.now() - 2 * 3_600_000).toISOString();

  const [
    { data: enrollmentRow },
    { data: subjectRows },
    { data: trackSubjectRows },
    { data: trackRows },
    { data: sessionRows, error: sessionsError },
    { data: bookingRows },
    { data: notificationRows },
  ] = await Promise.all([
    profile.role === "student"
      ? supabase
          .from("student_enrollments")
          .select(`
            id, grade_id, track_id, selected_elective_subject_id, is_active,
            academic_grades!student_enrollments_grade_id_fkey ( name_ar ),
            academic_tracks!student_enrollments_track_id_fkey ( name_ar )
          `)
          .eq("student_id", user.id)
          .eq("school_id", school.id)
          .eq("is_active", true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("subjects")
      .select("id, school_id, grade_id, code, name_ar, name_en, subject_type, is_active")
      .eq("school_id", school.id)
      .eq("is_active", true),
    supabase
      .from("track_subjects")
      .select("school_id, track_id, subject_id, is_mandatory, elective_group_code")
      .eq("school_id", school.id),
    supabase
      .from("academic_tracks")
      .select("id, school_id, grade_id, code, name_ar, name_en, is_active")
      .eq("school_id", school.id)
      .eq("is_active", true),
    supabase
      .from("sessions")
      .select(`
        id, subject_id, title_ar, starts_at, ends_at, max_capacity, booked_seats_count, status,
        delivery_mode, meeting_url, price_egp,
        halls!sessions_hall_id_fkey ( name_ar ),
        subjects!sessions_subject_id_fkey ( name_ar ),
        teacher_profiles!sessions_teacher_id_fkey ( specialty_ar )
      `)
      .eq("school_id", school.id)
      .in("status", ["scheduled", "full", "ongoing"])
      .gte("ends_at", cutoffIso)
      .order("starts_at", { ascending: true })
      .limit(200),
    profile.role === "student"
      ? supabase
          .from("bookings")
          .select(`
            id, session_id, status, attendance_flag, late_minutes, deduction_egp, seat_number, waitlist_position, booked_at,
            sessions!bookings_session_id_fkey (
              title_ar, starts_at, ends_at, delivery_mode, meeting_url, price_egp,
              halls!sessions_hall_id_fkey ( name_ar ),
              subjects!sessions_subject_id_fkey ( name_ar ),
              teacher_profiles!sessions_teacher_id_fkey ( specialty_ar )
            )
          `)
          .eq("student_id", user.id)
          .eq("school_id", school.id)
          .order("booked_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
    profile.role === "student"
      ? supabase
          .from("notifications")
          .select("id, type, title_ar, body_ar, is_read, created_at")
          .eq("recipient_id", user.id)
          .eq("school_id", school.id)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
  ]);

  if (sessionsError) {
    return err("INTERNAL_ERROR", sessionsError.message);
  }

  let enrollment: StudentPortalEnrollment | null = null;
  let eligibleSet = new Set<string>();

  if (enrollmentRow) {
    const gradeMeta = enrollmentRow.academic_grades as unknown as { name_ar: string } | null;
    const trackMeta = enrollmentRow.academic_tracks as unknown as { name_ar: string } | null;

    enrollment = {
      id: enrollmentRow.id,
      gradeId: enrollmentRow.grade_id,
      trackId: enrollmentRow.track_id,
      trackNameAr: trackMeta?.name_ar ?? "",
      gradeNameAr: gradeMeta?.name_ar ?? "",
      selectedElectiveSubjectId: enrollmentRow.selected_elective_subject_id,
      isActive: enrollmentRow.is_active,
    };

    const domainTrackRow = (trackRows ?? []).find((t) => t.id === enrollmentRow.track_id);
    const trackSubjectRules = (trackSubjectRows ?? [])
      .filter((ts) => ts.track_id === enrollmentRow.track_id)
      .map((ts) => ({
        schoolId: ts.school_id,
        gradeId: enrollmentRow.grade_id,
        trackId: ts.track_id,
        subjectId: ts.subject_id,
        isElective: !ts.is_mandatory,
        electiveGroup: ts.elective_group_code,
      }));

    const selectedElectives: Record<string, string> = enrollmentRow.selected_elective_subject_id
      ? { SECOND_LANG: enrollmentRow.selected_elective_subject_id }
      : {};

    const domainEnrollment = {
      id: enrollmentRow.id,
      schoolId: school.id,
      studentId: user.id,
      gradeId: enrollmentRow.grade_id,
      trackId: enrollmentRow.track_id,
      secondLanguageSubjectId: enrollmentRow.selected_elective_subject_id,
      selectedElectives,
      isActive: enrollmentRow.is_active,
    };

    const domainTrack = domainTrackRow
      ? {
          id: domainTrackRow.id,
          schoolId: domainTrackRow.school_id,
          gradeId: domainTrackRow.grade_id,
          code: domainTrackRow.code,
          nameAr: domainTrackRow.name_ar,
          nameEn: domainTrackRow.name_en ?? undefined,
          isActive: domainTrackRow.is_active,
        }
      : undefined;

    for (const s of subjectRows ?? []) {
      const decision = evaluateStudentSubjectEligibility({
        enrollment: domainEnrollment,
        subject: {
          id: s.id,
          schoolId: s.school_id,
          gradeId: s.grade_id,
          code: s.code,
          nameAr: s.name_ar,
          nameEn: s.name_en ?? undefined,
          category: SUBJECT_CATEGORY_MAP[s.subject_type],
          isActive: s.is_active,
        },
        trackSubjectRules,
        track: domainTrack,
      });
      if (decision.eligible) {
        eligibleSet.add(s.id);
      }
    }
  } else if (isPrivilegedViewer) {
    eligibleSet = new Set((subjectRows ?? []).map((s) => s.id));
  }

  const confirmedSessionIds = new Set(
    (bookingRows ?? [])
      .filter((b) => b.status === "confirmed" || b.status === "checked_in")
      .map((b) => b.session_id)
  );

  const sessions: StudentPortalSession[] = (sessionRows ?? []).map((row) => {
    const hall = row.halls as unknown as { name_ar: string } | null;
    const subject = row.subjects as unknown as { name_ar: string } | null;
    const teacher = row.teacher_profiles as unknown as { specialty_ar: string } | null;
    const deliveryMode = row.delivery_mode ?? "in_person";
    const canSeeMeetingUrl = isPrivilegedViewer || confirmedSessionIds.has(row.id);

    return {
      id: row.id,
      subjectId: row.subject_id,
      isEligible: eligibleSet.has(row.subject_id),
      titleAr: row.title_ar,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      maxCapacity: row.max_capacity,
      bookedSeatsCount: row.booked_seats_count,
      status: row.status,
      deliveryMode,
      meetingUrl: deliveryMode === "online" && canSeeMeetingUrl ? row.meeting_url : null,
      priceEgp: row.price_egp ?? 0,
      hallNameAr:
        deliveryMode === "online"
          ? "بث مباشر أونلاين"
          : (hall?.name_ar ?? ""),
      subjectNameAr: subject?.name_ar ?? "",
      teacherSpecialtyAr: teacher?.specialty_ar ?? "معلم المادة",
    };
  });

  const bookings: StudentPortalBooking[] = (bookingRows ?? []).map((b) => {
    const sess = b.sessions as unknown as {
      title_ar: string;
      starts_at: string;
      ends_at: string;
      delivery_mode: "in_person" | "online";
      meeting_url: string | null;
      price_egp: number;
      halls: { name_ar: string } | null;
      subjects: { name_ar: string } | null;
      teacher_profiles: { specialty_ar: string } | null;
    } | null;
    const deliveryMode = sess?.delivery_mode ?? "in_person";
    const isAdmitted = b.status === "confirmed" || b.status === "checked_in";

    return {
      id: b.id,
      sessionId: b.session_id,
      status: b.status,
      attendanceFlag: b.attendance_flag ?? "on_time",
      lateMinutes: b.late_minutes ?? 0,
      deductionEgp: b.deduction_egp ?? 0,
      seatNumber: b.seat_number,
      waitlistPosition: b.waitlist_position,
      bookedAt: b.booked_at,
      sessionTitleAr: sess?.title_ar ?? "",
      sessionStartsAt: sess?.starts_at ?? b.booked_at,
      sessionEndsAt: sess?.ends_at ?? b.booked_at,
      deliveryMode,
      meetingUrl: deliveryMode === "online" && isAdmitted ? (sess?.meeting_url ?? null) : null,
      priceEgp: sess?.price_egp ?? 0,
      hallNameAr:
        deliveryMode === "online"
          ? "بث مباشر أونلاين"
          : (sess?.halls?.name_ar ?? ""),
      subjectNameAr: sess?.subjects?.name_ar ?? "",
      teacherSpecialtyAr: sess?.teacher_profiles?.specialty_ar ?? "معلم المادة",
    };
  });

  const notifications: StudentPortalNotification[] = (notificationRows ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    titleAr: n.title_ar,
    bodyAr: n.body_ar,
    isRead: n.is_read,
    createdAt: n.created_at,
  }));

  return ok({
    studentName: profile.full_name,
    vatRatePct: school.vat_rate_pct ?? 14,
    enrollment,
    eligibleSubjectIds: Array.from(eligibleSet),
    sessions,
    bookings,
    notifications,
  });
}

/**
 * Reserves a student's seat by name using the atomic `reserve_student_seat` Postgres RPC.
 */
export async function bookStudentSeatAction(input: {
  sessionId: string;
  schoolSlug?: string;
  turnstileToken?: string;
}): Promise<
  ActionResult<{
    readonly status: "confirmed" | "waitlisted";
    readonly bookingId: string;
    readonly seatNumber: string | null;
    readonly waitlistPosition: number | null;
  }>
> {
  const parsed = bookSeatInputSchema.safeParse(input);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "بيانات الحجز غير صالحة.");
  }

  const turnstile = await verifyTurnstileToken(parsed.data.turnstileToken);
  if (!turnstile.ok) {
    return turnstile;
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "يرجى تسجيل الدخول لحجز مقعد.");
  }

  const rl = await checkRateLimit(`book-seat:${user.id}`, {
    limit: 20,
    windowMs: 60_000,
    prefix: "modarrag:book",
  });
  if (!rl.allowed) {
    return err("RATE_LIMITED", "محاولات حجز متكررة بسرعة كبيرة. يرجى الانتظار قليلاً.");
  }

  const supabase = await createSupabaseServerClient();
  type ReserveRpc = Database["public"]["Functions"]["reserve_student_seat"];
  const args: ReserveRpc["Args"] = {
    p_session_id: parsed.data.sessionId,
  };

  const { data: rpcRaw, error: rpcError } = await supabase.rpc("reserve_student_seat", args);
  if (rpcError) {
    return err("INTERNAL_ERROR", rpcError.message);
  }

  const rpcResult = rpcRaw as unknown as BookStudentSeatRpcResult;
  if (!rpcResult || !rpcResult.ok) {
    const failResult = rpcResult as Extract<BookStudentSeatRpcResult, { ok: false }>;
    const codeMap: Record<string, Parameters<typeof err>[0]> = {
      unauthenticated: "UNAUTHORIZED",
      profile_inactive: "FORBIDDEN",
      student_role_required: "FORBIDDEN",
      onboarding_incomplete: "FORBIDDEN",
      session_not_found: "NOT_FOUND",
      cross_tenant_forbidden: "FORBIDDEN",
      session_not_bookable: "CONFLICT",
      enrollment_missing: "FORBIDDEN",
      ineligible_subject: "ELIGIBILITY_DENIED",
      already_booked: "CONFLICT",
      student_time_overlap: "TIME_OVERLAP",
    };

    return err(
      codeMap[failResult?.code ?? ""] ?? "INTERNAL_ERROR",
      failResult?.message_ar ?? "تعذر إتمام حجز المقعد."
    );
  }

  if (parsed.data.schoolSlug) {
    revalidatePath(`/s/${parsed.data.schoolSlug}/student`);
    revalidatePath(`/s/${parsed.data.schoolSlug}/teacher`);
    revalidatePath(`/s/${parsed.data.schoolSlug}/admin`);
  }

  return ok({
    status: rpcResult.status,
    bookingId: rpcResult.booking_id,
    seatNumber: rpcResult.seat_number,
    waitlistPosition: rpcResult.waitlist_position,
  });
}

/**
 * Cancels a student's reservation and triggers automatic waitlist promotion via RPC.
 */
export async function cancelStudentBookingAction(input: {
  bookingId: string;
  schoolSlug?: string;
}): Promise<
  ActionResult<{
    readonly cancelledBookingId: string;
    readonly promotedBookingId: string | null;
  }>
> {
  const parsed = cancelBookingInputSchema.safeParse(input);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "معرف الحجز غير صالح.");
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "يرجى تسجيل الدخول لإلغاء الحجز.");
  }

  const rl = await checkRateLimit(`cancel-booking:${user.id}`, {
    limit: 20,
    windowMs: 60_000,
    prefix: "modarrag:cancel",
  });
  if (!rl.allowed) {
    return err("RATE_LIMITED", "تم تجاوز الحد المسموح لمحاولات الإلغاء مؤقتاً.");
  }

  const supabase = await createSupabaseServerClient();
  type CancelRpc = Database["public"]["Functions"]["cancel_student_booking"];
  const args: CancelRpc["Args"] = {
    p_booking_id: parsed.data.bookingId,
  };

  const { data: rpcRaw, error: rpcError } = await supabase.rpc("cancel_student_booking", args);
  if (rpcError) {
    return err("INTERNAL_ERROR", rpcError.message);
  }

  const rpcResult = rpcRaw as unknown as CancelStudentBookingRpcResult;
  if (!rpcResult || !rpcResult.ok) {
    const failResult = rpcResult as Extract<CancelStudentBookingRpcResult, { ok: false }>;
    const codeMap: Record<string, Parameters<typeof err>[0]> = {
      unauthenticated: "UNAUTHORIZED",
      booking_not_found: "NOT_FOUND",
      forbidden: "FORBIDDEN",
      cannot_cancel_status: "CONFLICT",
    };

    return err(
      codeMap[failResult?.code ?? ""] ?? "INTERNAL_ERROR",
      failResult?.message_ar ?? "تعذر إلغاء الحجز."
    );
  }

  if (parsed.data.schoolSlug) {
    revalidatePath(`/s/${parsed.data.schoolSlug}/student`);
    revalidatePath(`/s/${parsed.data.schoolSlug}/teacher`);
    revalidatePath(`/s/${parsed.data.schoolSlug}/admin`);
  }

  return ok({
    cancelledBookingId: rpcResult.cancelled_booking_id,
    promotedBookingId: rpcResult.promoted_booking_id,
  });
}

/**
 * Marks a single student notification as read under owner-scoped RLS.
 */
export async function markNotificationReadAction(
  notificationId: string
): Promise<ActionResult<{ readonly read: true }>> {
  const parsed = z.string().uuid().safeParse(notificationId);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", "معرف الإشعار غير صالح.");
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "يرجى تسجيل الدخول أولاً.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", parsed.data)
    .eq("recipient_id", user.id);

  if (error) {
    return err("INTERNAL_ERROR", error.message);
  }

  return ok({ read: true });
}
