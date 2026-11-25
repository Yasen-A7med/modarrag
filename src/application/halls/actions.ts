"use server";

import { z } from "zod";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  getAuthenticatedUser,
} from "@/infrastructure/supabase/server";
import { ok, err, type ActionResult } from "@/domain/common/result";
import type { HallStatus, Json } from "@/infrastructure/supabase/database.types";

const jsonValueSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ])
);

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const upsertHallSchema = z.object({
  schoolSlug: z.string().min(1),
  id: z.string().uuid().optional(),
  code: z.string().trim().min(1).max(20),
  nameAr: z.string().trim().min(1).max(120),
  buildingAr: z.string().trim().min(1).max(80).optional(),
  floorLabelAr: z.string().trim().min(1).max(40).optional(),
  maxCapacity: z.number().int().min(1).max(2000),
  status: z.enum(["active", "maintenance", "archived"]).default("active"),
  amenities: z.record(z.string(), jsonValueSchema).default({}),
});

const updateHallStatusSchema = z.object({
  schoolSlug: z.string().min(1),
  hallId: z.string().uuid(),
  status: z.enum(["active", "maintenance", "archived"]),
});

const reallocateHallSchema = z.object({
  schoolSlug: z.string().min(1),
  sessionId: z.string().uuid(),
  newHallId: z.string().uuid(),
});

const approveTeacherSchema = z.object({
  schoolSlug: z.string().min(1),
  teacherId: z.string().uuid(),
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

async function requireSchoolAdmin(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  schoolId: string
): Promise<ActionResult<{ userId: string }>> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", userId)
    .single();

  if (!profile || profile.role !== "school_admin" || profile.school_id !== schoolId) {
    return err("FORBIDDEN", "School admin access required");
  }

  return ok({ userId });
}

// ---------------------------------------------------------------------------
// getHallOccupancyData
// ---------------------------------------------------------------------------

export interface HallOccupancyData {
  readonly halls: readonly {
    readonly id: string;
    readonly code: string;
    readonly nameAr: string;
    readonly buildingAr: string | null;
    readonly floorLabelAr: string | null;
    readonly maxCapacity: number;
    readonly status: HallStatus;
    readonly currentSessionId: string | null;
    readonly currentSessionTitleAr: string | null;
    readonly currentBookedCount: number;
  }[];
}

export async function getHallOccupancyData(
  schoolSlug: string
): Promise<ActionResult<HallOccupancyData>> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "Authentication required");
  }

  const supabase = await createSupabaseServerClient();
  const schoolId = await resolveSchoolIdFromSlug(supabase, schoolSlug);
  if (!schoolId) {
    return err("NOT_FOUND", "School not found");
  }

  const adminResult = await requireSchoolAdmin(supabase, user.id, schoolId);
  if (!adminResult.ok) {
    return adminResult;
  }

  const { data: hallsData } = await supabase
    .from("halls")
    .select("id, code, name_ar, building_ar, floor_label_ar, max_capacity, status")
    .eq("school_id", schoolId)
    .order("code", { ascending: true });

  const now = new Date().toISOString();
  const { data: activeSessions } = await supabase
    .from("sessions")
    .select("id, hall_id, title_ar, booked_seats_count")
    .eq("school_id", schoolId)
    .in("status", ["scheduled", "ongoing"])
    .lte("starts_at", now)
    .gte("ends_at", now);

  const sessionByHall = new Map<
    string,
    { id: string; title_ar: string; booked_seats_count: number }
  >();
  for (const s of activeSessions ?? []) {
    if (!sessionByHall.has(s.hall_id)) {
      sessionByHall.set(s.hall_id, {
        id: s.id,
        title_ar: s.title_ar,
        booked_seats_count: s.booked_seats_count,
      });
    }
  }

  const halls = (hallsData ?? []).map((h) => {
    const activeSession = sessionByHall.get(h.id);
    return {
      id: h.id,
      code: h.code,
      nameAr: h.name_ar,
      buildingAr: h.building_ar,
      floorLabelAr: h.floor_label_ar,
      maxCapacity: h.max_capacity,
      status: h.status as HallStatus,
      currentSessionId: activeSession?.id ?? null,
      currentSessionTitleAr: activeSession?.title_ar ?? null,
      currentBookedCount: activeSession?.booked_seats_count ?? 0,
    };
  });

  return ok({ halls });
}

// ---------------------------------------------------------------------------
// upsertHallAction
// ---------------------------------------------------------------------------

export async function upsertHallAction(
  input: z.infer<typeof upsertHallSchema>
): Promise<ActionResult<{ hallId: string }>> {
  const parsed = upsertHallSchema.safeParse(input);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", "Invalid hall data");
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

  const adminResult = await requireSchoolAdmin(supabase, user.id, schoolId);
  if (!adminResult.ok) {
    return adminResult;
  }

  const record = {
    school_id: schoolId,
    code: parsed.data.code,
    name_ar: parsed.data.nameAr,
    building_ar: parsed.data.buildingAr ?? null,
    floor_label_ar: parsed.data.floorLabelAr ?? null,
    max_capacity: parsed.data.maxCapacity,
    status: parsed.data.status as HallStatus,
    amenities: parsed.data.amenities,
  };

  if (parsed.data.id) {
    const { data, error } = await supabase
      .from("halls")
      .update(record)
      .eq("id", parsed.data.id)
      .eq("school_id", schoolId)
      .select("id")
      .single();

    if (error) {
      return err("INTERNAL_ERROR", error.message);
    }
    return ok({ hallId: data?.id ?? parsed.data.id });
  } else {
    const { data, error } = await supabase
      .from("halls")
      .insert(record)
      .select("id")
      .single();

    if (error) {
      return err("INTERNAL_ERROR", error.message);
    }
    if (!data) {
      return err("INTERNAL_ERROR", "Hall created but ID not returned");
    }
    return ok({ hallId: data.id });
  }
}

