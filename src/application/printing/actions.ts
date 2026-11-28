"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ok, err, type ActionResult } from "@/domain/common/result";
import {
  calculatePrintOrderPricing,
  DEFAULT_PRINT_COMMISSION_PCT,
  DEFAULT_VAT_RATE_PCT,
} from "@/domain/finance/revenue";
import type {
  PrintBindingType,
  PrintOrderStatus,
  PrintSpec,
} from "@/infrastructure/supabase/database.types";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  getAuthenticatedUser,
} from "@/infrastructure/supabase/server";

const createPrintOrderSchema = z.object({
  schoolSlug: z.string().trim().min(1),
  partnerId: z.string().uuid("يرجى اختيار المطبعة المعتمدة."),
  sessionId: z.string().uuid().nullable().optional(),
  titleAr: z.string().trim().min(2, "اكتب عنوان المذكرة أو الملزمة.").max(140),
  copiesCount: z.number().int().min(1).max(5000),
  pagesCount: z.number().int().min(1).max(1000),
  printSpecs: z.enum(["bw_single", "bw_double", "color"]),
  bindingType: z.enum(["none", "staple", "spiral"]),
  fileStoragePath: z.string().trim().max(400).nullable().optional(),
  externalFileUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || v.startsWith("https://"), "يجب أن يبدأ رابط الملف بـ https://")
    .nullable()
    .optional(),
  notesAr: z.string().trim().max(300).nullable().optional(),
});

const updatePrintOrderStatusSchema = z.object({
  schoolSlug: z.string().trim().min(1),
  orderId: z.string().uuid(),
  status: z.enum(["pending", "printing", "ready", "delivered", "cancelled"]),
});

const upsertPrintPartnerSchema = z.object({
  schoolSlug: z.string().trim().min(1),
  nameAr: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(30),
  whatsappNumber: z.string().trim().max(30).nullable().optional(),
  addressAr: z.string().trim().max(240).nullable().optional(),
  commissionPct: z.number().int().min(0).max(50).default(15),
});

export interface PrintPartnerItem {
  readonly id: string;
  readonly nameAr: string;
  readonly phone: string;
  readonly whatsappNumber: string | null;
  readonly addressAr: string | null;
  readonly commissionPct: number;
  readonly isActive: boolean;
}

export interface PrintOrderItem {
  readonly id: string;
  readonly partnerId: string;
  readonly partnerNameAr: string;
  readonly partnerPhone: string;
  readonly sessionId: string | null;
  readonly sessionTitleAr: string | null;
  readonly titleAr: string;
  readonly fileStoragePath: string | null;
  readonly externalFileUrl: string | null;
  readonly copiesCount: number;
  readonly pagesCount: number;
  readonly printSpecs: PrintSpec;
  readonly bindingType: PrintBindingType;
  readonly subtotalEgp: number;
  readonly vatEgp: number;
  readonly totalEgp: number;
  readonly platformCommissionEgp: number;
  readonly status: PrintOrderStatus;
  readonly notesAr: string | null;
  readonly createdAt: string;
}

export interface PrintCenterData {
  readonly schoolId: string;
  readonly schoolNameAr: string;
  readonly vatRatePct: number;
  readonly teacherId: string;
  readonly role: string;
  readonly partners: readonly PrintPartnerItem[];
  readonly orders: readonly PrintOrderItem[];
  readonly teacherSessions: readonly {
    readonly id: string;
    readonly titleAr: string;
    readonly startsAt: string;
  }[];
  readonly summary: {
    readonly totalOrders: number;
    readonly activeOrders: number;
    readonly totalSpentEgp: number;
    readonly totalCommissionEgp: number;
  };
}

