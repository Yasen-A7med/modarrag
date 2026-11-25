"use server";

import { z } from "zod";
import crypto from "node:crypto";
import { createSupabaseServerClient, getAuthenticatedUser } from "@/infrastructure/supabase/server";
import { signQrToken } from "@/infrastructure/security/hmac-signer";
import { checkRateLimit } from "@/infrastructure/security/rate-limiter";
import { verifyTurnstileToken } from "@/infrastructure/security/turnstile";
import { evaluateStudentSubjectEligibility } from "@/domain/academic/eligibility";
import {
  ELECTIVE_GROUPS,
  type AcademicTrack,
  type StudentEnrollment,
  type Subject,
  type SubjectCategory,
  type TrackSubjectRule,
} from "@/domain/academic/schemas";
import { ok, err, type ActionResult } from "@/domain/common/result";
import type {
  Database,
  BookStudentSeatRpcResult,
  CancelStudentBookingRpcResult,
} from "@/infrastructure/supabase/database.types";

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const bookSeatSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
  schoolSlug: z.string().min(1),
  turnstileToken: z.string().optional(),
});

const cancelBookingSchema = z.object({
  bookingId: z.string().uuid("Invalid booking ID"),
  schoolSlug: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveSchoolIdFromSlug(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  slug: string
): Promise<string | null> {
  const { data } = await supabase
    .from("schools")
    .select("id")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();
  return data?.id ?? null;
}

function formatReferenceCode(bookingId: string): string {
  const shortId = bookingId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `MDRG-2026-${shortId}`;
}

// ---------------------------------------------------------------------------
// getStudentPortalData
// ---------------------------------------------------------------------------

export interface StudentPortalData {
  readonly enrollment: {
    readonly id: string;
    readonly gradeId: string;
    readonly trackId: string;
    readonly trackNameAr: string;
    readonly gradeNameAr: string;
    readonly selectedElectiveSubjectId: string | null;
    readonly isActive: boolean;
  } | null;
  readonly eligibleSubjectIds: readonly string[];
  readonly sessions: readonly {
    readonly id: string;
    readonly subjectId: string;
    readonly isEligible: boolean;
    readonly titleAr: string;
    readonly startsAt: string;
    readonly endsAt: string;
    readonly bufferMinutes: number;
    readonly maxCapacity: number;
    readonly bookedSeatsCount: number;
    readonly status: string;
    readonly hallNameAr: string;
    readonly hallCode: string;
    readonly subjectNameAr: string;
    readonly subjectCode: string;
    readonly teacherCode: string;
  }[];
  readonly bookings: readonly {
    readonly id: string;
    readonly sessionId: string;
    readonly status: string;
    readonly seatNumber: string | null;
    readonly waitlistPosition: number | null;
    readonly qrToken: string | null;
    readonly referenceCode: string;
    readonly bookedAt: string;
    readonly sessionTitleAr: string;
    readonly sessionStartsAt: string;
  }[];
  readonly notifications: readonly {
    readonly id: string;
    readonly type: string;
    readonly titleAr: string;
    readonly bodyAr: string;
    readonly isRead: boolean;
    readonly createdAt: string;
  }[];
}

function mapSubjectCategory(dbType: string): SubjectCategory {
  if (dbType === "common") return "COMMON";
  if (dbType === "track_core") return "TRACK_CORE";
  return "TRACK_ELECTIVE";
}

export async function getStudentPortalData(
  schoolSlug: string
): Promise<ActionResult<StudentPortalData>> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "Authentication required");
  }

  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolIdFromSlug(supabase, schoolSlug);
  if (!schoolId) {
    return err("NOT_FOUND", "School not found");
  }

  // Fetch enrollment with track and grade details
  const { data: enrollmentRow } = await supabase
    .from("student_enrollments")
    .select(`
      id, grade_id, track_id, selected_elective_subject_id, is_active,
      academic_tracks!student_enrollments_track_id_fkey ( id, school_id, grade_id, code, name_ar, name_en, is_active ),
      academic_grades!student_enrollments_grade_id_fkey ( name_ar )
    `)
    .eq("student_id", user.id)
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .maybeSingle();

  let enrollment: StudentPortalData["enrollment"] = null;
  const eligibleSubjectIds: string[] = [];

  if (enrollmentRow) {
    const trackData = enrollmentRow.academic_tracks as unknown as {
      id: string;
      school_id: string;
      grade_id: string;
      code: string;
      name_ar: string;
      name_en: string | null;
      is_active: boolean;
    } | null;
    const gradeData = enrollmentRow.academic_grades as unknown as { name_ar: string } | null;

    enrollment = {
      id: enrollmentRow.id,
      gradeId: enrollmentRow.grade_id,
      trackId: enrollmentRow.track_id,
      trackNameAr: trackData?.name_ar ?? "",
      gradeNameAr: gradeData?.name_ar ?? "",
      selectedElectiveSubjectId: enrollmentRow.selected_elective_subject_id,
      isActive: enrollmentRow.is_active,
    };

    // Fetch grade subjects and track subject rules, then evaluate via pure domain policy
    const [{ data: gradeSubjects }, { data: trackSubjectRows }] = await Promise.all([
      supabase
        .from("subjects")
        .select("id, school_id, grade_id, code, name_ar, name_en, subject_type, elective_group_code, is_active")
        .eq("school_id", schoolId)
        .eq("grade_id", enrollmentRow.grade_id)
        .eq("is_active", true),
      supabase
        .from("track_subjects")
        .select("track_id, subject_id, is_mandatory, elective_group_code")
        .eq("track_id", enrollmentRow.track_id)
        .eq("school_id", schoolId),
    ]);

    const domainEnrollment: StudentEnrollment = {
      id: enrollmentRow.id,
      schoolId,
      studentId: user.id,
      gradeId: enrollmentRow.grade_id,
      trackId: enrollmentRow.track_id,
      secondLanguageSubjectId: enrollmentRow.selected_elective_subject_id,
      selectedElectives: enrollmentRow.selected_elective_subject_id
        ? { [ELECTIVE_GROUPS.SECOND_LANG]: enrollmentRow.selected_elective_subject_id }
        : {},
      isActive: enrollmentRow.is_active,
    };

    const domainTrack: AcademicTrack | undefined = trackData
      ? {
          id: trackData.id,
          schoolId: trackData.school_id,
          gradeId: trackData.grade_id,
          code: trackData.code,
          nameAr: trackData.name_ar,
          nameEn: trackData.name_en ?? undefined,
          isActive: trackData.is_active,
        }
      : undefined;

    const subjectMap = new Map<string, Subject>();
    for (const s of gradeSubjects ?? []) {
      subjectMap.set(s.id, {
        id: s.id,
        schoolId: s.school_id,
        gradeId: s.grade_id,
        code: s.code,
        nameAr: s.name_ar,
        nameEn: s.name_en ?? undefined,
        category: mapSubjectCategory(s.subject_type),
        isActive: s.is_active,
      });
    }

    const domainRules: TrackSubjectRule[] = (trackSubjectRows ?? []).map((ts) => {
      const subj = subjectMap.get(ts.subject_id);
      const isElective = !ts.is_mandatory || subj?.category === "TRACK_ELECTIVE";
      return {
        schoolId,
        gradeId: enrollmentRow.grade_id,
        trackId: ts.track_id,
        subjectId: ts.subject_id,
        isElective,
        electiveGroup: ts.elective_group_code ?? (isElective ? ELECTIVE_GROUPS.SECOND_LANG : null),
      };
    });

    for (const domainSubject of subjectMap.values()) {
      const decision = evaluateStudentSubjectEligibility({
        enrollment: domainEnrollment,
        subject: domainSubject,
        trackSubjectRules: domainRules,
        track: domainTrack,
      });
      if (decision.eligible) {
        eligibleSubjectIds.push(domainSubject.id);
      }
    }
  }

  // Fetch upcoming sessions for this school
  const now = new Date().toISOString();
  const { data: sessionsData } = await supabase
    .from("sessions")
    .select(`
      id, subject_id, title_ar, starts_at, ends_at, buffer_minutes, max_capacity, booked_seats_count, status,
      halls!sessions_hall_id_fkey ( name_ar, code ),
      subjects!sessions_subject_id_fkey ( name_ar, code ),
      teacher_profiles!sessions_teacher_id_fkey ( teacher_code )
    `)
    .eq("school_id", schoolId)
    .in("status", ["scheduled", "full"])
    .gte("starts_at", now)
    .order("starts_at", { ascending: true })
    .limit(50);

  const eligibleSet = new Set(eligibleSubjectIds);
  const sessions = (sessionsData ?? []).map((s) => {
    const hall = s.halls as unknown as { name_ar: string; code: string } | null;
    const subject = s.subjects as unknown as { name_ar: string; code: string } | null;
    const teacher = s.teacher_profiles as unknown as { teacher_code: string } | null;
    return {
      id: s.id,
      subjectId: s.subject_id,
      isEligible: eligibleSet.has(s.subject_id),
      titleAr: s.title_ar,
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      bufferMinutes: s.buffer_minutes,
      maxCapacity: s.max_capacity,
      bookedSeatsCount: s.booked_seats_count,
      status: s.status,
      hallNameAr: hall?.name_ar ?? "",
      hallCode: hall?.code ?? "",
      subjectNameAr: subject?.name_ar ?? "",
      subjectCode: subject?.code ?? "",
      teacherCode: teacher?.teacher_code ?? "",
    };
  });

  // Fetch student bookings — reconstruct QR tokens server-side
  const { data: bookingsData } = await supabase
    .from("bookings")
    .select(`
      id, session_id, status, seat_number, waitlist_position, qr_nonce, booked_at,
      sessions!bookings_session_id_fkey ( title_ar, starts_at )
    `)
    .eq("student_id", user.id)
    .eq("school_id", schoolId)
    .in("status", ["confirmed", "waitlisted", "checked_in"])
    .order("booked_at", { ascending: false })
    .limit(20);

  const bookings = (bookingsData ?? []).map((b) => {
    const session = b.sessions as unknown as { title_ar: string; starts_at: string } | null;
    let qrToken: string | null = null;

    // Only reconstruct QR token for confirmed bookings with a nonce
    if ((b.status === "confirmed" || b.status === "checked_in") && b.qr_nonce) {
      try {
        const signed = signQrToken({
          bookingId: b.id,
          sessionId: b.session_id,
          nonce: b.qr_nonce,
        });
        qrToken = signed.token;
      } catch {
        // QR reconstruction failed — leave null, UI will handle gracefully
      }
    }

    return {
      id: b.id,
      sessionId: b.session_id,
      status: b.status,
      seatNumber: b.seat_number,
      waitlistPosition: b.waitlist_position,
      qrToken,
      referenceCode: formatReferenceCode(b.id),
      bookedAt: b.booked_at,
      sessionTitleAr: session?.title_ar ?? "",
      sessionStartsAt: session?.starts_at ?? "",
    };
  });

  // Fetch unread notifications
  const { data: notifData } = await supabase
    .from("notifications")
    .select("id, type, title_ar, body_ar, is_read, created_at")
    .eq("recipient_id", user.id)
    .eq("school_id", schoolId)
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(10);

  const notifications = (notifData ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    titleAr: n.title_ar,
    bodyAr: n.body_ar,
    isRead: n.is_read,
    createdAt: n.created_at,
  }));

  return ok({ enrollment, eligibleSubjectIds, sessions, bookings, notifications });
}

