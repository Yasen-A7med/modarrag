"use server";

import { z } from "zod";
import { createSupabaseServerClient, getAuthenticatedUser } from "@/infrastructure/supabase/server";
import { verifyTurnstileToken } from "@/infrastructure/security/turnstile";
import { checkRateLimit } from "@/infrastructure/security/rate-limiter";
import { ok, err, type ActionResult } from "@/domain/common/result";
import type { UserRole, Database } from "@/infrastructure/supabase/database.types";

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signUpStudentSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().trim().optional(),
  turnstileToken: z.string().optional(),
});

const completeOnboardingSchema = z.object({
  schoolId: z.string().uuid("Invalid school ID"),
  fullName: z.string().trim().min(2, "Full name is required"),
  phone: z.string().trim().min(1, "Phone number is required"),
  gradeId: z.string().uuid("Invalid grade ID"),
  trackId: z.string().uuid("Invalid track ID"),
  selectedElectiveSubjectId: z.string().uuid().nullable().optional(),
  turnstileToken: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Demo role mapping — strictly anonymous seeded accounts
// ---------------------------------------------------------------------------

type DemoRoleKey =
  | "super_admin"
  | "school_admin"
  | "teacher_101"
  | "student_201"
  | "student_202";

const DEMO_CREDENTIALS: Record<DemoRoleKey, { email: string; password: string }> = {
  super_admin: {
    email: "super-admin-sa001@modarrag.app",
    password: "Modarrag@2026!",
  },
  school_admin: {
    email: "admin-ad101@ali-bin-abi-talib.modarrag.app",
    password: "Modarrag@2026!",
  },
  teacher_101: {
    email: "teacher-t101@ali-bin-abi-talib.modarrag.app",
    password: "Modarrag@2026!",
  },
  student_201: {
    email: "student-s201@ali-bin-abi-talib.modarrag.app",
    password: "Modarrag@2026!",
  },
  student_202: {
    email: "student-s202@ali-bin-abi-talib.modarrag.app",
    password: "Modarrag@2026!",
  },
};

const demoRoleKeySchema = z.object({
  roleKey: z.enum([
    "super_admin",
    "school_admin",
    "teacher_101",
    "student_201",
    "student_202",
  ]),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveRedirectPath(role: UserRole, schoolSlug: string | null): string {
  switch (role) {
    case "super_admin":
      return "/super-admin";
    case "school_admin":
      return schoolSlug ? `/s/${schoolSlug}/admin` : "/";
    case "teacher":
    case "gate_scanner":
      return schoolSlug ? `/s/${schoolSlug}/teacher` : "/";
    case "student":
      return schoolSlug ? `/s/${schoolSlug}/student` : "/onboarding";
  }
}

function mapAuthErrorMessage(rawMessage: string): string {
  const lower = rawMessage.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور.";
  }
  if (lower.includes("email not confirmed")) {
    return "يرجى تأكيد البريد الإلكتروني أولاً قبل تسجيل الدخول.";
  }
  return rawMessage;
}

// ---------------------------------------------------------------------------
// signInWithPasswordAction
// ---------------------------------------------------------------------------

export async function signInWithPasswordAction(
  input: { email: string; password: string }
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      const existing = fieldErrors[key];
      fieldErrors[key] = existing ? [...existing, issue.message] : [issue.message];
    }
    return err("VALIDATION_ERROR", "بيانات تسجيل الدخول غير صالحة.", { fieldErrors });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return err("UNAUTHORIZED", mapAuthErrorMessage(error.message));
  }

  // Fetch profile to determine redirect target
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return err("UNAUTHORIZED", "Authentication succeeded but user context is unavailable");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return ok({ redirectTo: "/onboarding" });
  }

  // Resolve school slug for redirect
  let schoolSlug: string | null = null;
  if (profile.school_id) {
    const { data: school } = await supabase
      .from("schools")
      .select("slug")
      .eq("id", profile.school_id)
      .maybeSingle();
    schoolSlug = school?.slug ?? null;
  }

  return ok({ redirectTo: resolveRedirectPath(profile.role, schoolSlug) });
}

// ---------------------------------------------------------------------------
// signInDemoRoleAction
// ---------------------------------------------------------------------------

export async function signInDemoRoleAction(
  input: { roleKey: DemoRoleKey }
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = demoRoleKeySchema.safeParse(input);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", "Invalid demo role key");
  }

  // Rate limit: 10 demo sign-ins per minute per IP-ish identifier
  const rlResult = await checkRateLimit(`demo-sign-in:global`, {
    limit: 10,
    windowMs: 60_000,
    prefix: "modarrag:demo",
  });
  if (!rlResult.allowed) {
    return err("RATE_LIMITED", "Too many demo sign-in attempts. Please try again shortly.");
  }

  const creds = DEMO_CREDENTIALS[parsed.data.roleKey];
  return signInWithPasswordAction({ email: creds.email, password: creds.password });
}

