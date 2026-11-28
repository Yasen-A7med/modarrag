import { getPublicEnv } from "@/lib/env";

/**
 * Checks whether Google OAuth is enabled on the configured Supabase Auth project.
 * Evaluated dynamically without static caching so dashboard toggles take effect immediately.
 */
export async function isGoogleOAuthEnabled(): Promise<boolean> {
  try {
    const env = getPublicEnv();
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
      cache: "no-store",
    });
    if (!res.ok) {
      return false;
    }
    const data = (await res.json()) as { external?: { google?: boolean } };
    return Boolean(data.external?.google);
  } catch {
    return false;
  }
}
