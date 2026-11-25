"use server";

import { z } from "zod";
import { createSupabaseServerClient, getAuthenticatedUser } from "@/infrastructure/supabase/server";
import { verifyQrToken, hashQrToken } from "@/infrastructure/security/hmac-signer";
import { ok, err, type ActionResult } from "@/domain/common/result";
import type { Database, VerifyAndCheckinQrRpcResult } from "@/infrastructure/supabase/database.types";

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const checkinSchema = z.object({
  schoolSlug: z.string().min(1),
  sessionId: z.string().uuid("Invalid session ID"),
  rawToken: z.string().trim().min(1, "QR token is required"),
});

const offlineScanSchema = z.object({
  bookingId: z.string().uuid(),
  rawToken: z.string().trim().min(1),
  scannedAt: z.string().datetime({ offset: true }),
});

const syncOfflineSchema = z.object({
  schoolSlug: z.string().min(1),
  sessionId: z.string().uuid(),
  scans: z.array(offlineScanSchema).min(1).max(200),
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

async function requireScannerOrAdmin(
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
    return err("FORBIDDEN", "Profile not found");
  }

  if (profile.role === "super_admin") {
    return ok({ role: profile.role });
  }

  const allowedRoles = ["gate_scanner", "school_admin", "teacher"];
  if (!allowedRoles.includes(profile.role) || profile.school_id !== schoolId) {
    return err("FORBIDDEN", "Scanner, teacher, or admin access required for this school");
  }

  return ok({ role: profile.role });
}

// ---------------------------------------------------------------------------
// getScannerSessions
// ---------------------------------------------------------------------------

export interface ScannerSessionData {
  readonly sessions: readonly {
    readonly id: string;
    readonly titleAr: string;
    readonly startsAt: string;
    readonly endsAt: string;
    readonly maxCapacity: number;
    readonly bookedSeatsCount: number;
    readonly status: string;
    readonly hallCode: string;
    readonly subjectCode: string;
    readonly teacherCode: string;
  }[];
  readonly recentCheckins: readonly {
    readonly bookingId: string;
    readonly studentLabel: string;
    readonly seatNumber: string | null;
    readonly checkedInAt: string;
    readonly sessionId: string;
  }[];
}

export async function getScannerSessions(
  schoolSlug: string
): Promise<ActionResult<ScannerSessionData>> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "Authentication required");
  }

  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolIdFromSlug(supabase, schoolSlug);
  if (!schoolId) {
    return err("NOT_FOUND", "School not found");
  }

  const accessResult = await requireScannerOrAdmin(supabase, user.id, schoolId);
  if (!accessResult.ok) {
    return accessResult;
  }

  // Fetch today's and upcoming scheduled sessions (+14 days) so gate scanner works for live & demo sessions
  const todayStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const windowEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  let sessionsQuery = supabase
    .from("sessions")
    .select(`
      id, title_ar, starts_at, ends_at, max_capacity, booked_seats_count, status,
      halls!sessions_hall_id_fkey ( code ),
      subjects!sessions_subject_id_fkey ( code ),
      teacher_profiles!sessions_teacher_id_fkey ( teacher_code )
    `)
    .eq("school_id", schoolId)
    .neq("status", "cancelled")
    .gte("ends_at", todayStart.toISOString())
    .lte("starts_at", windowEnd.toISOString())
    .order("starts_at", { ascending: true });

  if (accessResult.data.role === "teacher") {
    sessionsQuery = sessionsQuery.eq("teacher_id", user.id);
  }

  const { data: sessionsData } = await sessionsQuery;

  const sessions = (sessionsData ?? []).map((s) => {
    const hall = s.halls as unknown as { code: string } | null;
    const subject = s.subjects as unknown as { code: string } | null;
    const teacher = s.teacher_profiles as unknown as { teacher_code: string } | null;
    return {
      id: s.id,
      titleAr: s.title_ar,
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      maxCapacity: s.max_capacity,
      bookedSeatsCount: s.booked_seats_count,
      status: s.status,
      hallCode: hall?.code ?? "",
      subjectCode: subject?.code ?? "",
      teacherCode: teacher?.teacher_code ?? "",
    };
  });

  // Fetch recent check-ins for today
  const { data: checkinsData } = await supabase
    .from("bookings")
    .select(`
      id, session_id, seat_number, checked_in_at,
      profiles!bookings_student_id_fkey ( student_national_code )
    `)
    .eq("school_id", schoolId)
    .eq("status", "checked_in")
    .gte("checked_in_at", todayStart.toISOString())
    .order("checked_in_at", { ascending: false })
    .limit(50);

  const recentCheckins = (checkinsData ?? []).map((c) => {
    const studentProfile = c.profiles as unknown as {
      student_national_code: string | null;
    } | null;
    return {
      bookingId: c.id,
      studentLabel: studentProfile?.student_national_code
        ? `كود ${studentProfile.student_national_code}`
        : `كود ${c.id.slice(0, 8).toUpperCase()}`,
      seatNumber: c.seat_number,
      checkedInAt: c.checked_in_at ?? "",
      sessionId: c.session_id,
    };
  });

  return ok({ sessions, recentCheckins });
}

