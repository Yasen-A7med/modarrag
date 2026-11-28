import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { getPublicEnv } from "@/lib/env";

function sanitizeNextPath(rawNext: string | null): string | null {
  if (!rawNext) {
    return null;
  }
  const trimmed = rawNext.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return null;
  }
  return trimmed;
}

/**
 * Handles Supabase Google OAuth PKCE code exchange and routes returning
 * or newly onboarded users safely to their school portal or /onboarding.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = sanitizeNextPath(searchParams.get("next"));
  const defaultSchoolSlug = getPublicEnv().NEXT_PUBLIC_DEFAULT_SCHOOL_SLUG;

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth", origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(new URL("/login?error=oauth", origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=oauth", origin));
  }

  // Ensure a default student profile row exists even if auth.users trigger didn't run
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, role, school_id, is_active")
    .eq("id", user.id)
    .maybeSingle();

  let profile = existingProfile;

  if (!profile) {
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const rawName =
      typeof meta.full_name === "string"
        ? meta.full_name
        : typeof meta.name === "string"
          ? meta.name
          : user.email?.split("@")[0] || "طالب جديد";
    const avatarUrl =
      typeof meta.avatar_url === "string"
        ? meta.avatar_url
        : typeof meta.picture === "string"
          ? meta.picture
          : null;

    const { data: inserted } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        role: "student",
        school_id: null,
        full_name: rawName.trim().slice(0, 120) || "طالب جديد",
        avatar_url: avatarUrl,
      })
      .select("id, role, school_id, is_active")
      .maybeSingle();

    profile = inserted ?? null;
  }

  if (nextPath) {
    return NextResponse.redirect(new URL(nextPath, origin));
  }

  if (!profile || profile.is_active === false) {
    return NextResponse.redirect(new URL("/onboarding", origin));
  }

  if (profile.role === "super_admin") {
    return NextResponse.redirect(new URL("/super-admin", origin));
  }

  let schoolSlug = defaultSchoolSlug;
  if (profile.school_id) {
    const { data: school } = await supabase
      .from("schools")
      .select("slug")
      .eq("id", profile.school_id)
      .maybeSingle();
    if (school?.slug) {
      schoolSlug = school.slug;
    }
  }

  if (profile.role === "school_admin") {
    return NextResponse.redirect(new URL(`/s/${schoolSlug}/admin`, origin));
  }

  if (profile.role === "teacher" || profile.role === "gate_scanner") {
    return NextResponse.redirect(new URL(`/s/${schoolSlug}/teacher`, origin));
  }

  const { data: enrollment } = await supabase
    .from("student_enrollments")
    .select("id")
    .eq("student_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!profile.school_id || !enrollment) {
    return NextResponse.redirect(new URL("/onboarding", origin));
  }

  return NextResponse.redirect(new URL(`/s/${schoolSlug}/student`, origin));
}
