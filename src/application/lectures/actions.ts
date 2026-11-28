"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { checkRateLimit } from "@/infrastructure/security/rate-limiter";
import type {
  LectureVisibility,
  SecretLecturePreviewRpcResult,
  UnlockSecretLectureRpcResult,
} from "@/infrastructure/supabase/database.types";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  getAuthenticatedUser,
} from "@/infrastructure/supabase/server";
import { err, ok, type ActionResult } from "@/domain/common/result";
import { getServerEnv } from "@/lib/env";
import {
  isSupportedLectureVideoMime,
  LECTURE_BUCKET_NAME,
  MAX_LECTURE_UPLOAD_BYTES,
  resolveExternalVideoEmbed,
  sanitizeStorageFileExtension,
} from "@/lib/lecture-media";

const uploadIntentSchema = z.object({
  schoolSlug: z.string().min(1),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().min(1).max(100),
  fileSizeBytes: z.number().int().positive().max(MAX_LECTURE_UPLOAD_BYTES),
});

const publishLectureSchema = z.object({
  schoolSlug: z.string().min(1),
  subjectId: z.string().uuid("معرّف المادة غير صالح"),
  sessionId: z.string().uuid("معرّف الحصة غير صالح").nullable().optional(),
  titleAr: z.string().trim().min(3, "عنوان المحاضرة يجب أن يكون ٣ أحرف على الأقل").max(160),
  descriptionAr: z.string().trim().max(1000).optional(),
  visibility: z.enum(["public", "attendees_only", "secret"]),
  priceEgp: z.number().int().min(0).max(10000).default(0),
  storagePath: z.string().trim().max(400).nullable().optional(),
  externalVideoUrl: z.string().trim().max(500).nullable().optional(),
  fileSizeBytes: z.number().int().positive().max(MAX_LECTURE_UPLOAD_BYTES).nullable().optional(),
  mimeType: z.string().trim().max(100).nullable().optional(),
  durationMinutes: z.number().int().min(1).max(600).nullable().optional(),
  secretPassword: z.string().max(100).optional(),
});

const updateLectureSchema = z.object({
  schoolSlug: z.string().min(1),
  lectureId: z.string().uuid(),
  titleAr: z.string().trim().min(3).max(160),
  descriptionAr: z.string().trim().max(1000).optional(),
  visibility: z.enum(["public", "attendees_only", "secret"]),
  sessionId: z.string().uuid().nullable().optional(),
  isPublished: z.boolean().optional(),
  newSecretPassword: z.string().max(100).optional(),
});

const deleteLectureSchema = z.object({
  schoolSlug: z.string().min(1),
  lectureId: z.string().uuid(),
});

const unlockSecretSchema = z.object({
  schoolSlug: z.string().min(1),
  shareToken: z.string().trim().min(6).max(80),
  password: z.string().min(1, "يرجى إدخال كلمة المرور").max(100),
});

export interface TeacherLectureRecord {
  readonly id: string;
  readonly titleAr: string;
  readonly descriptionAr: string | null;
  readonly visibility: LectureVisibility;
  readonly priceEgp: number;
  readonly subjectId: string;
  readonly subjectNameAr: string;
  readonly sessionId: string | null;
  readonly sessionTitleAr: string | null;
  readonly shareToken: string;
  readonly fileSizeBytes: number | null;
  readonly mimeType: string | null;
  readonly durationMinutes: number | null;
  readonly hasUploadedFile: boolean;
  readonly hasExternalUrl: boolean;
  readonly isPublished: boolean;
  readonly createdAt: string;
}

export interface TeacherLecturesWorkspaceData {
  readonly schoolId: string;
  readonly schoolSlug: string;
  readonly schoolNameAr: string;
  readonly teacherId: string;
  readonly subjects: readonly { readonly id: string; readonly nameAr: string }[];
  readonly sessions: readonly {
    readonly id: string;
    readonly titleAr: string;
    readonly subjectId: string;
    readonly subjectNameAr: string;
    readonly startsAt: string;
  }[];
  readonly lectures: readonly TeacherLectureRecord[];
}