// ---------------------------------------------------------------------------
// verifyAndCheckinQrAction
// ---------------------------------------------------------------------------

export async function verifyAndCheckinQrAction(
  input: { schoolSlug: string; sessionId: string; rawToken: string }
): Promise<
  ActionResult<{
    result:
      | "checked_in"
      | "already_checked_in"
      | "wrong_session"
      | "invalid_token"
      | "cancelled";
    messageAr: string;
    bookingId?: string;
    seatNumber?: string | null;
    studentLabel?: string;
    checkedInAt?: string | null;
  }>
> {
  const parsed = checkinSchema.safeParse(input);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", "Invalid check-in input");
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

  const accessResult = await requireScannerOrAdmin(supabase, user.id, schoolId);
  if (!accessResult.ok) {
    return accessResult;
  }

  // Verify QR token HMAC signature locally first without constraining sessionId so wrong_session is distinguished
  const verifyResult = verifyQrToken(parsed.data.rawToken);

  if (!verifyResult.ok) {
    return ok({
      result: "invalid_token",
      messageAr: "رمز QR غير صالح أو منتهي الصلاحية",
    });
  }

  const parsedToken = verifyResult.data;
  if (parsedToken.sessionId !== parsed.data.sessionId) {
    return ok({
      result: "wrong_session",
      messageAr: "هذه التذكرة تخص قاعة أو حصة أخرى.",
      bookingId: parsedToken.bookingId,
    });
  }

  const tokenHash = hashQrToken(parsed.data.rawToken.trim());

  // Call RPC for atomic check-in
  type CheckinRpc = Database["public"]["Functions"]["verify_and_checkin_qr"];
  const rpcArgs: CheckinRpc["Args"] = {
    p_booking_id: parsedToken.bookingId,
    p_session_id: parsed.data.sessionId,
    p_qr_token_hash: tokenHash,
  };

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "verify_and_checkin_qr",
    rpcArgs
  );

  if (rpcError) {
    return err("INTERNAL_ERROR", rpcError.message);
  }

  const result = rpcResult as unknown as VerifyAndCheckinQrRpcResult;

  if (result.ok) {
    const successResult = result as Extract<VerifyAndCheckinQrRpcResult, { ok: true }>;

    // Fetch student label
    const { data: studentProfile } = await supabase
      .from("profiles")
      .select("student_national_code")
      .eq("id", successResult.student_id)
      .single();

    const studentLabel = studentProfile?.student_national_code
      ? `كود ${studentProfile.student_national_code}`
      : `كود ${successResult.student_id.slice(0, 8).toUpperCase()}`;

    return ok({
      result: "checked_in",
      messageAr: "تم تسجيل الحضور بنجاح",
      bookingId: successResult.booking_id,
      seatNumber: successResult.seat_number,
      studentLabel,
      checkedInAt: successResult.checked_in_at,
    });
  }

  const failResult = result as Extract<VerifyAndCheckinQrRpcResult, { ok: false }>;

  const resultMapping: Record<
    string,
    "already_checked_in" | "wrong_session" | "invalid_token" | "cancelled"
  > = {
    already_checked_in: "already_checked_in",
    wrong_session: "wrong_session",
    invalid_token: "invalid_token",
    cancelled: "cancelled",
    unauthenticated: "invalid_token",
    forbidden: "invalid_token",
  };

  return ok({
    result: resultMapping[failResult.result] ?? "invalid_token",
    messageAr: failResult.message_ar,
    checkedInAt: failResult.checked_in_at ?? null,
  });
}