// ---------------------------------------------------------------------------
// getBookingTicketData
// ---------------------------------------------------------------------------

export interface BookingTicketData {
  readonly bookingId: string;
  readonly referenceCode: string;
  readonly qrToken: string;
  readonly status: string;
  readonly seatNumber: string | null;
  readonly sessionTitleAr: string;
  readonly sessionStartsAt: string;
  readonly sessionEndsAt: string;
  readonly hallNameAr: string;
  readonly subjectNameAr: string;
  readonly teacherCode: string;
  readonly studentLabel: string;
}

export async function getBookingTicketData(
  schoolSlug: string,
  bookingId: string
): Promise<ActionResult<BookingTicketData>> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "Authentication required");
  }

  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolIdFromSlug(supabase, schoolSlug);
  if (!schoolId) {
    return err("NOT_FOUND", "School not found");
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select(`
      id, session_id, student_id, status, seat_number, qr_nonce,
      sessions!bookings_session_id_fkey (
        title_ar, starts_at, ends_at,
        halls!sessions_hall_id_fkey ( name_ar ),
        subjects!sessions_subject_id_fkey ( name_ar ),
        teacher_profiles!sessions_teacher_id_fkey ( teacher_code )
      )
    `)
    .eq("id", bookingId)
    .eq("school_id", schoolId)
    .single();

  if (!booking) {
    return err("NOT_FOUND", "Booking not found");
  }

  // Verify ownership: student owns this booking, or user is school admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();

  const isOwner = booking.student_id === user.id;
  const isSchoolAdmin =
    profile?.role === "school_admin" && profile.school_id === schoolId;

  if (!isOwner && !isSchoolAdmin) {
    return err("FORBIDDEN", "You do not have access to this booking");
  }

  // Reconstruct QR token
  if (!booking.qr_nonce) {
    return err("INTERNAL_ERROR", "Booking QR data is incomplete");
  }

  const signed = signQrToken({
    bookingId: booking.id,
    sessionId: booking.session_id,
    nonce: booking.qr_nonce,
  });

  const session = booking.sessions as unknown as {
    title_ar: string;
    starts_at: string;
    ends_at: string;
    halls: { name_ar: string } | null;
    subjects: { name_ar: string } | null;
    teacher_profiles: { teacher_code: string } | null;
  } | null;

  // Fetch student profile for anonymous label
  const { data: studentProfile } = await supabase
    .from("profiles")
    .select("student_national_code")
    .eq("id", booking.student_id)
    .single();

  const studentLabel = studentProfile?.student_national_code
    ? `كود ${studentProfile.student_national_code}`
    : `كود ${booking.student_id.slice(0, 8).toUpperCase()}`;

  return ok({
    bookingId: booking.id,
    referenceCode: formatReferenceCode(booking.id),
    qrToken: signed.token,
    status: booking.status,
    seatNumber: booking.seat_number,
    sessionTitleAr: session?.title_ar ?? "",
    sessionStartsAt: session?.starts_at ?? "",
    sessionEndsAt: session?.ends_at ?? "",
    hallNameAr: session?.halls?.name_ar ?? "",
    subjectNameAr: session?.subjects?.name_ar ?? "",
    teacherCode: session?.teacher_profiles?.teacher_code ?? "",
    studentLabel,
  });
}