export interface StudentLectureCardItem {
  readonly id: string;
  readonly titleAr: string;
  readonly descriptionAr: string | null;
  readonly visibility: LectureVisibility;
  readonly priceEgp: number;
  readonly subjectId: string;
  readonly subjectNameAr: string;
  readonly teacherCode: string;
  readonly sessionId: string | null;
  readonly sessionTitleAr: string | null;
  readonly sessionStartsAt: string | null;
  readonly durationMinutes: number | null;
  readonly fileSizeBytes: number | null;
  readonly createdAt: string;
  readonly canWatch: boolean;
  readonly accessReasonAr: string;
  readonly requiresLoginToCheck: boolean;
}

export interface SchoolLecturesCatalogData {
  readonly schoolId: string;
  readonly schoolSlug: string;
  readonly schoolNameAr: string;
  readonly isAuthenticated: boolean;
  readonly subjects: readonly { readonly id: string; readonly nameAr: string }[];
  readonly lectures: readonly StudentLectureCardItem[];
}

export interface PlaybackMediaPayload {
  readonly lectureId: string;
  readonly titleAr: string;
  readonly kind: "video" | "iframe";
  readonly src: string;
}

export interface SecretLecturePreviewData {
  readonly found: true;
  readonly lectureId: string;
  readonly titleAr: string;
  readonly descriptionAr: string | null;
  readonly visibility: LectureVisibility;
  readonly durationMinutes: number | null;
  readonly fileSizeBytes: number | null;
  readonly createdAt: string;
  readonly schoolNameAr: string;
  readonly schoolSlug: string;
  readonly subjectNameAr: string;
  readonly teacherCode: string;
  readonly specialtyAr: string;
  readonly alreadyUnlocked: boolean;
}

async function resolveActiveSchool(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  slug: string
) {
  const { data } = await supabase
    .from("schools")
    .select("id, slug, name_ar")
    .eq("slug", slug.trim().toLowerCase())
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

async function requireApprovedTeacherOrAdmin(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  schoolId: string
): Promise<ActionResult<{ readonly role: string; readonly userId: string }>> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, school_id, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || !profile.is_active) {
    return err("FORBIDDEN", "حسابك غير مفعل حالياً.");
  }

  if (profile.role === "super_admin") {
    return ok({ role: profile.role, userId });
  }

  if (profile.role === "school_admin" && profile.school_id === schoolId) {
    return ok({ role: profile.role, userId });
  }

  if (profile.role !== "teacher" || profile.school_id !== schoolId) {
    return err("FORBIDDEN", "هذه الصفحة خاصة بمعلمي المدرسة فقط.");
  }

  const { data: teacherProfile } = await supabase
    .from("teacher_profiles")
    .select("is_approved")
    .eq("id", userId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!teacherProfile || !teacherProfile.is_approved) {
    return err("FORBIDDEN", "حساب المعلم بانتظار اعتماد إدارة المدرسة.");
  }

  return ok({ role: profile.role, userId });
}

async function signStoragePlaybackUrl(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  storagePath: string
): Promise<ActionResult<string>> {
  const adminClient = createSupabaseAdminClient();
  const storageClient = adminClient ? adminClient.storage : supabase.storage;

  const { data, error } = await storageClient
    .from(LECTURE_BUCKET_NAME)
    .createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) {
    return err(
      "INTERNAL_ERROR",
      "تعذر تجهيز رابط تشغيل الفيديو الآن. تأكد من تسجيل الدخول أو أعد المحاولة."
    );
  }

  return ok(data.signedUrl);
}

/**
 * Loads subjects, sessions, and uploaded lectures for the Teacher Lectures dashboard.
 */