// ---------------------------------------------------------------------------
// updateHallStatusAction
// ---------------------------------------------------------------------------

export async function updateHallStatusAction(
  input: z.infer<typeof updateHallStatusSchema>
): Promise<ActionResult<{ updated: true }>> {
  const parsed = updateHallStatusSchema.safeParse(input);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", "Invalid hall status update");
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

  const adminResult = await requireSchoolAdmin(supabase, user.id, schoolId);
  if (!adminResult.ok) {
    return adminResult;
  }

  // If archiving/putting into maintenance, check for upcoming sessions
  if (parsed.data.status !== "active") {
    const { count } = await supabase
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("hall_id", parsed.data.hallId)
      .eq("school_id", schoolId)
      .in("status", ["scheduled"])
      .gte("starts_at", new Date().toISOString());

    if ((count ?? 0) > 0) {
      return err(
        "CONFLICT",
        `يوجد ${count} حصص مجدولة في هذه القاعة. يرجى إعادة تخصيص أو إلغاء الحصص أولاً.`
      );
    }
  }

  const { error } = await supabase
    .from("halls")
    .update({ status: parsed.data.status as HallStatus })
    .eq("id", parsed.data.hallId)
    .eq("school_id", schoolId);

  if (error) {
    return err("INTERNAL_ERROR", error.message);
  }

  return ok({ updated: true });
}

// ---------------------------------------------------------------------------
// reallocateSessionHallAction
// ---------------------------------------------------------------------------

export async function reallocateSessionHallAction(
  input: z.infer<typeof reallocateHallSchema>
): Promise<ActionResult<{ updated: true }>> {
  const parsed = reallocateHallSchema.safeParse(input);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", "Invalid reallocation input");
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

  const adminResult = await requireSchoolAdmin(supabase, user.id, schoolId);
  if (!adminResult.ok) {
    return adminResult;
  }

  // Verify session exists and belongs to this school
  const { data: session } = await supabase
    .from("sessions")
    .select("id, status, hall_id, starts_at, ends_at, buffer_minutes")
    .eq("id", parsed.data.sessionId)
    .eq("school_id", schoolId)
    .single();

  if (!session) {
    return err("NOT_FOUND", "Session not found");
  }

  if (session.status === "cancelled" || session.status === "completed") {
    return err("CONFLICT", "Cannot reallocate a cancelled or completed session");
  }

  // Verify new hall is active and belongs to this school
  const { data: newHall } = await supabase
    .from("halls")
    .select("id, max_capacity, status")
    .eq("id", parsed.data.newHallId)
    .eq("school_id", schoolId)
    .single();

  if (!newHall || newHall.status !== "active") {
    return err("NOT_FOUND", "Target hall is not available");
  }

  // Update session hall
  const { error } = await supabase
    .from("sessions")
    .update({ hall_id: parsed.data.newHallId })
    .eq("id", parsed.data.sessionId);

  if (error) {
    if (error.code === "23P01") {
      return err(
        "SCHEDULE_CONFLICT",
        "القاعة المحددة مشغولة في هذا الوقت. اختر قاعة أخرى."
      );
    }
    return err("INTERNAL_ERROR", error.message);
  }

  return ok({ updated: true });
}

// ---------------------------------------------------------------------------
// approveTeacherAction
// ---------------------------------------------------------------------------

export async function approveTeacherAction(
  input: z.infer<typeof approveTeacherSchema>
): Promise<ActionResult<{ approved: true }>> {
  const parsed = approveTeacherSchema.safeParse(input);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", "Invalid teacher approval data");
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

  const adminResult = await requireSchoolAdmin(supabase, user.id, schoolId);
  if (!adminResult.ok) {
    return adminResult;
  }

  const { data: teacherProfile } = await supabase
    .from("teacher_profiles")
    .select("id, is_approved")
    .eq("id", parsed.data.teacherId)
    .eq("school_id", schoolId)
    .single();

  if (!teacherProfile) {
    return err("NOT_FOUND", "Teacher profile not found");
  }

  if (teacherProfile.is_approved) {
    return err("CONFLICT", "Teacher is already approved");
  }

  const { error } = await supabase
    .from("teacher_profiles")
    .update({
      is_approved: true,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.teacherId)
    .eq("school_id", schoolId);

  if (error) {
    return err("INTERNAL_ERROR", error.message);
  }

  // Notify the teacher via privileged admin client (notifications table forbids direct client INSERT)
  const adminClient = createSupabaseAdminClient();
  if (adminClient) {
    await adminClient.from("notifications").insert({
      school_id: schoolId,
      recipient_id: parsed.data.teacherId,
      type: "teacher_approved",
      title_ar: "تمت الموافقة على حسابك",
      body_ar: "تهانينا! تمت الموافقة على حسابك كمعلم ويمكنك الآن إنشاء الحصص.",
      metadata: { approvedBy: user.id },
    });
  }

  return ok({ approved: true });
}