// ---------------------------------------------------------------------------
// signUpStudentAction
// ---------------------------------------------------------------------------

export async function signUpStudentAction(
  input: { fullName: string; email: string; password: string; phone?: string; turnstileToken?: string }
): Promise<ActionResult<{ userId: string }>> {
  const parsed = signUpStudentSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      const existing = fieldErrors[key];
      fieldErrors[key] = existing ? [...existing, issue.message] : [issue.message];
    }
    return err("VALIDATION_ERROR", "Invalid sign-up input", { fieldErrors });
  }

  // Turnstile verification
  const turnstileResult = await verifyTurnstileToken(parsed.data.turnstileToken);
  if (!turnstileResult.ok) {
    return turnstileResult;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        phone: parsed.data.phone ?? null,
      },
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return err("CONFLICT", "An account with this email already exists");
    }
    return err("INTERNAL_ERROR", error.message);
  }

  if (!data.user) {
    return err("INTERNAL_ERROR", "Sign-up completed but user data was not returned");
  }

  return ok({ userId: data.user.id });
}

// ---------------------------------------------------------------------------
// signOutAction
// ---------------------------------------------------------------------------

export async function signOutAction(): Promise<ActionResult<{ ok: true }>> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return err("INTERNAL_ERROR", error.message);
  }

  return ok({ ok: true });
}

// ---------------------------------------------------------------------------
// completeStudentOnboardingAction
// ---------------------------------------------------------------------------

export async function completeStudentOnboardingAction(
  input: {
    schoolId: string;
    fullName: string;
    phone: string;
    gradeId: string;
    trackId: string;
    selectedElectiveSubjectId?: string | null;
    turnstileToken?: string;
  }
): Promise<ActionResult<{ enrollmentId: string; schoolSlug: string }>> {
  const parsed = completeOnboardingSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      const existing = fieldErrors[key];
      fieldErrors[key] = existing ? [...existing, issue.message] : [issue.message];
    }
    return err("VALIDATION_ERROR", "Invalid onboarding input", { fieldErrors });
  }

  // Turnstile verification
  const turnstileResult = await verifyTurnstileToken(parsed.data.turnstileToken);
  if (!turnstileResult.ok) {
    return turnstileResult;
  }

  const supabase = await createSupabaseServerClient();
  const user = await getAuthenticatedUser();
  if (!user) {
    return err("UNAUTHORIZED", "You must be signed in to complete onboarding");
  }

  type OnboardingRpc = Database["public"]["Functions"]["complete_student_onboarding"];
  const rpcArgs: OnboardingRpc["Args"] = {
    p_school_id: parsed.data.schoolId,
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone,
    p_grade_id: parsed.data.gradeId,
    p_track_id: parsed.data.trackId,
    p_selected_elective_subject_id: parsed.data.selectedElectiveSubjectId ?? null,
  };

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "complete_student_onboarding",
    rpcArgs
  );

  if (rpcError) {
    return err("INTERNAL_ERROR", rpcError.message);
  }

  const result = rpcResult as unknown as OnboardingRpc["Returns"];
  if (!result || !result.ok) {
    const failResult = result as Extract<OnboardingRpc["Returns"], { ok: false }>;
    const codeMap: Record<string, Parameters<typeof err>[0]> = {
      invalid_school: "NOT_FOUND",
      invalid_grade: "NOT_FOUND",
      invalid_track: "NOT_FOUND",
      elective_required: "VALIDATION_ERROR",
      invalid_elective: "VALIDATION_ERROR",
      unauthenticated: "UNAUTHORIZED",
    };
    return err(
      codeMap[failResult.code] ?? "INTERNAL_ERROR",
      failResult.message_ar
    );
  }

  const successResult = result as Extract<OnboardingRpc["Returns"], { ok: true }>;

  // Resolve school slug for redirect
  const { data: school } = await supabase
    .from("schools")
    .select("slug")
    .eq("id", successResult.school_id)
    .single();

  return ok({
    enrollmentId: successResult.enrollment_id,
    schoolSlug: school?.slug ?? "ali-bin-abi-talib",
  });
}

// ---------------------------------------------------------------------------
// getCurrentUserContext
// ---------------------------------------------------------------------------

export interface UserContext {
  readonly userId: string;
  readonly role: UserRole;
  readonly schoolId: string | null;
  readonly schoolSlug: string | null;
  readonly fullName: string;
}

export async function getCurrentUserContext(): Promise<UserContext | null> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, school_id, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return null;
  }

  let schoolSlug: string | null = null;
  if (profile.school_id) {
    const { data: school } = await supabase
      .from("schools")
      .select("slug")
      .eq("id", profile.school_id)
      .single();
    schoolSlug = school?.slug ?? null;
  }

  return {
    userId: user.id,
    role: profile.role,
    schoolId: profile.school_id,
    schoolSlug,
    fullName: profile.full_name,
  };
}