export async function getTeacherLecturesData(
  schoolSlug: string
): Promise<ActionResult<TeacherLecturesWorkspaceData>> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "يرجى تسجيل الدخول بحساب معلم المدرسة أولاً.");
  }

  const supabase = await createSupabaseServerClient();
  const school = await resolveActiveSchool(supabase, schoolSlug);
  if (!school) {
    return err("NOT_FOUND", "المدرسة غير موجودة.");
  }

  const authCheck = await requireApprovedTeacherOrAdmin(supabase, user.id, school.id);
  if (!authCheck.ok) {
    return authCheck;
  }

  const isTeacherOnly = authCheck.data.role === "teacher";

  const [subjectsRes, sessionsRes, lecturesRes] = await Promise.all([
    isTeacherOnly
      ? supabase
          .from("teacher_subjects")
          .select("subjects!teacher_subjects_subject_id_fkey(id, name_ar)")
          .eq("teacher_id", user.id)
          .eq("school_id", school.id)
      : supabase
          .from("subjects")
          .select("id, name_ar")
          .eq("school_id", school.id)
          .eq("is_active", true)
          .order("name_ar"),
    supabase
      .from("sessions")
      .select("id, title_ar, subject_id, starts_at, teacher_id, subjects!sessions_subject_id_fkey(name_ar)")
      .eq("school_id", school.id)
      .neq("status", "cancelled")
      .order("starts_at", { ascending: false })
      .limit(40),
    supabase
      .from("lectures")
      .select(`
        id,
        title_ar,
        description_ar,
        visibility,
        price_egp,
        subject_id,
        session_id,
        share_token,
        file_size_bytes,
        mime_type,
        duration_minutes,
        is_published,
        created_at,
        subjects!lectures_subject_id_fkey(name_ar),
        sessions!lectures_session_id_fkey(title_ar),
        lecture_media(storage_path, external_video_url)
      `)
      .eq("school_id", school.id)
      .order("created_at", { ascending: false }),
  ]);

  const rawSubjects = isTeacherOnly
    ? ((subjectsRes.data ?? []) as Array<{ subjects: { id: string; name_ar: string } | null }>)
        .map((row) => row.subjects)
        .filter((s): s is { id: string; name_ar: string } => Boolean(s))
    : ((subjectsRes.data ?? []) as Array<{ id: string; name_ar: string }>);

  const sessions = ((sessionsRes.data ?? []) as Array<{
    id: string;
    title_ar: string;
    subject_id: string;
    starts_at: string;
    teacher_id: string;
    subjects: { name_ar: string } | null;
  }>)
    .filter((s) => !isTeacherOnly || s.teacher_id === user.id)
    .map((s) => ({
      id: s.id,
      titleAr: s.title_ar,
      subjectId: s.subject_id,
      subjectNameAr: s.subjects?.name_ar ?? "مادة دراسية",
      startsAt: s.starts_at,
    }));

  const rawLectures = (lecturesRes.data ?? []) as Array<{
    id: string;
    title_ar: string;
    description_ar: string | null;
    visibility: LectureVisibility;
    price_egp: number | null;
    subject_id: string;
    session_id: string | null;
    share_token: string;
    file_size_bytes: number | null;
    mime_type: string | null;
    duration_minutes: number | null;
    is_published: boolean;
    created_at: string;
    subjects: { name_ar: string } | null;
    sessions: { title_ar: string } | null;
    lecture_media:
      | { storage_path: string | null; external_video_url: string | null }
      | Array<{ storage_path: string | null; external_video_url: string | null }>
      | null;
  }>;

  const lectures: TeacherLectureRecord[] = rawLectures.map((l) => {
    const media = Array.isArray(l.lecture_media)
      ? l.lecture_media[0]
      : l.lecture_media;
    return {
      id: l.id,
      titleAr: l.title_ar,
      descriptionAr: l.description_ar,
      visibility: l.visibility,
      priceEgp: l.price_egp ?? 0,
      subjectId: l.subject_id,
      subjectNameAr: l.subjects?.name_ar ?? "مادة دراسية",
      sessionId: l.session_id,
      sessionTitleAr: l.sessions?.title_ar ?? null,
      shareToken: l.share_token,
      fileSizeBytes: l.file_size_bytes,
      mimeType: l.mime_type,
      durationMinutes: l.duration_minutes,
      hasUploadedFile: Boolean(media?.storage_path),
      hasExternalUrl: Boolean(media?.external_video_url),
      isPublished: l.is_published,
      createdAt: l.created_at,
    };
  });

  return ok({
    schoolId: school.id,
    schoolSlug: school.slug,
    schoolNameAr: school.name_ar,
    teacherId: user.id,
    subjects: rawSubjects.map((s) => ({ id: s.id, nameAr: s.name_ar })),
    sessions,
    lectures,
  });
}

/**
 * Generates a scoped one-time Supabase Storage signed upload URL for direct browser-to-storage video upload.
 */
export async function createLectureUploadIntentAction(
  rawInput: z.infer<typeof uploadIntentSchema>
): Promise<
  ActionResult<{
    readonly storagePath: string;
    readonly signedUrl: string;
    readonly token: string;
  }>
