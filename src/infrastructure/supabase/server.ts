import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getPublicEnv, getServerEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Creates a request-scoped typed Supabase server client using @supabase/ssr getAll/setAll cookies.
 * Cookie writes inside Server Components are caught safely because middleware owns token refresh.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();
  const env = getPublicEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Expected when invoked from a read-only Server Component render pass.
          }
        },
      },
    }
  );
}

/**
 * Resolves the verified authenticated user via Supabase Auth server validation (`getUser()`).
 * Never uses `getSession()` on the server, as cookie payloads alone are untrusted.
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

/**
 * Creates a privileged typed service-role Supabase client when SUPABASE_SERVICE_ROLE_KEY is configured.
 * Returns null if the optional service role key is unset.
 */
export function createSupabaseAdminClient(): SupabaseClient<Database> | null {
  const publicEnv = getPublicEnv();
  const serverEnv = getServerEnv();

  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
