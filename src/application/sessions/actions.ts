"use server";

import { z } from "zod";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  getAuthenticatedUser,
} from "@/infrastructure/supabase/server";
import { doBufferedSessionsOverlap } from "@/domain/booking/time-slots";
import { ok, err, type ActionResult } from "@/domain/common/result";

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const createSessionSchema = z.object({
  schoolSlug: z.string().min(1),
  hallId: z.string().uuid("Invalid hall ID"),
  subjectId: z.string().uuid("Invalid subject ID"),
  titleAr: z.string().trim().min(1, "Session title is required").max(160),
  startsAtIso: z.string().datetime({ offset: true, message: "Invalid start time" }),
  durationMinutes: z.number().int().min(15).max(480),
  maxCapacity: z.number().int().min(1).max(2000).optional(),
});

const createSessionSeriesSchema = createSessionSchema.extend({
  recurrenceWeeks: z.number().int().min(1).max(52),
});

const cancelSessionSchema = z.object({
  schoolSlug: z.string().min(1),
  sessionId: z.string().uuid("Invalid session ID"),
  reason: z.string().trim().min(1, "Cancellation reason is required").max(500),
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

async function requireTeacher(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  schoolId: string
): Promise<ActionResult<{ teacherId: string }>> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", userId)
    .single();

  if (!profile || profile.role !== "teacher" || profile.school_id !== schoolId) {
    return err("FORBIDDEN", "Teacher access required for this school");
  }

  const { data: teacherProfile } = await supabase
    .from("teacher_profiles")
    .select("id, is_approved")
    .eq("id", userId)
    .eq("school_id", schoolId)
    .single();

  if (!teacherProfile) {
    return err("FORBIDDEN", "Teacher profile not found");
  }

  if (!teacherProfile.is_approved) {
    return err("FORBIDDEN", "Teacher account is pending approval");
  }

  return ok({ teacherId: teacherProfile.id });
}

function computeEndsAtIso(startsAtIso: string, durationMinutes: number): string {
  const start = new Date(startsAtIso);
  return new Date(start.getTime() + durationMinutes * 60_000).toISOString();
}

// ---------------------------------------------------------------------------
// getTeacherConsoleData
// ---------------------------------------------------------------------------

export interface TeacherConsoleData {
  readonly teacherCode: string;
  readonly specialtyAr: string;
  readonly isApproved: boolean;
  readonly subjects: readonly {
    readonly id: string;
    readonly nameAr: string;
    readonly code: string;
  }[];
  readonly halls: readonly {
    readonly id: string;
    readonly nameAr: string;
    readonly code: string;
    readonly maxCapacity: number;
    readonly status: string;
  }[];
  readonly sessions: readonly {
    readonly id: string;
    readonly hallId: string;
    readonly subjectId: string;
    readonly teacherId: string;
    readonly teacherCode: string;
    readonly teacherSpecialtyAr: string;
    readonly isOwnSession: boolean;
    readonly titleAr: string;
    readonly startsAt: string;
    readonly endsAt: string;
    readonly bufferMinutes: number;
    readonly maxCapacity: number;
    readonly bookedSeatsCount: number;
    readonly checkedInCount: number;
    readonly status: string;
    readonly hallCode: string;
    readonly hallNameAr: string;
    readonly subjectCode: string;
    readonly subjectNameAr: string;
  }[];
}

export async function getTeacherConsoleData(
  schoolSlug: string
): Promise<ActionResult<TeacherConsoleData>> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "Authentication required");
  }

  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolIdFromSlug(supabase, schoolSlug);
  if (!schoolId) {
    return err("NOT_FOUND", "School not found");
  }

  const teacherResult = await requireTeacher(supabase, user.id, schoolId);
  if (!teacherResult.ok) {
    return teacherResult;
  }

  // Fetch teacher profile
  const { data: teacherProfile } = await supabase
    .from("teacher_profiles")
    .select("teacher_code, specialty_ar, is_approved")
    .eq("id", user.id)
    .eq("school_id", schoolId)
    .single();

  if (!teacherProfile) {
    return err("NOT_FOUND", "Teacher profile not found");
  }

  // Fetch authorized subjects
  const { data: teacherSubjects } = await supabase
    .from("teacher_subjects")
    .select(`
      subject_id,
      subjects!teacher_subjects_subject_id_fkey ( id, name_ar, code )
    `)
    .eq("teacher_id", user.id)
    .eq("school_id", schoolId);

  const subjects = (teacherSubjects ?? []).map((ts) => {
    const subj = ts.subjects as unknown as { id: string; name_ar: string; code: string };
    return { id: subj.id, nameAr: subj.name_ar, code: subj.code };
  });

  // Fetch active halls
  const { data: hallsData } = await supabase
    .from("halls")
    .select("id, name_ar, code, max_capacity, status")
    .eq("school_id", schoolId)
    .eq("status", "active")
    .order("code", { ascending: true });

  const halls = (hallsData ?? []).map((h) => ({
    id: h.id,
    nameAr: h.name_ar,
    code: h.code,
    maxCapacity: h.max_capacity,
    status: h.status,
  }));

  // Fetch all school sessions for the next 14 days so the Cal.com grid shows real hall slots & 15m buffers
  const now = new Date();
  const twoWeeksLater = new Date(now.getTime() + 14 * 86_400_000);

  const recentCutoff = new Date(now.getTime() - 12 * 3_600_000);
  const { data: sessionsData } = await supabase
    .from("sessions")
    .select(`
      id, hall_id, subject_id, teacher_id, title_ar, starts_at, ends_at, buffer_minutes, max_capacity, booked_seats_count, status,
      halls!sessions_hall_id_fkey ( code, name_ar ),
      subjects!sessions_subject_id_fkey ( code, name_ar ),
      teacher_profiles!sessions_teacher_id_fkey ( teacher_code, specialty_ar )
    `)
    .eq("school_id", schoolId)
    .in("status", ["scheduled", "full", "ongoing", "completed"])
    .gte("ends_at", recentCutoff.toISOString())
    .lte("starts_at", twoWeeksLater.toISOString())
    .order("starts_at", { ascending: true });

  const sessionIds = (sessionsData ?? []).map((s) => s.id);
  const checkedInCountBySession = new Map<string, number>();

  if (sessionIds.length > 0) {
    const { data: checkedRows } = await supabase
      .from("bookings")
      .select("session_id")
      .in("session_id", sessionIds)
      .eq("status", "checked_in");

    for (const row of checkedRows ?? []) {
      checkedInCountBySession.set(
        row.session_id,
        (checkedInCountBySession.get(row.session_id) ?? 0) + 1
      );
    }
  }

  const sessions = (sessionsData ?? []).map((s) => {
    const hall = s.halls as unknown as { code: string; name_ar: string } | null;
    const subject = s.subjects as unknown as { code: string; name_ar: string } | null;
    const teacher = s.teacher_profiles as unknown as {
      teacher_code: string;
      specialty_ar: string;
    } | null;
    return {
      id: s.id,
      hallId: s.hall_id,
      subjectId: s.subject_id,
      teacherId: s.teacher_id,
      teacherCode: teacher?.teacher_code ?? "",
      teacherSpecialtyAr: teacher?.specialty_ar ?? "معلم المادة",
      isOwnSession: s.teacher_id === user.id,
      titleAr: s.title_ar,
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      bufferMinutes: s.buffer_minutes,
      maxCapacity: s.max_capacity,
      bookedSeatsCount: s.booked_seats_count,
      checkedInCount: checkedInCountBySession.get(s.id) ?? 0,
      status: s.status,
      hallCode: hall?.code ?? "",
      hallNameAr: hall?.name_ar ?? "",
      subjectCode: subject?.code ?? "",
      subjectNameAr: subject?.name_ar ?? "",
    };
  });

  return ok({
    teacherCode: teacherProfile.teacher_code,
    specialtyAr: teacherProfile.specialty_ar,
    isApproved: teacherProfile.is_approved,
    subjects,
    halls,
    sessions,
  });
}