> {
  const parsed = uploadIntentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(
      "VALIDATION_ERROR",
      "الملف غير صالح أو يتجاوز الحد الأقصى المسموح به (٥٠ ميجابايت)."
    );
  }

  if (!isSupportedLectureVideoMime(parsed.data.mimeType)) {
    return err(
      "VALIDATION_ERROR",
      "صيغة الفيديو غير مدعومة. الصيغ المتاحة: MP4 و WebM و MOV."
    );
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "يرجى تسجيل الدخول أولاً.");
  }

  const supabase = await createSupabaseServerClient();
  const school = await resolveActiveSchool(supabase, parsed.data.schoolSlug);
  if (!school) {
    return err("NOT_FOUND", "المدرسة غير موجودة.");
  }

  const authCheck = await requireApprovedTeacherOrAdmin(supabase, user.id, school.id);
  if (!authCheck.ok) {
    return authCheck;
  }

  const ext = sanitizeStorageFileExtension(parsed.data.fileName, parsed.data.mimeType);
  const storagePath = `${school.id}/${user.id}/${randomUUID()}.${ext}`;

  const { data, error } = await supabase.storage
    .from(LECTURE_BUCKET_NAME)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    return err(
      "INTERNAL_ERROR",
      error?.message ?? "تعذر تجهيز مسار رفع الفيديو في الخادم."
    );
  }

  return ok({
    storagePath: data.path,
    signedUrl: data.signedUrl,
    token: data.token,
  });
}

/**
 * Publishes a recorded lecture record, binds its storage file or verified HTTPS video URL,
 * and configures 3-tier access control (public / attendees_only / secret with password).
 */
export async function publishLectureAction(
  rawInput: z.input<typeof publishLectureSchema>
): Promise<ActionResult<{ readonly lectureId: string; readonly shareToken: string }>> {
  const parsed = publishLectureSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "البيانات غير مكتملة.");
  }

  const input = parsed.data;
  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "يرجى تسجيل الدخول أولاً.");
  }

  if (input.visibility === "attendees_only" && !input.sessionId) {
    return err(
      "VALIDATION_ERROR",
      "يجب اختيار الحصة المرتبطة عند تحديد الوصول «للحاضرين فقط»."
    );
  }

  if (
    input.visibility === "secret" &&
    (!input.secretPassword || input.secretPassword.trim().length < 4)
  ) {
    return err(
      "VALIDATION_ERROR",
      "يرجى تحديد كلمة مرور لا تقل عن ٤ أحرف أو أرقام للمحاضرة السرية."
    );
  }

  const cleanStoragePath = input.storagePath?.trim() || null;
  const cleanExternalUrl = input.externalVideoUrl?.trim() || null;

  if (!cleanStoragePath && !cleanExternalUrl) {
    return err("VALIDATION_ERROR", "يرجى رفع ملف فيديو أو إدخال رابط فيديو صحيح.");
  }

  if (cleanExternalUrl && !resolveExternalVideoEmbed(cleanExternalUrl)) {
    return err(
      "VALIDATION_ERROR",
      "الرابط غير مدعوم. استخدم رابط يوتيوب أو Vimeo أو Google Drive أو رابط فيديو HTTPS مباشر."
    );
  }

  const supabase = await createSupabaseServerClient();
  const school = await resolveActiveSchool(supabase, input.schoolSlug);
  if (!school) {
    return err("NOT_FOUND", "المدرسة غير موجودة.");
  }

  const authCheck = await requireApprovedTeacherOrAdmin(supabase, user.id, school.id);
  if (!authCheck.ok) {
    return authCheck;
  }

  if (cleanStoragePath && !cleanStoragePath.startsWith(`${school.id}/${user.id}/`)) {
    return err("FORBIDDEN", "مسار الفيديو لا يطابق حساب المعلم الحالي.");
  }

  const shareToken = randomBytes(12).toString("base64url");

  const { data: inserted, error: insertError } = await supabase
    .from("lectures")
    .insert({
      school_id: school.id,
      subject_id: input.subjectId,
      session_id: input.sessionId ?? null,
      teacher_id: user.id,
      title_ar: input.titleAr,
      description_ar: input.descriptionAr?.trim() || null,
      visibility: input.visibility,
      price_egp: input.priceEgp,
      file_size_bytes: input.fileSizeBytes ?? null,
      mime_type: input.mimeType ?? null,
      duration_minutes: input.durationMinutes ?? null,
      share_token: shareToken,
      is_published: true,
    })
    .select("id, share_token")
    .single();

  if (insertError || !inserted) {
    return err("INTERNAL_ERROR", insertError?.message ?? "تعذر نشر المحاضرة.");
  }

  const { error: mediaError } = await supabase.from("lecture_media").insert({
    lecture_id: inserted.id,
    storage_path: cleanStoragePath,
    external_video_url: cleanExternalUrl,
  });

  if (mediaError) {
    await supabase.from("lectures").delete().eq("id", inserted.id);
    return err("INTERNAL_ERROR", "تعذر حفظ مصدر الفيديو للمحاضرة.");
  }

  if (input.visibility === "secret" && input.secretPassword) {
    const { data: pwRes, error: pwErr } = await supabase.rpc(
      "set_lecture_secret_password",
      {
        p_lecture_id: inserted.id,
        p_password: input.secretPassword.trim(),
      }
    );

    if (pwErr || !pwRes?.ok) {
      await supabase.from("lectures").delete().eq("id", inserted.id);
      return err(
        "INTERNAL_ERROR",
        pwRes?.message_ar ?? "تعذر تشفير كلمة المرور الخاصة بالمحاضرة."
      );
    }
  }

  return ok({ lectureId: inserted.id, shareToken: inserted.share_token });
}