export async function getPrintCenterData(
  schoolSlug: string
): Promise<ActionResult<PrintCenterData>> {
  const user = await getAuthenticatedUser();
  if (!user) return err("UNAUTHORIZED", "يرجى تسجيل الدخول أولاً.");

  const supabase = await createSupabaseServerClient();
  const { data: school } = await supabase
    .from("schools")
    .select("id, name_ar, vat_rate_pct")
    .eq("slug", schoolSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (!school) return err("NOT_FOUND", "المدرسة غير موجودة.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .maybeSingle();

  const canAccess =
    profile &&
    (profile.role === "super_admin" ||
      ((profile.role === "teacher" || profile.role === "school_admin") &&
        profile.school_id === school.id));

  if (!canAccess) {
    return err("FORBIDDEN", "مركز الطباعة متاح للمعلمين وإدارة المدرسة فقط.");
  }

  const [{ data: partnersData }, { data: ordersData }, { data: sessionsData }] = await Promise.all([
    supabase
      .from("print_partners")
      .select("id, name_ar, phone, whatsapp_number, address_ar, commission_pct, is_active")
      .or(`school_id.eq.${school.id},school_id.is.null`)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("print_orders")
      .select(
        `
        id, partner_id, session_id, title_ar, file_storage_path, external_file_url,
        copies_count, pages_count, print_specs, binding_type,
        subtotal_egp, vat_egp, total_egp, platform_commission_egp, status, notes_ar, created_at
      `
      )
      .eq("school_id", school.id)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("sessions")
      .select("id, title_ar, starts_at")
      .eq("school_id", school.id)
      .in("status", ["scheduled", "full", "ongoing"])
      .order("starts_at", { ascending: true })
      .limit(40),
  ]);

  const partnersById = new Map<string, { nameAr: string; phone: string }>();
  const partners: PrintPartnerItem[] = (partnersData ?? []).map((p) => {
    partnersById.set(p.id, { nameAr: p.name_ar, phone: p.phone });
    return {
      id: p.id,
      nameAr: p.name_ar,
      phone: p.phone,
      whatsappNumber: p.whatsapp_number,
      addressAr: p.address_ar,
      commissionPct: p.commission_pct,
      isActive: p.is_active,
    };
  });

  const sessionMap = new Map<string, string>();
  for (const s of sessionsData ?? []) {
    sessionMap.set(s.id, s.title_ar);
  }

  const orders: PrintOrderItem[] = (ordersData ?? []).map((o) => {
    const partner = partnersById.get(o.partner_id);
    return {
      id: o.id,
      partnerId: o.partner_id,
      partnerNameAr: partner?.nameAr ?? "مطبعة معتمدة",
      partnerPhone: partner?.phone ?? "",
      sessionId: o.session_id,
      sessionTitleAr: o.session_id ? (sessionMap.get(o.session_id) ?? null) : null,
      titleAr: o.title_ar,
      fileStoragePath: o.file_storage_path,
      externalFileUrl: o.external_file_url,
      copiesCount: o.copies_count,
      pagesCount: o.pages_count,
      printSpecs: o.print_specs,
      bindingType: o.binding_type,
      subtotalEgp: o.subtotal_egp,
      vatEgp: o.vat_egp,
      totalEgp: o.total_egp,
      platformCommissionEgp: o.platform_commission_egp,
      status: o.status,
      notesAr: o.notes_ar,
      createdAt: o.created_at,
    };
  });

  const validOrders = orders.filter((o) => o.status !== "cancelled");

  const totalSpentEgp = validOrders.reduce((acc, o) => acc + o.totalEgp, 0);
  const totalCommissionEgp = validOrders.reduce(
    (acc, o) => acc + o.platformCommissionEgp,
    0
  );

  return ok({
    schoolId: school.id,
    schoolNameAr: school.name_ar,
    vatRatePct: school.vat_rate_pct ?? DEFAULT_VAT_RATE_PCT,
    teacherId: user.id,
    role: profile.role,
    partners,
    orders,
    teacherSessions: (sessionsData ?? []).map((s) => ({
      id: s.id,
      titleAr: s.title_ar,
      startsAt: s.starts_at,
    })),
    summary: {
      totalOrders: orders.length,
      activeOrders: orders.filter((o) => o.status === "pending" || o.status === "printing" || o.status === "ready").length,
      totalSpentEgp,
      totalCommissionEgp,
    },
  });
}

export async function createHandoutUploadIntentAction(input: {
  schoolSlug: string;
  fileName: string;
}): Promise<ActionResult<{ storagePath: string; signedUrl: string }>> {
  const user = await getAuthenticatedUser();
  if (!user) return err("UNAUTHORIZED", "يرجى تسجيل الدخول أولاً.");

  const supabase = await createSupabaseServerClient();
  const { data: school } = await supabase
    .from("schools")
    .select("id")
    .eq("slug", input.schoolSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (!school) return err("NOT_FOUND", "المدرسة غير موجودة.");

  const { data: teacherProfile } = await supabase
    .from("teacher_profiles")
    .select("id, is_approved")
    .eq("id", user.id)
    .eq("school_id", school.id)
    .maybeSingle();

  if (!teacherProfile?.is_approved) {
    return err("FORBIDDEN", "يتطلب رفع الملفات حساب معلم معتمد.");
  }

  const extRaw = input.fileName.split(".").pop()?.toLowerCase() ?? "pdf";
  const safeExt = ["pdf", "docx", "png", "jpg", "jpeg"].includes(extRaw) ? extRaw : "pdf";
  const path = `${school.id}/${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${safeExt}`;

  const { data, error } = await supabase.storage
    .from("handouts")
    .createSignedUploadUrl(path);

  if (error || !data) {
    return err("INTERNAL_ERROR", error?.message ?? "تعذر تجهيز رابط الرفع.");
  }

  return ok({ storagePath: data.path, signedUrl: data.signedUrl });
}

export async function createPrintOrderAction(
  input: z.infer<typeof createPrintOrderSchema>
): Promise<ActionResult<{ orderId: string; totalEgp: number }>> {
  const parsed = createPrintOrderSchema.safeParse(input);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "بيانات طلب الطباعة غير مكتملة.");
  }

  const user = await getAuthenticatedUser();
  if (!user) return err("UNAUTHORIZED", "يرجى تسجيل الدخول أولاً.");

  const supabase = await createSupabaseServerClient();
  const { data: school } = await supabase
    .from("schools")
    .select("id, vat_rate_pct")
    .eq("slug", parsed.data.schoolSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (!school) return err("NOT_FOUND", "المدرسة غير موجودة.");

  const { data: partner } = await supabase
    .from("print_partners")
    .select("id, commission_pct, is_active")
    .eq("id", parsed.data.partnerId)
    .eq("is_active", true)
    .maybeSingle();

  if (!partner) return err("NOT_FOUND", "المطبعة المحددة غير متاحة حالياً.");

  const { data: teacherProfile } = await supabase
    .from("teacher_profiles")
    .select("id, is_approved")
    .eq("id", user.id)
    .eq("school_id", school.id)
    .maybeSingle();

  if (!teacherProfile || !teacherProfile.is_approved) {
    return err("FORBIDDEN", "يتطلب إرسال طلب طباعة حساب معلم معتمد بالمدرسة.");
  }

  const pricing = calculatePrintOrderPricing({
    copiesCount: parsed.data.copiesCount,
    pagesCount: parsed.data.pagesCount,
    printSpecs: parsed.data.printSpecs,
    bindingType: parsed.data.bindingType,
    vatRatePct: school.vat_rate_pct ?? DEFAULT_VAT_RATE_PCT,
    commissionPct: partner.commission_pct ?? DEFAULT_PRINT_COMMISSION_PCT,
  });

  const { data: inserted, error: insertError } = await supabase
    .from("print_orders")
    .insert({
      school_id: school.id,
      partner_id: partner.id,
      teacher_id: user.id,
      session_id: parsed.data.sessionId ?? null,
      title_ar: parsed.data.titleAr,
      file_storage_path: parsed.data.fileStoragePath ?? null,
      external_file_url: parsed.data.externalFileUrl ?? null,
      copies_count: parsed.data.copiesCount,
      pages_count: parsed.data.pagesCount,
      print_specs: parsed.data.printSpecs,
      binding_type: parsed.data.bindingType,
      subtotal_egp: pricing.subtotalEgp,
      vat_egp: pricing.vatEgp,
      total_egp: pricing.totalEgp,
      platform_commission_egp: pricing.platformCommissionEgp,
      notes_ar: parsed.data.notesAr ?? null,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return err("INTERNAL_ERROR", insertError?.message ?? "تعذر تسجيل طلب الطباعة.");
  }

  revalidatePath(`/s/${parsed.data.schoolSlug}/teacher/printing`);
  revalidatePath(`/s/${parsed.data.schoolSlug}/admin`);

  return ok({ orderId: inserted.id, totalEgp: pricing.totalEgp });
}

export async function updatePrintOrderStatusAction(
  input: z.infer<typeof updatePrintOrderStatusSchema>
): Promise<ActionResult<{ status: PrintOrderStatus }>> {
  const parsed = updatePrintOrderStatusSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION_ERROR", "بيانات التحديث غير صالحة.");

  const user = await getAuthenticatedUser();
  if (!user) return err("UNAUTHORIZED", "يرجى تسجيل الدخول.");

  const supabase = await createSupabaseServerClient();
  const { data: school } = await supabase
    .from("schools")
    .select("id")
    .eq("slug", parsed.data.schoolSlug)
    .maybeSingle();

  if (!school) return err("NOT_FOUND", "المدرسة غير موجودة.");

  const { data: existingOrder } = await supabase
    .from("print_orders")
    .select("id, teacher_id, title_ar")
    .eq("id", parsed.data.orderId)
    .eq("school_id", school.id)
    .maybeSingle();

  if (!existingOrder) return err("NOT_FOUND", "طلب الطباعة غير موجود.");

  const { error } = await supabase
    .from("print_orders")
    .update({ status: parsed.data.status })
    .eq("id", existingOrder.id);

  if (error) return err("FORBIDDEN", "لا تملك صلاحية تغيير حالة هذا الطلب.");

  const adminClient = createSupabaseAdminClient();
  if (adminClient) {
    const statusLabelMap: Record<PrintOrderStatus, string> = {
      pending: "قيد المراجعة",
      printing: "جاري الطباعة",
      ready: "جاهز للاستلام",
      delivered: "تم التسليم",
      cancelled: "ملغى",
    };
    await adminClient.from("notifications").insert({
      school_id: school.id,
      recipient_id: existingOrder.teacher_id,
      type: "print_order_updated",
      title_ar: "تحديث حالة طلب الطباعة",
      body_ar: `طلب "${existingOrder.title_ar}" الآن: ${statusLabelMap[parsed.data.status]}.`,
      metadata: { orderId: existingOrder.id, status: parsed.data.status },
    });
  }

  revalidatePath(`/s/${parsed.data.schoolSlug}/teacher/printing`);
  return ok({ status: parsed.data.status });
}

export async function upsertPrintPartnerAction(
  input: z.infer<typeof upsertPrintPartnerSchema>
): Promise<ActionResult<{ partnerId: string }>> {
  const parsed = upsertPrintPartnerSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION_ERROR", "بيانات المطبعة غير صالحة.");

  const user = await getAuthenticatedUser();
  if (!user) return err("UNAUTHORIZED", "يرجى تسجيل الدخول.");

  const supabase = await createSupabaseServerClient();
  const { data: school } = await supabase
    .from("schools")
    .select("id")
    .eq("slug", parsed.data.schoolSlug)
    .maybeSingle();

  if (!school) return err("NOT_FOUND", "المدرسة غير موجودة.");

  const { data: partner, error } = await supabase
    .from("print_partners")
    .insert({
      school_id: school.id,
      name_ar: parsed.data.nameAr,
      phone: parsed.data.phone,
      whatsapp_number: parsed.data.whatsappNumber ?? parsed.data.phone.replace(/\D/g, ""),
      address_ar: parsed.data.addressAr ?? null,
      commission_pct: parsed.data.commissionPct,
      is_active: true,
    })
    .select("id")
    .single();

  if (error || !partner) {
    return err("FORBIDDEN", error?.message ?? "تعذر إضافة المطبعة.");
  }

  revalidatePath(`/s/${parsed.data.schoolSlug}/teacher/printing`);
  revalidatePath(`/s/${parsed.data.schoolSlug}/admin`);
  return ok({ partnerId: partner.id });
}
