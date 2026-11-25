import { afterEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  resetRateLimitStoreForTesting,
} from "@/infrastructure/security/rate-limiter";
import { DEV_QR_SIGNING_SECRET_FALLBACK, parseServerEnv } from "@/lib/env";

describe("parseServerEnv", () => {
  it("uses development fallback for QR_SIGNING_SECRET outside production", () => {
    const env = parseServerEnv(
      {
        NODE_ENV: "development",
        UPSTASH_REDIS_REST_URL: "",
        UPSTASH_REDIS_REST_TOKEN: "",
        TURNSTILE_SECRET_KEY: "",
        QR_SIGNING_SECRET: "",
      },
      { suppressWarnings: true }
    );

    expect(env.QR_SIGNING_SECRET).toBe(DEV_QR_SIGNING_SECRET_FALLBACK);
    expect(env.isUsingDevQrFallback).toBe(true);
    expect(env.isUpstashConfigured).toBe(false);
    expect(env.isTurnstileConfigured).toBe(false);
  });

  it("requires a strong non-fallback QR_SIGNING_SECRET in production", () => {
    expect(() =>
      parseServerEnv(
        {
          NODE_ENV: "production",
          QR_SIGNING_SECRET: "",
        },
        { suppressWarnings: true }
      )
    ).toThrow();

    expect(() =>
      parseServerEnv(
        {
          NODE_ENV: "production",
          QR_SIGNING_SECRET: DEV_QR_SIGNING_SECRET_FALLBACK,
        },
        { suppressWarnings: true }
      )
    ).toThrow();

    const validProd = parseServerEnv(
      {
        NODE_ENV: "production",
        QR_SIGNING_SECRET: "prod-secret-key-with-plenty-of-entropy-123456",
      },
      { suppressWarnings: true }
    );
    expect(validProd.isUsingDevQrFallback).toBe(false);
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