/**
 * Updates visibility tier, linked session, published status, or secret password for a lecture.
 */
export async function updateLectureAccessAction(
  rawInput: z.infer<typeof updateLectureSchema>
): Promise<ActionResult<{ readonly updated: true }>> {
  const parsed = updateLectureSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", "البيانات المدخلة غير صحيحة.");
  }

  const input = parsed.data;
  if (input.visibility === "attendees_only" && !input.sessionId) {
    return err(
      "VALIDATION_ERROR",
      "اختر الحصة المرتبطة عند تفعيل خيار «للحاضرين فقط»."
    );
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "يرجى تسجيل الدخول أولاً.");
  }

  const supabase = await createSupabaseServerClient();
  const school = await resolveActiveSchool(supabase, input.schoolSlug);
  if (!school) {
    return err("NOT_FOUND", "المدرسة غير موجودة.");
  }

  const authCheck = await requireApprovedTeacherOrAdmin(supabase, user.id, school.id);
  if (!authCheck.ok) {
    return authCheck;
  }

  const { error: updateErr } = await supabase
    .from("lectures")
    .update({
      title_ar: input.titleAr,
      description_ar: input.descriptionAr?.trim() || null,
      visibility: input.visibility,
      session_id: input.sessionId ?? null,
      ...(input.isPublished !== undefined ? { is_published: input.isPublished } : {}),
    })
    .eq("id", input.lectureId)
    .eq("school_id", school.id);

  if (updateErr) {
    return err("INTERNAL_ERROR", updateErr.message);
  }

  if (input.visibility === "secret" && input.newSecretPassword?.trim()) {
    const { data: pwRes, error: pwErr } = await supabase.rpc(
      "set_lecture_secret_password",
      {
        p_lecture_id: input.lectureId,
        p_password: input.newSecretPassword.trim(),
      }
    );
    if (pwErr || !pwRes?.ok) {
      return err(
        "INTERNAL_ERROR",
        pwRes?.message_ar ?? "تعذر تحديث كلمة المرور."
      );
    }
  }

  return ok({ updated: true });
}

/**
 * Deletes a recorded lecture and removes its stored video asset from private storage.
 */
export async function deleteLectureAction(
  rawInput: z.infer<typeof deleteLectureSchema>
): Promise<ActionResult<{ readonly deleted: true }>> {
  const parsed = deleteLectureSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", "بيانات غير صالحة.");
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "يرجى تسجيل الدخول أولاً.");
  }

  const supabase = await createSupabaseServerClient();
  const school = await resolveActiveSchool(supabase, parsed.data.schoolSlug);
  if (!school) {
    return err("NOT_FOUND", "المدرسة غير موجودة.");
  }

  const authCheck = await requireApprovedTeacherOrAdmin(supabase, user.id, school.id);
  if (!authCheck.ok) {
    return authCheck;
  }

  const { data: mediaRow } = await supabase
    .from("lecture_media")
    .select("storage_path")
    .eq("lecture_id", parsed.data.lectureId)
    .maybeSingle();

  if (mediaRow?.storage_path) {
    await supabase.storage
      .from(LECTURE_BUCKET_NAME)
      .remove([mediaRow.storage_path]);
  }

  const { error: delErr } = await supabase
    .from("lectures")
    .delete()
    .eq("id", parsed.data.lectureId)
    .eq("school_id", school.id);

  if (delErr) {
    return err("INTERNAL_ERROR", delErr.message);
  }

  return ok({ deleted: true });
}

