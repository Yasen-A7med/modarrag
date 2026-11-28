"use server";

import { z } from "zod";
import { EGYPT_K12_EXTRA_GRADES } from "@/domain/academic/k12";
import { calculateSessionRevenueBreakdown } from "@/domain/finance/revenue";
import { createSupabaseServerClient, getAuthenticatedUser } from "@/infrastructure/supabase/server";
import { ok, err, type ActionResult } from "@/domain/common/result";

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const createSchoolSchema = z.object({
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  nameAr: z.string().trim().min(2).max(120),
  nameEn: z.string().trim().min(2).max(120),
  governorate: z.string().trim().min(1).max(80),
  directorate: z.string().trim().min(1).max(80),
  tenantType: z.enum(["school", "center"]).default("school"),
  brandColorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#1E3A8A"),
  logoUrl: z
    .string()
    .trim()
    .min(1)
    .refine(
      (val) => val.startsWith("/") || val.startsWith("https://") || val.startsWith("http://"),
      "Logo must be a valid URL or root-relative path"
    )
    .optional(),
  defaultBufferMinutes: z.number().int().min(0).max(60).default(15),
  withBaccalaureateTemplate: z.boolean().default(false),
  withK12Template: z.boolean().default(false),
});

const getAuditLogsSchema = z.object({
  schoolId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
  action: z.string().trim().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireSuperAdmin(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
): Promise<ActionResult<{ userId: string }>> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!profile || profile.role !== "super_admin") {
    return err("FORBIDDEN", "Super admin access required");
  }

  return ok({ userId });
}

// ---------------------------------------------------------------------------
// getSuperAdminConsoleData
// ---------------------------------------------------------------------------

export interface SuperAdminConsoleData {
  readonly schools: readonly {
    readonly id: string;
    readonly slug: string;
    readonly nameAr: string;
    readonly nameEn: string;
    readonly governorate: string;
    readonly tenantType: "school" | "center";
    readonly teacherSharePct: number;
    readonly platformFeePct: number;
    readonly vatRatePct: number;
    readonly isActive: boolean;
    readonly createdAt: string;
  }[];
  readonly kpis: {
    readonly totalSchools: number;
    readonly totalStudents: number;
    readonly totalTeachers: number;
    readonly totalBookingsToday: number;
    readonly totalCheckinsToday: number;
  };
  readonly financials: {
    readonly totalGrossRevenueEgp: number;
    readonly totalPlatformEarningsEgp: number;
    readonly totalVatCollectedEgp: number;
    readonly totalPrintCommissionEgp: number;
    readonly printOrdersCount: number;
    readonly onlineSessionsCount: number;
  };
}

export async function getSuperAdminConsoleData(): Promise<ActionResult<SuperAdminConsoleData>> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "Authentication required");
  }

  const supabase = await createSupabaseServerClient();
  const adminResult = await requireSuperAdmin(supabase, user.id);
  if (!adminResult.ok) {
    return adminResult;
  }

  const [
    schoolsResult,
    studentsCount,
    teachersCount,
    bookingsTodayCount,
    checkinsTodayCount,
    sessionsFinanceResult,
    printOrdersFinanceResult,
  ] = await Promise.all([
    supabase
      .from("schools")
      .select("id, slug, name_ar, name_en, governorate, tenant_type, teacher_share_pct, platform_fee_pct, vat_rate_pct, is_active, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "student")
      .eq("is_active", true),
    supabase
      .from("teacher_profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_approved", true),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .gte("booked_at", new Date().toISOString().slice(0, 10)),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("status", "checked_in")
      .gte("checked_in_at", new Date().toISOString().slice(0, 10)),
    supabase
      .from("sessions")
      .select("school_id, price_egp, booked_seats_count, delivery_mode, status")
      .neq("status", "cancelled"),
    supabase
      .from("print_orders")
      .select("platform_commission_egp, status")
      .neq("status", "cancelled"),
  ]);

  const schoolPolicyById = new Map<
    string,
    { teacherPct: number; platformPct: number; vatPct: number }
  >();

  const schools = (schoolsResult.data ?? []).map((s) => {
    schoolPolicyById.set(s.id, {
      teacherPct: s.teacher_share_pct ?? 70,
      platformPct: s.platform_fee_pct ?? 30,
      vatPct: s.vat_rate_pct ?? 14,
    });
    return {
      id: s.id,
      slug: s.slug,
      nameAr: s.name_ar,
      nameEn: s.name_en,
      governorate: s.governorate,
      tenantType: s.tenant_type ?? "school",
      teacherSharePct: s.teacher_share_pct ?? 70,
      platformFeePct: s.platform_fee_pct ?? 30,
      vatRatePct: s.vat_rate_pct ?? 14,
      isActive: s.is_active,
      createdAt: s.created_at,
    };
  });

  let totalGrossRevenueEgp = 0;
  let totalPlatformEarningsEgp = 0;
  let totalVatCollectedEgp = 0;
  let onlineSessionsCount = 0;

  for (const s of sessionsFinanceResult.data ?? []) {
    if (s.delivery_mode === "online") onlineSessionsCount += 1;
    if ((s.price_egp ?? 0) <= 0) continue;
    const pol = schoolPolicyById.get(s.school_id) ?? {
      teacherPct: 70,
      platformPct: 30,
      vatPct: 14,
    };
    const b = calculateSessionRevenueBreakdown({
      priceEgp: s.price_egp,
      seatCount: s.booked_seats_count ?? 0,
      vatRatePct: pol.vatPct,
      teacherSharePct: pol.teacherPct,
      platformFeePct: pol.platformPct,
    });
    totalGrossRevenueEgp += b.grossStudentTotalEgp;
    totalPlatformEarningsEgp += b.platformNetEgp;
    totalVatCollectedEgp += b.vatCollectedEgp;
  }

  const totalPrintCommissionEgp = (printOrdersFinanceResult.data ?? []).reduce(
    (acc, o) => acc + (o.platform_commission_egp ?? 0),
    0
  );

  return ok({
    schools,
    kpis: {
      totalSchools: schools.length,
      totalStudents: studentsCount.count ?? 0,
      totalTeachers: teachersCount.count ?? 0,
      totalBookingsToday: bookingsTodayCount.count ?? 0,
      totalCheckinsToday: checkinsTodayCount.count ?? 0,
    },
    financials: {
      totalGrossRevenueEgp,
      totalPlatformEarningsEgp,
      totalVatCollectedEgp,
      totalPrintCommissionEgp,
      printOrdersCount: (printOrdersFinanceResult.data ?? []).length,
      onlineSessionsCount,
    },
  });
}