// ---------------------------------------------------------------------------
// getOfflineManifestAction
// ---------------------------------------------------------------------------

export interface OfflineManifestEntry {
  readonly bookingId: string;
  readonly studentLabel: string;
  readonly seatNumber: string | null;
  readonly qrTokenHash: string | null;
  readonly status: string;
}

export async function getOfflineManifestAction(
  schoolSlug: string,
  sessionId: string
): Promise<ActionResult<readonly OfflineManifestEntry[]>> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "Authentication required");
  }

  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolIdFromSlug(supabase, schoolSlug);
  if (!schoolId) {
    return err("NOT_FOUND", "School not found");
  }

  const accessResult = await requireScannerOrAdmin(supabase, user.id, schoolId);
  if (!accessResult.ok) {
    return accessResult;
  }

  const { data: bookingsData } = await supabase
    .from("bookings")
    .select(`
      id, status, seat_number, qr_token_hash,
      profiles!bookings_student_id_fkey ( student_national_code )
    `)
    .eq("session_id", sessionId)
    .eq("school_id", schoolId)
    .in("status", ["confirmed", "waitlisted"])
    .order("seat_number", { ascending: true, nullsFirst: false });

  const manifest = (bookingsData ?? []).map((b) => {
    const studentProfile = b.profiles as unknown as {
      student_national_code: string | null;
    } | null;
    return {
      bookingId: b.id,
      studentLabel: studentProfile?.student_national_code
        ? `كود ${studentProfile.student_national_code}`
        : `كود ${b.id.slice(0, 8).toUpperCase()}`,
      seatNumber: b.seat_number,
      qrTokenHash: b.qr_token_hash,
      status: b.status,
    };
  });

  return ok(manifest);
}

// ---------------------------------------------------------------------------
// syncOfflineCheckinsAction
// ---------------------------------------------------------------------------

export interface OfflineSyncResult {
  readonly successCount: number;
  readonly failedCount: number;
  readonly results: readonly {
    readonly bookingId: string;
    readonly success: boolean;
    readonly error?: string;
  }[];
}

export async function syncOfflineCheckinsAction(
  input: {
    schoolSlug: string;
    sessionId: string;
    scans: readonly { bookingId: string; rawToken: string; scannedAt: string }[];
  }
): Promise<ActionResult<OfflineSyncResult>> {
  const parsed = syncOfflineSchema.safeParse(input);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", "Invalid offline sync input");
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

  const accessResult = await requireScannerOrAdmin(supabase, user.id, schoolId);
  if (!accessResult.ok) {
    return accessResult;
  }

  let successCount = 0;
  let failedCount = 0;
  const results: { bookingId: string; success: boolean; error?: string }[] = [];

  for (const scan of parsed.data.scans) {
    // Verify token
    const verifyResult = verifyQrToken(scan.rawToken, {
      expectedSessionId: parsed.data.sessionId,
      expectedBookingId: scan.bookingId,
    });

    if (!verifyResult.ok) {
      failedCount++;
      results.push({ bookingId: scan.bookingId, success: false, error: "Invalid QR token" });
      continue;
    }

    const tokenHash = hashQrToken(scan.rawToken.trim());

    type CheckinRpc = Database["public"]["Functions"]["verify_and_checkin_qr"];
    const rpcArgs: CheckinRpc["Args"] = {
      p_booking_id: scan.bookingId,
      p_session_id: parsed.data.sessionId,
      p_qr_token_hash: tokenHash,
    };

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "verify_and_checkin_qr",
      rpcArgs
    );

    if (rpcError) {
      failedCount++;
      results.push({ bookingId: scan.bookingId, success: false, error: rpcError.message });
      continue;
    }

    const checkinResult = rpcResult as unknown as VerifyAndCheckinQrRpcResult;
    if (checkinResult.ok || (checkinResult as { result?: string }).result === "already_checked_in") {
      successCount++;
      results.push({ bookingId: scan.bookingId, success: true });
    } else {
      failedCount++;
      const failData = checkinResult as Extract<VerifyAndCheckinQrRpcResult, { ok: false }>;
      results.push({ bookingId: scan.bookingId, success: false, error: failData.message_ar });
    }
  }

  return ok({ successCount, failedCount, results });
}