/**
 * Returns the student/public lecture catalog for a school.
 * Secret lectures are NEVER exposed here; attendees_only lectures display lock/unlock state.
 */
export async function getSchoolLecturesCatalog(
  schoolSlug: string
): Promise<ActionResult<SchoolLecturesCatalogData>> {
  const supabase = await createSupabaseServerClient();
  const school = await resolveActiveSchool(supabase, schoolSlug);
  if (!school) {
    return err("NOT_FOUND", "المدرسة غير موجودة.");
  }

  const user = await getAuthenticatedUser();

  let userRole: string | null = null;
  let checkedInSessionIds = new Set<string>();

  if (user) {
    const [{ data: profile }, { data: checkedBookings }] = await Promise.all([
      supabase.from("profiles").select("role, school_id").eq("id", user.id).maybeSingle(),
      supabase
        .from("bookings")
        .select("session_id")
        .eq("student_id", user.id)
        .eq("school_id", school.id)
        .eq("status", "checked_in"),
    ]);

    userRole = profile?.role ?? null;
    checkedInSessionIds = new Set(
      (checkedBookings ?? []).map((b) => b.session_id)
    );
  }

  const [{ data: subjectsData }, { data: lecturesData }] = await Promise.all([
    supabase
      .from("subjects")
      .select("id, name_ar")
      .eq("school_id", school.id)
      .eq("is_active", true)
      .order("name_ar"),
    supabase
      .from("lectures")
      .select(`
        id,
        title_ar,
        description_ar,
        visibility,
        price_egp,
        subject_id,
        session_id,
        teacher_id,
        duration_minutes,
        file_size_bytes,
        created_at,
        subjects!lectures_subject_id_fkey(name_ar),
        sessions!lectures_session_id_fkey(title_ar, starts_at)
      `)
      .eq("school_id", school.id)
      .eq("is_published", true)
      .in("visibility", ["public", "attendees_only"])
      .order("created_at", { ascending: false }),
  ]);

  const rawLectures = (lecturesData ?? []) as Array<{
    id: string;
    title_ar: string;
    description_ar: string | null;
    visibility: LectureVisibility;
    price_egp: number | null;
    subject_id: string;
    session_id: string | null;
    teacher_id: string;
    duration_minutes: number | null;
    file_size_bytes: number | null;
    created_at: string;
    subjects: { name_ar: string } | null;
    sessions: { title_ar: string; starts_at: string } | null;
  }>;

  const teacherIds = [...new Set(rawLectures.map((l) => l.teacher_id))];
  const teacherCodeMap = new Map<string, string>();
  if (teacherIds.length > 0) {
    const { data: tpRows } = await supabase
      .from("teacher_profiles")
      .select("id, teacher_code, specialty_ar")
      .in("id", teacherIds);
    for (const row of tpRows ?? []) {
      teacherCodeMap.set(row.id, `${row.teacher_code} · ${row.specialty_ar}`);
    }
  }

  const isPrivilegedStaff =
    userRole === "school_admin" || userRole === "super_admin";

  const lectures: StudentLectureCardItem[] = rawLectures.map((l) => {
    const isOwner = Boolean(user && l.teacher_id === user.id);
    const hasAttended = Boolean(
      l.session_id && checkedInSessionIds.has(l.session_id)
    );

    let canWatch = false;
    let accessReasonAr = "";
    let requiresLoginToCheck = false;

    if (l.visibility === "public") {
      canWatch = true;
      accessReasonAr = "متاحة للمشاهدة للجميع";
    } else if (isOwner || isPrivilegedStaff) {
      canWatch = true;
      accessReasonAr = "صلاحية معلم / إدارة المدرسة";
    } else if (!user) {
      canWatch = false;
      requiresLoginToCheck = true;
      accessReasonAr = "سجّل دخولك أولاً للتحقق من حضورك في الحصة";
    } else if (hasAttended) {
      canWatch = true;
      accessReasonAr = "مفتوحة لك لأن المعلم سجّل حضورك ✓";
    } else {
      canWatch = false;
      accessReasonAr = "متاحة فقط للطلاب الذين سُجّل حضورهم في هذه الحصة";
    }

    return {
      id: l.id,
      titleAr: l.title_ar,
      descriptionAr: l.description_ar,
      visibility: l.visibility,
      priceEgp: l.price_egp ?? 0,
      subjectId: l.subject_id,
      subjectNameAr: l.subjects?.name_ar ?? "مادة دراسية",
      teacherCode: teacherCodeMap.get(l.teacher_id) ?? "معلم المادة",
      sessionId: l.session_id,
      sessionTitleAr: l.sessions?.title_ar ?? null,
      sessionStartsAt: l.sessions?.starts_at ?? null,
      durationMinutes: l.duration_minutes,
      fileSizeBytes: l.file_size_bytes,
      createdAt: l.created_at,
      canWatch,
      accessReasonAr,
      requiresLoginToCheck,
    };
  });

  return ok({
    schoolId: school.id,
    schoolSlug: school.slug,
    schoolNameAr: school.name_ar,
    isAuthenticated: Boolean(user),
    subjects: ((subjectsData ?? []) as Array<{ id: string; name_ar: string }>).map((s) => ({
      id: s.id,
      nameAr: s.name_ar,
    })),
    lectures,
  });
}