// ---------------------------------------------------------------------------
// getTeacherSessionRoster
// ---------------------------------------------------------------------------

export interface SessionRosterEntry {
  readonly bookingId: string;
  readonly studentLabel: string;
  readonly fullName: string;
  readonly phone: string | null;
  readonly seatNumber: string | null;
  readonly status: string;
  readonly checkedInAt: string | null;
  readonly bookedAt: string;
}

export async function getTeacherSessionRoster(
  schoolSlug: string,
  sessionId: string
): Promise<ActionResult<readonly SessionRosterEntry[]>> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "Authentication required");
  }

  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolIdFromSlug(supabase, schoolSlug);
  if (!schoolId) {
    return err("NOT_FOUND", "School not found");
  }

  const teacherResult = await requireTeacher(supabase, user.id, schoolId);
  if (!teacherResult.ok) {
    return teacherResult;
  }

  // Verify teacher owns this session
  const { data: session } = await supabase
    .from("sessions")
    .select("id, teacher_id")
    .eq("id", sessionId)
    .eq("school_id", schoolId)
    .single();

  if (!session || session.teacher_id !== user.id) {
    return err("FORBIDDEN", "You can only view rosters for your own sessions");
  }

  const { data: bookingsData } = await supabase
    .from("bookings")
    .select(`
      id, status, seat_number, checked_in_at, booked_at,
      profiles!bookings_student_id_fkey ( full_name, phone )
    `)
    .eq("session_id", sessionId)
    .eq("school_id", schoolId)
    .in("status", ["confirmed", "waitlisted", "checked_in", "no_show"])
    .order("booked_at", { ascending: true });

  const roster = (bookingsData ?? []).map((b) => {
    const studentProfile = b.profiles as unknown as {
      full_name: string | null;
      phone: string | null;
    } | null;
    const cleanName = studentProfile?.full_name?.trim() || `طالب مسجل (${b.id.slice(0, 6)})`;
    return {
      bookingId: b.id,
      studentLabel: cleanName,
      fullName: cleanName,
      phone: studentProfile?.phone ?? null,
      seatNumber: b.seat_number,
      status: b.status,
      checkedInAt: b.checked_in_at,
      bookedAt: b.booked_at,
    };
  });

  return ok(roster);
}