// ---------------------------------------------------------------------------
// bookStudentSeatAction
// ---------------------------------------------------------------------------

export async function bookStudentSeatAction(
  input: { sessionId: string; schoolSlug: string; turnstileToken?: string }
): Promise<
  ActionResult<{
    status: "confirmed" | "waitlisted";
    bookingId: string;
    seatNumber: string | null;
    waitlistPosition: number | null;
    qrToken: string | null;
  }>
> {
  const parsed = bookSeatSchema.safeParse(input);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", "Invalid booking input");
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "Authentication required");
  }

  // Rate limit: 3 bookings per minute
  const rlResult = await checkRateLimit(`book:${user.id}`, {
    limit: 3,
    windowMs: 60_000,
    prefix: "modarrag:book",
  });
  if (!rlResult.allowed) {
    return err("RATE_LIMITED", "Too many booking attempts. Please wait a moment.");
  }

  // Turnstile verification
  const turnstileResult = await verifyTurnstileToken(parsed.data.turnstileToken);
  if (!turnstileResult.ok) {
    return turnstileResult;
  }

  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolIdFromSlug(supabase, parsed.data.schoolSlug);
  if (!schoolId) {
    return err("NOT_FOUND", "School not found");
  }

  // Generate booking ID and sign QR token
  const bookingId = crypto.randomUUID();
  const signed = signQrToken({
    bookingId,
    sessionId: parsed.data.sessionId,
  });

  // Call RPC
  type BookRpc = Database["public"]["Functions"]["book_student_seat"];
  const rpcArgs: BookRpc["Args"] = {
    p_session_id: parsed.data.sessionId,
    p_qr_token_hash: signed.tokenHash,
    p_qr_nonce: signed.nonce,
    p_booking_id: bookingId,
  };

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "book_student_seat",
    rpcArgs
  );

  if (rpcError) {
    return err("INTERNAL_ERROR", rpcError.message);
  }

  const result = rpcResult as unknown as BookStudentSeatRpcResult;
  if (!result || !result.ok) {
    const failResult = result as Extract<BookStudentSeatRpcResult, { ok: false }>;
    const codeMap: Record<string, Parameters<typeof err>[0]> = {
      session_not_found: "NOT_FOUND",
      session_not_bookable: "CONFLICT",
      already_booked: "CONFLICT",
      student_time_overlap: "TIME_OVERLAP",
      ineligible_subject: "ELIGIBILITY_DENIED",
      enrollment_missing: "FORBIDDEN",
      cross_tenant_forbidden: "FORBIDDEN",
      profile_inactive: "FORBIDDEN",
      student_role_required: "FORBIDDEN",
      onboarding_incomplete: "FORBIDDEN",
      unauthenticated: "UNAUTHORIZED",
      invalid_qr_payload: "VALIDATION_ERROR",
    };
    return err(
      codeMap[failResult.code] ?? "INTERNAL_ERROR",
      failResult.message_ar
    );
  }

  const successResult = result as Extract<BookStudentSeatRpcResult, { ok: true }>;
  return ok({
    status: successResult.status,
    bookingId: successResult.booking_id,
    seatNumber: successResult.seat_number,
    waitlistPosition: successResult.waitlist_position,
    qrToken: successResult.status === "confirmed" ? signed.token : null,
  });
}

