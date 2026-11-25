"use server";

import { z } from "zod";
import { createSupabaseServerClient, getAuthenticatedUser } from "@/infrastructure/supabase/server";
import { ok, err, type ActionResult } from "@/domain/common/result";

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const upsertGradeSchema = z.object({
  schoolSlug: z.string().min(1),
  id: z.string().uuid().optional(),
  code: z.string().trim().min(2).max(32),
  nameAr: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120).optional(),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

const upsertTrackSchema = z.object({
  schoolSlug: z.string().min(1),
  id: z.string().uuid().optional(),
  gradeId: z.string().uuid(),
  code: z.string().trim().min(2).max(32),
  nameAr: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120).optional(),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#1E3A8A"),
  iconKey: z.string().trim().min(1).max(32).default("academic_cap"),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

const upsertSubjectSchema = z.object({
  schoolSlug: z.string().min(1),
  id: z.string().uuid().optional(),
  gradeId: z.string().uuid(),
  code: z.string().trim().min(2).max(40),
  nameAr: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120).optional(),
  subjectType: z.enum(["common", "track_core", "track_elective"]),
  electiveGroupCode: z.string().trim().min(1).max(32).nullable().optional(),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#1E3A8A"),
  isActive: z.boolean().default(true),
});

const toggleTrackSubjectSchema = z.object({
  schoolSlug: z.string().min(1),
  trackId: z.string().uuid(),
  subjectId: z.string().uuid(),
  isMandatory: z.boolean().default(true),
  electiveGroupCode: z.string().trim().min(1).max(32).nullable().optional(),
  assign: z.boolean(), // true = assign, false = remove
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
// getSchoolAdminDashboardData
// ---------------------------------------------------------------------------

export interface SchoolAdminDashboardData {
  readonly school: {
    readonly id: string;
    readonly nameAr: string;
    readonly slug: string;
    readonly isActive: boolean;
  };
  readonly grades: readonly {
    readonly id: string;
    readonly code: string;
    readonly nameAr: string;
    readonly isActive: boolean;
    readonly sortOrder: number;
  }[];
  readonly tracks: readonly {
    readonly id: string;
    readonly gradeId: string;
    readonly code: string;
    readonly nameAr: string;
    readonly colorHex: string;
    readonly isActive: boolean;
  }[];
  readonly subjects: readonly {
    readonly id: string;
    readonly gradeId: string;
    readonly code: string;
    readonly nameAr: string;
    readonly subjectType: string;
    readonly isActive: boolean;
  }[];
  readonly trackSubjects: readonly {
    readonly id: string;
    readonly trackId: string;
    readonly subjectId: string;
    readonly isMandatory: boolean;
    readonly electiveGroupCode: string | null;
  }[];
  readonly pendingTeachers: readonly {
    readonly id: string;
    readonly teacherCode: string;
    readonly specialtyAr: string;
  }[];
  readonly stats: {
    readonly totalStudents: number;
    readonly totalTeachers: number;
    readonly totalHalls: number;
    readonly activeSessionsToday: number;
  };
}

export async function getSchoolAdminDashboardData(
  schoolSlug: string
): Promise<ActionResult<SchoolAdminDashboardData>> {
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

  // Fetch school details
  const { data: schoolData } = await supabase
    .from("schools")
    .select("id, name_ar, slug, is_active")
    .eq("id", schoolId)
    .single();

  if (!schoolData) {
    return err("NOT_FOUND", "School data not found");
  }

  // Parallel fetches
  const [gradesResult, tracksResult, subjectsResult, trackSubjectsResult, pendingTeachersResult] =
    await Promise.all([
      supabase
        .from("academic_grades")
        .select("id, code, name_ar, is_active, sort_order")
        .eq("school_id", schoolId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("academic_tracks")
        .select("id, grade_id, code, name_ar, color_hex, is_active")
        .eq("school_id", schoolId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("subjects")
        .select("id, grade_id, code, name_ar, subject_type, is_active")
        .eq("school_id", schoolId)
        .order("code", { ascending: true }),
      supabase
        .from("track_subjects")
        .select("id, track_id, subject_id, is_mandatory, elective_group_code")
        .eq("school_id", schoolId),
      supabase
        .from("teacher_profiles")
        .select("id, teacher_code, specialty_ar")
        .eq("school_id", schoolId)
        .eq("is_approved", false),
    ]);

  // Stats via count queries
  const [studentsCount, teachersCount, hallsCount, todaySessionsCount] = await Promise.all([
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("role", "student")
      .eq("is_active", true),
    supabase
      .from("teacher_profiles")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("is_approved", true),
    supabase
      .from("halls")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "active"),
    supabase
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .in("status", ["scheduled", "ongoing"])
      .gte("starts_at", new Date().toISOString().slice(0, 10))
      .lt("starts_at", new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)),
  ]);

  return ok({
    school: {
      id: schoolData.id,
      nameAr: schoolData.name_ar,
      slug: schoolData.slug,
      isActive: schoolData.is_active,
    },
    grades: (gradesResult.data ?? []).map((g) => ({
      id: g.id,
      code: g.code,
      nameAr: g.name_ar,
      isActive: g.is_active,
      sortOrder: g.sort_order,
    })),
    tracks: (tracksResult.data ?? []).map((t) => ({
      id: t.id,
      gradeId: t.grade_id,
      code: t.code,
      nameAr: t.name_ar,
      colorHex: t.color_hex,
      isActive: t.is_active,
    })),
    subjects: (subjectsResult.data ?? []).map((s) => ({
      id: s.id,
      gradeId: s.grade_id,
      code: s.code,
      nameAr: s.name_ar,
      subjectType: s.subject_type,
      isActive: s.is_active,
    })),
    trackSubjects: (trackSubjectsResult.data ?? []).map((ts) => ({
      id: ts.id,
      trackId: ts.track_id,
      subjectId: ts.subject_id,
      isMandatory: ts.is_mandatory,
      electiveGroupCode: ts.elective_group_code,
    })),
    pendingTeachers: (pendingTeachersResult.data ?? []).map((t) => ({
      id: t.id,
      teacherCode: t.teacher_code,
      specialtyAr: t.specialty_ar,
    })),
    stats: {
      totalStudents: studentsCount.count ?? 0,
      totalTeachers: teachersCount.count ?? 0,
      totalHalls: hallsCount.count ?? 0,
      activeSessionsToday: todaySessionsCount.count ?? 0,
    },
  });
}

// ---------------------------------------------------------------------------
// upsertGradeAction
// ---------------------------------------------------------------------------

export async function upsertGradeAction(
  input: z.infer<typeof upsertGradeSchema>
): Promise<ActionResult<{ gradeId: string }>> {
  const parsed = upsertGradeSchema.safeParse(input);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", "Invalid grade data");
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
    name_en: parsed.data.nameEn ?? null,
    sort_order: parsed.data.sortOrder,
    is_active: parsed.data.isActive,
  };

  if (parsed.data.id) {
    const { data, error } = await supabase
      .from("academic_grades")
      .update(record)
      .eq("id", parsed.data.id)
      .eq("school_id", schoolId)
      .select("id")
      .single();

    if (error) {
      return err("INTERNAL_ERROR", error.message);
    }
    return ok({ gradeId: data?.id ?? parsed.data.id });
  } else {
    const { data, error } = await supabase
      .from("academic_grades")
      .insert(record)
      .select("id")
      .single();

    if (error) {
      return err("INTERNAL_ERROR", error.message);
    }
    if (!data) {
      return err("INTERNAL_ERROR", "Grade created but ID not returned");
    }
    return ok({ gradeId: data.id });
  }
}

// ---------------------------------------------------------------------------
// upsertTrackAction
// ---------------------------------------------------------------------------

export async function upsertTrackAction(
  input: z.infer<typeof upsertTrackSchema>
): Promise<ActionResult<{ trackId: string }>> {
  const parsed = upsertTrackSchema.safeParse(input);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", "Invalid track data");
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
    grade_id: parsed.data.gradeId,
    code: parsed.data.code,
    name_ar: parsed.data.nameAr,
    name_en: parsed.data.nameEn ?? null,
    color_hex: parsed.data.colorHex,
    icon_key: parsed.data.iconKey,
    sort_order: parsed.data.sortOrder,
    is_active: parsed.data.isActive,
  };

  if (parsed.data.id) {
    const { data, error } = await supabase
      .from("academic_tracks")
      .update(record)
      .eq("id", parsed.data.id)
      .eq("school_id", schoolId)
      .select("id")
      .single();

    if (error) {
      return err("INTERNAL_ERROR", error.message);
    }
    return ok({ trackId: data?.id ?? parsed.data.id });
  } else {
    const { data, error } = await supabase
      .from("academic_tracks")
      .insert(record)
      .select("id")
      .single();

    if (error) {
      return err("INTERNAL_ERROR", error.message);
    }
    if (!data) {
      return err("INTERNAL_ERROR", "Track created but ID not returned");
    }
    return ok({ trackId: data.id });
  }
}

// ---------------------------------------------------------------------------
// upsertSubjectAction
// ---------------------------------------------------------------------------

export async function upsertSubjectAction(
  input: z.infer<typeof upsertSubjectSchema>
): Promise<ActionResult<{ subjectId: string }>> {
  const parsed = upsertSubjectSchema.safeParse(input);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", "Invalid subject data");
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
    grade_id: parsed.data.gradeId,
    code: parsed.data.code,
    name_ar: parsed.data.nameAr,
    name_en: parsed.data.nameEn ?? null,
    subject_type: parsed.data.subjectType,
    elective_group_code: parsed.data.electiveGroupCode ?? null,
    color_hex: parsed.data.colorHex,
    is_active: parsed.data.isActive,
  };

  if (parsed.data.id) {
    const { data, error } = await supabase
      .from("subjects")
      .update(record)
      .eq("id", parsed.data.id)
      .eq("school_id", schoolId)
      .select("id")
      .single();

    if (error) {
      return err("INTERNAL_ERROR", error.message);
    }
    return ok({ subjectId: data?.id ?? parsed.data.id });
  } else {
    const { data, error } = await supabase
      .from("subjects")
      .insert(record)
      .select("id")
      .single();

    if (error) {
      return err("INTERNAL_ERROR", error.message);
    }
    if (!data) {
      return err("INTERNAL_ERROR", "Subject created but ID not returned");
    }
    return ok({ subjectId: data.id });
  }
}

// ---------------------------------------------------------------------------
// toggleTrackSubjectAction
// ---------------------------------------------------------------------------

export async function toggleTrackSubjectAction(
  input: z.infer<typeof toggleTrackSubjectSchema>
): Promise<ActionResult<{ assigned: boolean }>> {
  const parsed = toggleTrackSubjectSchema.safeParse(input);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", "Invalid track-subject assignment data");
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

  if (parsed.data.assign) {
    const { error } = await supabase
      .from("track_subjects")
      .upsert(
        {
          school_id: schoolId,
          track_id: parsed.data.trackId,
          subject_id: parsed.data.subjectId,
          is_mandatory: parsed.data.isMandatory,
          elective_group_code: parsed.data.electiveGroupCode ?? null,
        },
        { onConflict: "track_id,subject_id" }
      );

    if (error) {
      return err("INTERNAL_ERROR", error.message);
    }
    return ok({ assigned: true });
  } else {
    const { error } = await supabase
      .from("track_subjects")
      .delete()
      .eq("track_id", parsed.data.trackId)
      .eq("subject_id", parsed.data.subjectId)
      .eq("school_id", schoolId);

    if (error) {
      return err("INTERNAL_ERROR", error.message);
    }
    return ok({ assigned: false });
  }
}