// ---------------------------------------------------------------------------
// createSessionAction
// ---------------------------------------------------------------------------

export async function createSessionAction(
  input: {
    schoolSlug: string;
    hallId: string;
    subjectId: string;
    titleAr: string;
    startsAtIso: string;
    durationMinutes: number;
    maxCapacity?: number;
  }
): Promise<ActionResult<{ sessionId: string }>> {
  const parsed = createSessionSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      const existing = fieldErrors[key];
      fieldErrors[key] = existing ? [...existing, issue.message] : [issue.message];
    }
    return err("VALIDATION_ERROR", "Invalid session input", { fieldErrors });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "Authentication required");
  }

  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolIdFromSlug(supabase, parsed.data.schoolSlug);
  if (!schoolId) {
    return err("NOT_FOUND", "School not found");
  }

  const teacherResult = await requireTeacher(supabase, user.id, schoolId);
  if (!teacherResult.ok) {
    return teacherResult;
  }

  // Resolve max capacity: use provided or fall back to hall capacity
  let maxCapacity = parsed.data.maxCapacity;
  if (maxCapacity === undefined) {
    const { data: hall } = await supabase
      .from("halls")
      .select("max_capacity")
      .eq("id", parsed.data.hallId)
      .eq("school_id", schoolId)
      .single();
    maxCapacity = hall?.max_capacity ?? 30;
  }

  const endsAt = computeEndsAtIso(parsed.data.startsAtIso, parsed.data.durationMinutes);

  // Fetch school default buffer
  const { data: school } = await supabase
    .from("schools")
    .select("default_buffer_minutes")
    .eq("id", schoolId)
    .single();
  const bufferMinutes = school?.default_buffer_minutes ?? 15;

  const { data: sessionRow, error: insertError } = await supabase
    .from("sessions")
    .insert({
      school_id: schoolId,
      hall_id: parsed.data.hallId,
      teacher_id: user.id,
      subject_id: parsed.data.subjectId,
      title_ar: parsed.data.titleAr,
      starts_at: parsed.data.startsAtIso,
      ends_at: endsAt,
      buffer_minutes: bufferMinutes,
      max_capacity: maxCapacity,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertError) {
    // Catch PostgreSQL exclusion constraint violation (23P01)
    if (insertError.code === "23P01") {
      // Suggest next available slot in the same hall or an alternative free hall
      const requestedStart = new Date(parsed.data.startsAtIso);
      const dayStart = new Date(requestedStart);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 2 * 86_400_000);

      const [{ data: nearbySessions }, { data: activeHalls }] = await Promise.all([
        supabase
          .from("sessions")
          .select("id, hall_id, teacher_id, starts_at, ends_at, buffer_minutes")
          .eq("school_id", schoolId)
          .neq("status", "cancelled")
          .gte("starts_at", dayStart.toISOString())
          .lte("starts_at", dayEnd.toISOString()),
        supabase
          .from("halls")
          .select("id, name_ar, code")
          .eq("school_id", schoolId)
          .eq("status", "active"),
      ]);

      const hallSessions = (nearbySessions ?? []).filter((s) => s.hall_id === parsed.data.hallId);
      const teacherSessions = (nearbySessions ?? []).filter((s) => s.teacher_id === user.id);

      let nextFreeSlotIso: string | null = null;
      for (let step = 1; step <= 16; step++) {
        const candidateStart = new Date(requestedStart.getTime() + step * 30 * 60_000);
        const candidateEnd = new Date(
          candidateStart.getTime() + parsed.data.durationMinutes * 60_000
        );
        const candidateInterval = {
          startsAt: candidateStart,
          endsAt: candidateEnd,
          bufferMinutes,
        };
        const hasHallConflict = hallSessions.some((s) =>
          doBufferedSessionsOverlap(candidateInterval, {
            startsAt: s.starts_at,
            endsAt: s.ends_at,
            bufferMinutes: s.buffer_minutes,
          })
        );
        const hasTeacherConflict = teacherSessions.some((s) =>
          doBufferedSessionsOverlap(candidateInterval, {
            startsAt: s.starts_at,
            endsAt: s.ends_at,
            bufferMinutes: 0,
          })
        );
        if (!hasHallConflict && !hasTeacherConflict) {
          nextFreeSlotIso = candidateStart.toISOString();
          break;
        }
      }

      const candidateWindow = {
        startsAt: requestedStart,
        endsAt: new Date(endsAt),
        bufferMinutes,
      };
      const alternativeHall = (activeHalls ?? []).find((hall) => {
        if (hall.id === parsed.data.hallId) return false;
        const occupied = (nearbySessions ?? []).some(
          (s) =>
            s.hall_id === hall.id &&
            doBufferedSessionsOverlap(candidateWindow, {
              startsAt: s.starts_at,
              endsAt: s.ends_at,
              bufferMinutes: s.buffer_minutes,
            })
        );
        return !occupied;
      });

      const suggestions: string[] = [];
      if (nextFreeSlotIso) {
        const timeText = new Intl.DateTimeFormat("ar-EG", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Africa/Cairo",
        }).format(new Date(nextFreeSlotIso));
        suggestions.push(`أقرب موعد متاح بنفس المدرج: ${timeText}`);
      }
      if (alternativeHall) {
        suggestions.push(`أو المدرج البديل المتاح: ${alternativeHall.name_ar} (${alternativeHall.code})`);
      }

      const suffix = suggestions.length > 0 ? ` (${suggestions.join(" · ")})` : "";
      return err(
        "SCHEDULE_CONFLICT",
        `يوجد تعارض في الجدول أو فاصل الانتقال (${bufferMinutes} دقيقة) لهذا المدرج أو المعلم.${suffix}`,
        {
          details: {
            nextFreeSlotIso,
            alternativeHallCode: alternativeHall?.code ?? null,
          },
        }
      );
    }
    return err("INTERNAL_ERROR", insertError.message);
  }

  if (!sessionRow) {
    return err("INTERNAL_ERROR", "Session was created but could not be retrieved");
  }

  return ok({ sessionId: sessionRow.id });
}