/**
 * Verifies viewer authorization (public OR checked-in student OR owner/admin) and
 * mints a short-lived signed video playback source.
 */
export async function getLecturePlaybackAction(rawInput: {
  readonly schoolSlug: string;
  readonly lectureId: string;
}): Promise<ActionResult<PlaybackMediaPayload>> {
  const supabase = await createSupabaseServerClient();
  const school = await resolveActiveSchool(supabase, rawInput.schoolSlug);
  if (!school) {
    return err("NOT_FOUND", "المدرسة غير موجودة.");
  }

  const { data: lecture } = await supabase
    .from("lectures")
    .select("id, title_ar, visibility, session_id, teacher_id, is_published")
    .eq("id", rawInput.lectureId)
    .eq("school_id", school.id)
    .maybeSingle();

  if (!lecture) {
    return err("NOT_FOUND", "المحاضرة غير موجودة.");
  }

  const user = await getAuthenticatedUser();
  const isOwner = Boolean(user && lecture.teacher_id === user.id);

  if (!lecture.is_published && !isOwner) {
    return err("FORBIDDEN", "هذه المحاضرة غير متاحة للعرض حالياً.");
  }

  if (lecture.visibility === "secret" && !isOwner) {
    return err(
      "FORBIDDEN",
      "هذه محاضرة سرية لا تُفتح إلا من الرابط المخصص وكلمة المرور."
    );
  }

  if (lecture.visibility === "attendees_only" && !isOwner) {
    if (!user) {
      return err("UNAUTHORIZED", "سجّل دخولك أولاً للتحقق من حضورك في الحصة.");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, school_id")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin =
      profile?.role === "super_admin" ||
      (profile?.role === "school_admin" && profile.school_id === school.id);

    if (!isAdmin) {
      if (!lecture.session_id) {
        return err("FORBIDDEN", "لم يتم ربط هذه المحاضرة بحصة محددة.");
      }

      const { data: checkedBooking } = await supabase
        .from("bookings")
        .select("id")
        .eq("session_id", lecture.session_id)
        .eq("student_id", user.id)
        .eq("status", "checked_in")
        .maybeSingle();

      if (!checkedBooking) {
        return err(
          "ELIGIBILITY_DENIED",
          "هذه المحاضرة متاحة فقط للطلاب الذين سجل المعلم حضورهم الفعلي في الحصة."
        );
      }
    }
  }

  const { data: media } = await supabase
    .from("lecture_media")
    .select("storage_path, external_video_url")
    .eq("lecture_id", lecture.id)
    .maybeSingle();

  if (!media) {
    return err("NOT_FOUND", "لم يتم العثور على ملف الفيديو لهذه المحاضرة.");
  }

  if (media.storage_path) {
    const signed = await signStoragePlaybackUrl(supabase, media.storage_path);
    if (!signed.ok) {
      return signed;
    }
    return ok({
      lectureId: lecture.id,
      titleAr: lecture.title_ar,
      kind: "video",
      src: signed.data,
    });
  }

  if (media.external_video_url) {
    const resolved = resolveExternalVideoEmbed(media.external_video_url);
    if (!resolved) {
      return err("VALIDATION_ERROR", "رابط الفيديو الخارجي غير صالح.");
    }
    return ok({
      lectureId: lecture.id,
      titleAr: lecture.title_ar,
      kind: resolved.kind,
      src: resolved.src,
    });
  }

  return err("NOT_FOUND", "لا يوجد مصدر فيديو مرتبط بهذه المحاضرة.");
}

/**
 * Fetches safe public preview metadata for a hidden/secret lecture route (/lectures/[shareToken]).
 */
export async function getSecretLecturePreviewAction(
  schoolSlug: string,
  shareToken: string
): Promise<ActionResult<SecretLecturePreviewData>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_secret_lecture_preview", {
    p_school_slug: schoolSlug.trim().toLowerCase(),
    p_share_token: shareToken.trim(),
  });

  if (error || !data) {
    return err("NOT_FOUND", "تعذر التحقق من رابط المحاضرة.");
  }

  const result = data as SecretLecturePreviewRpcResult;
  if (!result.found) {
    return err("NOT_FOUND", "الرابط غير صحيح أو لم تعد المحاضرة متاحة.");
  }

  return ok({
    found: true,
    lectureId: result.lecture_id,
    titleAr: result.title_ar,
    descriptionAr: result.description_ar,
    visibility: result.visibility,
    durationMinutes: result.duration_minutes,
    fileSizeBytes: result.file_size_bytes,
    createdAt: result.created_at,
    schoolNameAr: result.school_name_ar,
    schoolSlug: result.school_slug,
    subjectNameAr: result.subject_name_ar,
    teacherCode: result.teacher_code,
    specialtyAr: result.specialty_ar,
    alreadyUnlocked: result.already_unlocked,
  });
}

