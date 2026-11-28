"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient, getAuthenticatedUser } from "@/infrastructure/supabase/server";
import { ok, err, type ActionResult } from "@/domain/common/result";
import type {
  BookingAttendanceFlag,
  BookingStatus,
  Database,
  MarkStudentAttendanceRpcResult,
  RecordBookingComplianceRpcResult,
} from "@/infrastructure/supabase/database.types";

const sessionQuerySchema = z.object({
  schoolSlug: z.string().min(1),
  sessionId: z.string().uuid("Invalid session ID"),
});

const markAttendanceSchema = z.object({
  schoolSlug: z.string().min(1),
  sessionId: z.string().uuid("Invalid session ID"),
  bookingId: z.string().uuid("Invalid booking ID"),
  present: z.boolean(),
});

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

async function requireTeacherOrAdmin(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  schoolId: string
): Promise<ActionResult<{ role: string }>> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    return err("FORBIDDEN", "الملف الشخصي غير موجود.");
  }

  if (profile.role === "super_admin") {
    return ok({ role: profile.role });
  }

  if (
    (profile.role !== "teacher" && profile.role !== "school_admin") ||
    profile.school_id !== schoolId
  ) {
    return err("FORBIDDEN", "صلاحية التحضير متاحة للمعلم أو إدارة المدرسة فقط.");
  }

  return ok({ role: profile.role });
}

export interface AttendanceStudentEntry {
  readonly bookingId: string;
  readonly studentId: string;
  readonly fullName: string;
  readonly phone: string | null;
  readonly seatNumber: string | null;
  readonly waitlistPosition: number | null;
  readonly status: BookingStatus;
  readonly attendanceFlag: BookingAttendanceFlag;
  readonly lateMinutes: number;
  readonly deductionEgp: number;
  readonly checkedInAt: string | null;
  readonly bookedAt: string;
}

export interface SessionAttendanceData {
  readonly session: {
    readonly id: string;
    readonly titleAr: string;
    readonly startsAt: string;
    readonly endsAt: string;
    readonly maxCapacity: number;
    readonly bookedSeatsCount: number;
    readonly status: string;
    readonly deliveryMode: "in_person" | "online";
    readonly priceEgp: number;
    readonly hallNameAr: string;
    readonly subjectNameAr: string;
    readonly teacherSpecialtyAr: string;
  };
  readonly students: readonly AttendanceStudentEntry[];
}

/**
 * Loads registered students for a session so teachers can search by full name
 * and check students in with one tap.
 */
export async function getSessionAttendanceData(
  schoolSlug: string,
  sessionId: string
): Promise<ActionResult<SessionAttendanceData>> {
  const parsed = sessionQuerySchema.safeParse({ schoolSlug, sessionId });
  if (!parsed.success) {
    return err("VALIDATION_ERROR", "بيانات الحصة غير صحيحة.");
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "يرجى تسجيل الدخول أولاً.");
  }

  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolIdFromSlug(supabase, parsed.data.schoolSlug);
  if (!schoolId) {
    return err("NOT_FOUND", "المدرسة غير موجودة.");
  }

  const access = await requireTeacherOrAdmin(supabase, user.id, schoolId);
  if (!access.ok) {
    return access;
  }

  const { data: sessionRow } = await supabase
    .from("sessions")
    .select(`
      id, teacher_id, title_ar, starts_at, ends_at, max_capacity, booked_seats_count, status, delivery_mode, price_egp,
      halls!sessions_hall_id_fkey ( name_ar ),
      subjects!sessions_subject_id_fkey ( name_ar ),
      teacher_profiles!sessions_teacher_id_fkey ( specialty_ar )
    `)
    .eq("id", parsed.data.sessionId)
    .eq("school_id", schoolId)
    .single();

  if (!sessionRow) {
    return err("NOT_FOUND", "الحصة غير موجودة.");
  }

  if (access.data.role === "teacher" && sessionRow.teacher_id !== user.id) {
    return err("FORBIDDEN", "يمكنك فتح كشف التحضير لحصصك فقط.");
  }

  const { data: bookingsData, error: bookingsError } = await supabase
    .from("bookings")
    .select(`
      id, student_id, status, attendance_flag, late_minutes, deduction_egp, seat_number, waitlist_position, checked_in_at, booked_at,
      profiles!bookings_student_id_fkey ( full_name, phone )
    `)
    .eq("session_id", parsed.data.sessionId)
    .eq("school_id", schoolId)
    .in("status", ["confirmed", "checked_in", "waitlisted", "no_show"])
    .limit(500);

  if (bookingsError) {
    return err("INTERNAL_ERROR", bookingsError.message);
  }

  const hall = sessionRow.halls as unknown as { name_ar: string } | null;
  const subject = sessionRow.subjects as unknown as { name_ar: string } | null;
  const teacher = sessionRow.teacher_profiles as unknown as { specialty_ar: string } | null;

  const students: AttendanceStudentEntry[] = (bookingsData ?? [])
    .map((b) => {
      const profile = b.profiles as unknown as {
        full_name: string | null;
        phone: string | null;
      } | null;

      return {
        bookingId: b.id,
        studentId: b.student_id,
        fullName: profile?.full_name?.trim() || `طالب (${b.id.slice(0, 6)})`,
        phone: profile?.phone ?? null,
        seatNumber: b.seat_number,
        waitlistPosition: b.waitlist_position,
        status: b.status,
        attendanceFlag: b.attendance_flag ?? "on_time",
        lateMinutes: b.late_minutes ?? 0,
        deductionEgp: b.deduction_egp ?? 0,
        checkedInAt: b.checked_in_at,
        bookedAt: b.booked_at,
      };
    })
    .sort((a, b) => {
      const aWait = a.status === "waitlisted" ? 1 : 0;
      const bWait = b.status === "waitlisted" ? 1 : 0;
      if (aWait !== bWait) return aWait - bWait;
      return a.fullName.localeCompare(b.fullName, "ar");
    });

  return ok({
    session: {
      id: sessionRow.id,
      titleAr: sessionRow.title_ar,
      startsAt: sessionRow.starts_at,
      endsAt: sessionRow.ends_at,
      maxCapacity: sessionRow.max_capacity,
      bookedSeatsCount: sessionRow.booked_seats_count,
      status: sessionRow.status,
      deliveryMode: sessionRow.delivery_mode ?? "in_person",
      priceEgp: sessionRow.price_egp ?? 0,
      hallNameAr:
        sessionRow.delivery_mode === "online"
          ? "بث مباشر أونلاين"
          : (hall?.name_ar ?? ""),
      subjectNameAr: subject?.name_ar ?? "",
      teacherSpecialtyAr: teacher?.specialty_ar ?? "معلم المادة",
    },
    students,
  });
}