// ---------------------------------------------------------------------------
// createSessionSeriesAction
// ---------------------------------------------------------------------------

export async function createSessionSeriesAction(
  input: {
    schoolSlug: string;
    hallId: string;
    subjectId: string;
    titleAr: string;
    startsAtIso: string;
    durationMinutes: number;
    recurrenceWeeks: number;
  }
): Promise<ActionResult<{ createdCount: number; conflictDates: string[] }>> {
  const parsed = createSessionSeriesSchema.safeParse(input);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", "Invalid session series input");
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "Authentication required");
  }

  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolIdFromSlug(supabase, parsed.data.schoolSlug);
  if (!schoolId) {
    return err("NOT_FOUND", "School not found");
  }

  const teacherResult = await requireTeacher(supabase, user.id, schoolId);
  if (!teacherResult.ok) {
    return teacherResult;
  }

  // Resolve capacity from hall
  const { data: hall } = await supabase
    .from("halls")
    .select("max_capacity")
    .eq("id", parsed.data.hallId)
    .eq("school_id", schoolId)
    .single();
  const maxCapacity = hall?.max_capacity ?? 30;

  // Fetch school default buffer
  const { data: school } = await supabase
    .from("schools")
    .select("default_buffer_minutes")
    .eq("id", schoolId)
    .single();
  const bufferMinutes = school?.default_buffer_minutes ?? 15;

  // Create a session series record
  const startDate = new Date(parsed.data.startsAtIso);
  const dayOfWeek = startDate.getUTCDay();
  const startTime = startDate.toISOString().slice(11, 19); // HH:MM:SS
  const endsOnDate = new Date(
    startDate.getTime() + parsed.data.recurrenceWeeks * 7 * 86_400_000
  );

  const { data: seriesRow, error: seriesError } = await supabase
    .from("session_series")
    .insert({
      school_id: schoolId,
      teacher_id: user.id,
      subject_id: parsed.data.subjectId,
      hall_id: parsed.data.hallId,
      title_ar: parsed.data.titleAr,
      day_of_week: dayOfWeek,
      start_time: startTime,
      duration_minutes: parsed.data.durationMinutes,
      recurrence_weeks: parsed.data.recurrenceWeeks,
      starts_on: startDate.toISOString().slice(0, 10),
      ends_on: endsOnDate.toISOString().slice(0, 10),
    })
    .select("id")
    .single();

  if (seriesError || !seriesRow) {
    return err("INTERNAL_ERROR", seriesError?.message ?? "Failed to create session series");
  }

  // Create individual sessions for each week
  let createdCount = 0;
  const conflictDates: string[] = [];

  for (let week = 0; week < parsed.data.recurrenceWeeks; week++) {
    const weekStartMs = startDate.getTime() + week * 7 * 86_400_000;
    const weekStartIso = new Date(weekStartMs).toISOString();
    const weekEndIso = computeEndsAtIso(weekStartIso, parsed.data.durationMinutes);

    const { error: insertError } = await supabase
      .from("sessions")
      .insert({
        school_id: schoolId,
        series_id: seriesRow.id,
        hall_id: parsed.data.hallId,
        teacher_id: user.id,
        subject_id: parsed.data.subjectId,
        title_ar: parsed.data.titleAr,
        starts_at: weekStartIso,
        ends_at: weekEndIso,
        buffer_minutes: bufferMinutes,
        max_capacity: maxCapacity,
        created_by: user.id,
      });

    if (insertError) {
      if (insertError.code === "23P01") {
        conflictDates.push(new Date(weekStartMs).toISOString().slice(0, 10));
      } else {
        // Non-conflict errors are unexpected; still record and continue
        conflictDates.push(new Date(weekStartMs).toISOString().slice(0, 10));
      }
    } else {
      createdCount++;
    }
  }

  return ok({ createdCount, conflictDates });
}