/**
 * Verifies secret lecture password (with rate limiting) and issues a signed video stream URL.
 */
export async function unlockSecretLectureAction(
  rawInput: z.infer<typeof unlockSecretSchema>
): Promise<ActionResult<PlaybackMediaPayload>> {
  const parsed = unlockSecretSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "كلمة المرور مطلوبة.");
  }

  const rl = await checkRateLimit(
    `secret-lecture:${parsed.data.schoolSlug}:${parsed.data.shareToken}`,
    { limit: 12, windowMs: 300_000, prefix: "modarrag:secret" }
  );

  if (!rl.allowed) {
    return err(
      "RATE_LIMITED",
      "تم تجاوز الحد المسموح لمحاولات كلمة المرور. انتظر بضع دقائق ثم أعد المحاولة."
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("unlock_secret_lecture", {
    p_school_slug: parsed.data.schoolSlug.trim().toLowerCase(),
    p_share_token: parsed.data.shareToken.trim(),
    p_password: parsed.data.password,
  });

  if (error || !data) {
    return err("INTERNAL_ERROR", "تعذر التحقق من كلمة المرور الآن.");
  }

  const res = data as UnlockSecretLectureRpcResult;
  if (!res.ok) {
    return err(res.code === "invalid_password" ? "FORBIDDEN" : "NOT_FOUND", res.message_ar);
  }

  if (res.external_video_url) {
    const resolved = resolveExternalVideoEmbed(res.external_video_url);
    if (!resolved) {
      return err("VALIDATION_ERROR", "رابط الفيديو المرتبط غير صالح.");
    }
    return ok({
      lectureId: res.lecture_id,
      titleAr: "المحاضرة المسجلة",
      kind: resolved.kind,
      src: resolved.src,
    });
  }

  if (res.storage_path) {
    const env = getServerEnv();
    const user = await getAuthenticatedUser();
    if (!user && !env.SUPABASE_SERVICE_ROLE_KEY) {
      return err(
        "UNAUTHORIZED",
        "كلمة المرور صحيحة، ولكن تشغيل الفيديو المرفوع يتطلب تسجيل دخولك أولاً لتفعيل الجلسة الآمنة.",
        { details: { reason: "AUTH_REQUIRED_FOR_PRIVATE_STREAM" } }
      );
    }

    const signed = await signStoragePlaybackUrl(supabase, res.storage_path);
    if (!signed.ok) {
      return signed;
    }

    return ok({
      lectureId: res.lecture_id,
      titleAr: "المحاضرة المسجلة",
      kind: "video",
      src: signed.data,
    });
  }

  return err("NOT_FOUND", "لا يوجد ملف فيديو مرتبط بهذه المحاضرة.");
}