// ---------------------------------------------------------------------------
// createSchoolTenantAction
// ---------------------------------------------------------------------------

// Baccalaureate track template data
const BACCALAUREATE_TRACKS = [
  { code: "ENGINEERING", nameAr: "الهندسة والتكنولوجيا", nameEn: "Engineering & Technology", colorHex: "#1E3A8A", iconKey: "circuit_board", sortOrder: 1 },
  { code: "MEDICINE_LIFE", nameAr: "الطب وعلوم الحياة", nameEn: "Medicine & Life Sciences", colorHex: "#065F46", iconKey: "flask", sortOrder: 2 },
  { code: "BUSINESS", nameAr: "الاقتصاد والأعمال", nameEn: "Business & Economics", colorHex: "#78350F", iconKey: "chart_bar", sortOrder: 3 },
  { code: "ARTS_HUMANITIES", nameAr: "الآداب والعلوم الإنسانية", nameEn: "Arts & Humanities", colorHex: "#581C87", iconKey: "book_open", sortOrder: 4 },
] as const;

const BACCALAUREATE_GRADE = {
  code: "SEC_2_BACC",
  nameAr: "الثانوية العامة — البكالوريا",
  nameEn: "Secondary Year 2 — Baccalaureate",
  sortOrder: 1,
};

const COMMON_SUBJECTS = [
  { code: "ARABIC", nameAr: "اللغة العربية", nameEn: "Arabic Language", colorHex: "#1E3A8A" },
  { code: "ENGLISH", nameAr: "اللغة الإنجليزية", nameEn: "English Language", colorHex: "#0F766E" },
  { code: "RELIGION", nameAr: "التربية الإسلامية", nameEn: "Islamic Education", colorHex: "#065F46" },
  { code: "NATIONAL", nameAr: "التربية الوطنية", nameEn: "National Education", colorHex: "#78350F" },
] as const;