// ---------------------------------------------------------------------------
// cancelSessionAction
// ---------------------------------------------------------------------------

export async function cancelSessionAction(
  input: { schoolSlug: string; sessionId: string; reason: string }
): Promise<ActionResult<{ notifiedCount: number }>> {
  const parsed = cancelSessionSchema.safeParse(input);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", "Invalid cancellation input");
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "Authentication required");
  }

  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolIdFromSlug(supabase, parsed.data.schoolSlug);
  if (!schoolId) {
    return err("NOT_FOUND", "School not found");
  }

  const teacherResult = await requireTeacher(supabase, user.id, schoolId);
  if (!teacherResult.ok) {
    return teacherResult;
  }

  // Verify session ownership
  const { data: session } = await supabase
    .from("sessions")
    .select("id, teacher_id, status")
    .eq("id", parsed.data.sessionId)
    .eq("school_id", schoolId)
    .single();

  if (!session) {
    return err("NOT_FOUND", "Session not found");
  }

  if (session.teacher_id !== user.id) {
    return err("FORBIDDEN", "You can only cancel your own sessions");
  }

  if (session.status === "cancelled" || session.status === "completed") {
    return err("CONFLICT", "This session is already cancelled or completed");
  }

  // Update session status
  const { error: updateError } = await supabase
    .from("sessions")
    .update({
      status: "cancelled",
      cancellation_reason: parsed.data.reason,
    })
    .eq("id", parsed.data.sessionId);

  if (updateError) {
    return err("INTERNAL_ERROR", updateError.message);
  }

  // Cancel all active bookings and notify students
  const { data: activeBookings } = await supabase
    .from("bookings")
    .select("id, student_id")
    .eq("session_id", parsed.data.sessionId)
    .in("status", ["confirmed", "waitlisted"]);

  let notifiedCount = 0;

  if (activeBookings && activeBookings.length > 0) {
    const adminClient = createSupabaseAdminClient();
    if (adminClient) {
      // Bookings & notifications tables restrict direct authenticated mutations under RLS;
      // use privileged admin client after verifying teacher ownership above.
      const bookingIds = activeBookings.map((b) => b.id);
      await adminClient
        .from("bookings")
        .update({ status: "cancelled_by_system", cancelled_at: new Date().toISOString() })
        .in("id", bookingIds);

      const notifications = activeBookings.map((b) => ({
        school_id: schoolId,
        recipient_id: b.student_id,
        type: "session_cancelled" as const,
        title_ar: "تم إلغاء الحصة",
        body_ar: `تم إلغاء الحصة. السبب: ${parsed.data.reason}`,
        metadata: { sessionId: parsed.data.sessionId, reason: parsed.data.reason },
      }));

      const { error: notifError } = await adminClient
        .from("notifications")
        .insert(notifications);

      if (!notifError) {
        notifiedCount = notifications.length;
      }
    }
  }

  return ok({ notifiedCount });
}