/**
 * Marks a registered student present (checked_in) or reverts to confirmed via RPC.
 */
export async function markStudentAttendanceAction(input: {
  schoolSlug: string;
  sessionId: string;
  bookingId: string;
  present: boolean;
}): Promise<
  ActionResult<{
    bookingId: string;
    status: "confirmed" | "checked_in";
    checkedInAt: string | null;
  }>
> {
  const parsed = markAttendanceSchema.safeParse(input);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", "بيانات التحضير غير صحيحة.");
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "يرجى تسجيل الدخول أولاً.");
  }

  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolIdFromSlug(supabase, parsed.data.schoolSlug);
  if (!schoolId) {
    return err("NOT_FOUND", "المدرسة غير موجودة.");
  }

  type MarkRpc = Database["public"]["Functions"]["mark_student_attendance"];
  const rpcArgs: MarkRpc["Args"] = {
    p_booking_id: parsed.data.bookingId,
    p_present: parsed.data.present,
  };

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "mark_student_attendance",
    rpcArgs
  );

  if (rpcError) {
    return err("INTERNAL_ERROR", rpcError.message);
  }

  const result = rpcResult as unknown as MarkStudentAttendanceRpcResult;
  if (!result || !result.ok) {
    const failResult = result as Extract<MarkStudentAttendanceRpcResult, { ok: false }>;
    const codeMap: Record<string, Parameters<typeof err>[0]> = {
      unauthenticated: "UNAUTHORIZED",
      forbidden: "FORBIDDEN",
      booking_not_found: "NOT_FOUND",
      invalid_status: "CONFLICT",
    };
    return err(
      codeMap[failResult.code] ?? "INTERNAL_ERROR",
      failResult.message_ar
    );
  }

  const successResult = result as Extract<MarkStudentAttendanceRpcResult, { ok: true }>;
  revalidatePath(`/s/${parsed.data.schoolSlug}/teacher/sessions/${parsed.data.sessionId}`);
  revalidatePath(`/s/${parsed.data.schoolSlug}/teacher`);
  revalidatePath(`/s/${parsed.data.schoolSlug}/student`);

  return ok({
    bookingId: successResult.booking_id,
    status: successResult.status,
    checkedInAt: successResult.checked_in_at,
  });
}

const recordComplianceSchema = z.object({
  schoolSlug: z.string().min(1),
  sessionId: z.string().uuid(),
  bookingId: z.string().uuid(),
  attendanceFlag: z.enum(["on_time", "late", "absent_deducted"]),
  lateMinutes: z.number().int().min(0).max(240).default(0),
  deductionEgp: z.number().int().min(0).max(5000).default(0),
});

export async function recordStudentComplianceAction(
  input: z.infer<typeof recordComplianceSchema>
): Promise<ActionResult<{ flag: BookingAttendanceFlag; deductionEgp: number }>> {
  const parsed = recordComplianceSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION_ERROR", "بيانات الالتزام غير صالحة.");

  const user = await getAuthenticatedUser();
  if (!user) return err("UNAUTHORIZED", "يرجى تسجيل الدخول أولاً.");

  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolIdFromSlug(supabase, parsed.data.schoolSlug);
  if (!schoolId) return err("NOT_FOUND", "المدرسة غير موجودة.");

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "record_booking_compliance",
    {
      p_booking_id: parsed.data.bookingId,
      p_attendance_flag: parsed.data.attendanceFlag,
      p_late_minutes: parsed.data.lateMinutes,
      p_deduction_egp: parsed.data.deductionEgp,
    }
  );

  if (rpcError) return err("INTERNAL_ERROR", rpcError.message);
  const res = rpcResult as unknown as RecordBookingComplianceRpcResult;
  if (!res || !res.ok) {
    const fail = res as Extract<RecordBookingComplianceRpcResult, { ok: false }>;
    return err("FORBIDDEN", fail?.message_ar ?? "تعذر تسجيل حالة الالتزام.");
  }

  revalidatePath(`/s/${parsed.data.schoolSlug}/teacher/sessions/${parsed.data.sessionId}`);
  revalidatePath(`/s/${parsed.data.schoolSlug}/teacher`);
  return ok({ flag: res.flag, deductionEgp: res.deduction_egp });
}