export async function createSchoolTenantAction(
  input: z.input<typeof createSchoolSchema>
): Promise<ActionResult<{ schoolId: string; slug: string }>> {
  const parsed = createSchoolSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      const existing = fieldErrors[key];
      fieldErrors[key] = existing ? [...existing, issue.message] : [issue.message];
    }
    return err("VALIDATION_ERROR", "Invalid school data", { fieldErrors });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "Authentication required");
  }

  const supabase = await createSupabaseServerClient();
  const adminResult = await requireSuperAdmin(supabase, user.id);
  if (!adminResult.ok) {
    return adminResult;
  }

  // Check slug uniqueness
  const { data: existingSchool } = await supabase
    .from("schools")
    .select("id")
    .eq("slug", parsed.data.slug)
    .maybeSingle();

  if (existingSchool) {
    return err("CONFLICT", "A school with this slug already exists");
  }

  // Create school
  const { data: schoolData, error: schoolError } = await supabase
    .from("schools")
    .insert({
      slug: parsed.data.slug,
      name_ar: parsed.data.nameAr,
      name_en: parsed.data.nameEn,
      governorate: parsed.data.governorate,
      directorate: parsed.data.directorate,
      tenant_type: parsed.data.tenantType,
      brand_color_hex: parsed.data.brandColorHex,
      logo_url: parsed.data.logoUrl ?? null,
      default_buffer_minutes: parsed.data.defaultBufferMinutes,
    })
    .select("id")
    .single();

  if (schoolError || !schoolData) {
    return err("INTERNAL_ERROR", schoolError?.message ?? "Failed to create school");
  }

  const schoolId = schoolData.id;

  // If Baccalaureate template requested, seed grade + tracks + common subjects
  if (parsed.data.withBaccalaureateTemplate) {
    const { data: gradeData } = await supabase
      .from("academic_grades")
      .insert({
        school_id: schoolId,
        code: BACCALAUREATE_GRADE.code,
        name_ar: BACCALAUREATE_GRADE.nameAr,
        name_en: BACCALAUREATE_GRADE.nameEn,
        sort_order: 11,
      })
      .select("id")
      .single();

    if (gradeData) {
      const gradeId = gradeData.id;

      for (const track of BACCALAUREATE_TRACKS) {
        await supabase.from("academic_tracks").insert({
          school_id: schoolId,
          grade_id: gradeId,
          code: track.code,
          name_ar: track.nameAr,
          name_en: track.nameEn,
          color_hex: track.colorHex,
          icon_key: track.iconKey,
          sort_order: track.sortOrder,
        });
      }

      for (const subject of COMMON_SUBJECTS) {
        await supabase.from("subjects").insert({
          school_id: schoolId,
          grade_id: gradeId,
          code: subject.code,
          name_ar: subject.nameAr,
          name_en: subject.nameEn,
          subject_type: "common",
          color_hex: subject.colorHex,
        });
      }
    }
  }

  // If full Egyptian K-12 stage template requested, seed Primary 1..6, Prep 1..3, Sec 1, Sec 3
  if (parsed.data.withK12Template) {
    for (const stageGrade of EGYPT_K12_EXTRA_GRADES) {
      const { data: gRow } = await supabase
        .from("academic_grades")
        .insert({
          school_id: schoolId,
          code: stageGrade.code,
          name_ar: stageGrade.nameAr,
          name_en: stageGrade.nameEn,
          sort_order: stageGrade.sortOrder,
        })
        .select("id")
        .single();

      if (!gRow) continue;

      const { data: tRow } = await supabase
        .from("academic_tracks")
        .insert({
          school_id: schoolId,
          grade_id: gRow.id,
          code: stageGrade.defaultTrackCode,
          name_ar: stageGrade.defaultTrackNameAr,
          name_en: stageGrade.defaultTrackCode,
          color_hex: "#2563EB",
          icon_key: "book-open",
          sort_order: 1,
        })
        .select("id")
        .single();

      for (const subj of stageGrade.coreSubjects) {
        const { data: sRow } = await supabase
          .from("subjects")
          .insert({
            school_id: schoolId,
            grade_id: gRow.id,
            code: subj.code,
            name_ar: subj.nameAr,
            name_en: subj.code,
            subject_type: "common",
            color_hex: "#1E3A8A",
          })
          .select("id")
          .single();

        if (tRow && sRow) {
          await supabase.from("track_subjects").insert({
            school_id: schoolId,
            track_id: tRow.id,
            subject_id: sRow.id,
            is_mandatory: true,
          });
        }
      }
    }
  }

  return ok({ schoolId, slug: parsed.data.slug });
}

// ---------------------------------------------------------------------------
// getAuditLogs
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  readonly id: string;
  readonly schoolId: string | null;
  readonly actorId: string | null;
  readonly actorLabel: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly details: unknown;
  readonly createdAt: string;
}

export async function getAuditLogs(
  input: z.infer<typeof getAuditLogsSchema>
): Promise<ActionResult<readonly AuditLogEntry[]>> {
  const parsed = getAuditLogsSchema.safeParse(input);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", "Invalid audit log query");
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "Authentication required");
  }

  const supabase = await createSupabaseServerClient();
  const adminResult = await requireSuperAdmin(supabase, user.id);
  if (!adminResult.ok) {
    return adminResult;
  }

  let query = supabase
    .from("audit_logs")
    .select(`
      id, school_id, actor_id, action, entity_type, entity_id, details, created_at,
      profiles!audit_logs_actor_id_fkey ( role, student_national_code )
    `)
    .order("created_at", { ascending: false })
    .range(parsed.data.offset, parsed.data.offset + parsed.data.limit - 1);

  if (parsed.data.schoolId) {
    query = query.eq("school_id", parsed.data.schoolId);
  }

  if (parsed.data.action) {
    query = query.eq("action", parsed.data.action);
  }

  const { data: logsData, error } = await query;

  if (error) {
    return err("INTERNAL_ERROR", error.message);
  }

  const logs = (logsData ?? []).map((log) => {
    const actor = log.profiles as unknown as {
      role: string;
      student_national_code: string | null;
    } | null;

    const actorLabel = actor
      ? actor.student_national_code
        ? `كود ${actor.student_national_code} (${actor.role})`
        : `${actor.role} · ${log.actor_id?.slice(0, 8).toUpperCase() ?? "system"}`
      : "system";

    return {
      id: log.id,
      schoolId: log.school_id,
      actorId: log.actor_id,
      actorLabel,
      action: log.action,
      entityType: log.entity_type,
      entityId: log.entity_id,
      details: log.details,
      createdAt: log.created_at,
    };
  });

  return ok(logs);
}
