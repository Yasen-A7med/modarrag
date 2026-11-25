import { afterEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  resetRateLimitStoreForTesting,
} from "@/infrastructure/security/rate-limiter";
import { parseServerEnv } from "@/lib/env";

describe("parseServerEnv", () => {
  it("resolves server env safely with optional Upstash/Turnstile/ServiceRole fallbacks", () => {
    const env = parseServerEnv(
      {
        NODE_ENV: "production",
        UPSTASH_REDIS_REST_URL: "",
        UPSTASH_REDIS_REST_TOKEN: "",
        TURNSTILE_SECRET_KEY: "",
      },
      { suppressWarnings: true }
    );

    expect(env.NODE_ENV).toBe("production");
    expect(env.isUpstashConfigured).toBe(false);
    expect(env.isTurnstileConfigured).toBe(false);
  });
});

describe("checkRateLimit memory fallback", () => {
  afterEach(() => {
    resetRateLimitStoreForTesting();
  });

  it("enforces sliding-window quotas per key cleanly when Upstash is unconfigured", async () => {
    const first = await checkRateLimit("student-1", { limit: 2, windowMs: 60_000 });
    const second = await checkRateLimit("student-1", { limit: 2, windowMs: 60_000 });
    const third = await checkRateLimit("student-1", { limit: 2, windowMs: 60_000 });
    const otherKey = await checkRateLimit("student-2", { limit: 2, windowMs: 60_000 });

    expect(first.backend).toBe("memory");
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);

    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);

    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);

    expect(otherKey.allowed).toBe(true);
    expect(otherKey.remaining).toBe(1);
  });
});