// ---------------------------------------------------------------------------
// cancelStudentBookingAction
// ---------------------------------------------------------------------------

export async function cancelStudentBookingAction(
  input: { bookingId: string; schoolSlug: string }
): Promise<ActionResult<{ cancelledBookingId: string; promotedBookingId: string | null }>> {
  const parsed = cancelBookingSchema.safeParse(input);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", "Invalid cancellation input");
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "Authentication required");
  }

  // Churn rate limit: 3 cancellations per day
  const rlResult = await checkRateLimit(`cancel:${user.id}`, {
    limit: 3,
    windowMs: 86_400_000,
    prefix: "modarrag:cancel",
  });
  if (!rlResult.allowed) {
    return err("RATE_LIMITED", "Daily cancellation limit reached. Please try again tomorrow.");
  }

  const supabase = await createSupabaseServerClient();

  type CancelRpc = Database["public"]["Functions"]["cancel_student_booking"];
  const rpcArgs: CancelRpc["Args"] = {
    p_booking_id: parsed.data.bookingId,
  };

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "cancel_student_booking",
    rpcArgs
  );

  if (rpcError) {
    return err("INTERNAL_ERROR", rpcError.message);
  }

  const result = rpcResult as unknown as CancelStudentBookingRpcResult;
  if (!result || !result.ok) {
    const failResult = result as Extract<CancelStudentBookingRpcResult, { ok: false }>;
    const codeMap: Record<string, Parameters<typeof err>[0]> = {
      booking_not_found: "NOT_FOUND",
      forbidden: "FORBIDDEN",
      cannot_cancel_status: "CONFLICT",
      unauthenticated: "UNAUTHORIZED",
    };
    return err(
      codeMap[failResult.code] ?? "INTERNAL_ERROR",
      failResult.message_ar
    );
  }

  const successResult = result as Extract<CancelStudentBookingRpcResult, { ok: true }>;
  return ok({
    cancelledBookingId: successResult.cancelled_booking_id,
    promotedBookingId: successResult.promoted_booking_id,
  });
}
