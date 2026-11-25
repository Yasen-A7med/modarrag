import { z } from "zod";

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const optionalNonEmptyString = z.preprocess(emptyToUndefined, z.string().min(1).optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

export const DEV_QR_SIGNING_SECRET_FALLBACK =
  "dev-only-modarrag-qr-signing-secret-do-not-use-in-prod-32bytes";

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalNonEmptyString,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalNonEmptyString,
  NEXT_PUBLIC_APP_URL: z.preprocess(
    emptyToUndefined,
    z.string().url().default("http://localhost:3000")
  ),
  NEXT_PUBLIC_DEFAULT_SCHOOL_SLUG: z.preprocess(
    emptyToUndefined,
    z.string().min(1).default("ali-bin-abi-talib")
  ),
});

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SUPABASE_SERVICE_ROLE_KEY: optionalNonEmptyString,
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalNonEmptyString,
  TURNSTILE_SECRET_KEY: optionalNonEmptyString,
  QR_SIGNING_SECRET: optionalNonEmptyString,
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export interface ServerEnv {
  readonly NODE_ENV: "development" | "test" | "production";
  readonly SUPABASE_SERVICE_ROLE_KEY: string | undefined;
  readonly UPSTASH_REDIS_REST_URL: string | undefined;
  readonly UPSTASH_REDIS_REST_TOKEN: string | undefined;
  readonly TURNSTILE_SECRET_KEY: string | undefined;
  readonly QR_SIGNING_SECRET: string;
  readonly isUsingDevQrFallback: boolean;
  readonly isUpstashConfigured: boolean;
  readonly isTurnstileConfigured: boolean;
}

const loggedWarnings = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (process.env.NODE_ENV === "test" || loggedWarnings.has(key)) {
    return;
  }
  loggedWarnings.add(key);
  console.warn(`[modarrag:env] ${message}`);
}

export function parsePublicEnv(raw: Record<string, string | undefined>): PublicEnv {
  return publicEnvSchema.parse(raw);
}

export function parseServerEnv(
  raw: Record<string, string | undefined>,
  options: { readonly suppressWarnings?: boolean } = {}
): ServerEnv {
  const parsed = serverEnvSchema.parse(raw);
  const isProd = parsed.NODE_ENV === "production";

  let qrSecret = parsed.QR_SIGNING_SECRET;
  let isUsingDevQrFallback = false;

  if (isProd) {
    if (!qrSecret || qrSecret.length < 32) {
      throw new Error(
        "QR_SIGNING_SECRET must be set and at least 32 characters in production"
      );
    }
    if (qrSecret === DEV_QR_SIGNING_SECRET_FALLBACK) {
      throw new Error(
        "QR_SIGNING_SECRET must not use the development fallback in production"
      );
    }
  } else if (!qrSecret) {
    qrSecret = DEV_QR_SIGNING_SECRET_FALLBACK;
    isUsingDevQrFallback = true;
    if (!options.suppressWarnings) {
      warnOnce(
        "qr-fallback",
        "QR_SIGNING_SECRET is unset; using non-production development fallback."
      );
    }
  }

  const hasUpstashUrl = Boolean(parsed.UPSTASH_REDIS_REST_URL);
  const hasUpstashToken = Boolean(parsed.UPSTASH_REDIS_REST_TOKEN);
  const isUpstashConfigured = hasUpstashUrl && hasUpstashToken;

  if (!options.suppressWarnings && hasUpstashUrl !== hasUpstashToken) {
    warnOnce(
      "upstash-partial",
      "Partial Upstash Redis configuration detected; falling back to in-memory rate limiting."
    );
  } else if (!options.suppressWarnings && !isUpstashConfigured) {
    warnOnce(
      "upstash-missing",
      "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN unset; using in-memory rate limiter fallback."
    );
  }

  const isTurnstileConfigured = Boolean(parsed.TURNSTILE_SECRET_KEY);
  if (!options.suppressWarnings && !isTurnstileConfigured) {
    warnOnce(
      "turnstile-missing",
      "TURNSTILE_SECRET_KEY is unset; Turnstile verification will use safe fallback bypass."
    );
  }

  if (!options.suppressWarnings && !parsed.SUPABASE_SERVICE_ROLE_KEY) {
    warnOnce(
      "service-role-missing",
      "SUPABASE_SERVICE_ROLE_KEY is unset; privileged admin client calls are disabled."
    );
  }

  return {
    NODE_ENV: parsed.NODE_ENV,
    SUPABASE_SERVICE_ROLE_KEY: parsed.SUPABASE_SERVICE_ROLE_KEY,
    UPSTASH_REDIS_REST_URL: isUpstashConfigured ? parsed.UPSTASH_REDIS_REST_URL : undefined,
    UPSTASH_REDIS_REST_TOKEN: isUpstashConfigured ? parsed.UPSTASH_REDIS_REST_TOKEN : undefined,
    TURNSTILE_SECRET_KEY: parsed.TURNSTILE_SECRET_KEY,
    QR_SIGNING_SECRET: qrSecret,
    isUsingDevQrFallback,
    isUpstashConfigured,
    isTurnstileConfigured,
  };
}

let cachedPublicEnv: PublicEnv | null = null;
let cachedServerEnv: ServerEnv | null = null;

/**
 * Returns validated public environment variables safe for both client and server.
 * Explicitly accesses NEXT_PUBLIC_* properties so Next.js inlines them in client bundles.
 */
export function getPublicEnv(): PublicEnv {
  if (cachedPublicEnv) {
    return cachedPublicEnv;
  }

  cachedPublicEnv = parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_DEFAULT_SCHOOL_SLUG: process.env.NEXT_PUBLIC_DEFAULT_SCHOOL_SLUG,
  });

  return cachedPublicEnv;
}

/**
 * Returns validated server-only environment variables.
 * Throws if accidentally invoked inside a browser environment.
 */
export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() must not be called in a browser context");
  }

  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  cachedServerEnv = parseServerEnv({
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    QR_SIGNING_SECRET: process.env.QR_SIGNING_SECRET,
  });

  return cachedServerEnv;
}

/** Clears cached environment snapshots (intended for unit tests). */
export function resetEnvCacheForTesting(): void {
  cachedPublicEnv = null;
  cachedServerEnv = null;
}
