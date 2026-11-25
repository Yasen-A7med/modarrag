import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getServerEnv } from "@/lib/env";

export interface RateLimitOptions {
  readonly limit?: number;
  readonly windowMs?: number;
  readonly prefix?: string;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: number;
  readonly backend: "upstash" | "memory";
}

const DEFAULT_LIMIT = 30;
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_PREFIX = "modarrag:rl";
const MAX_MEMORY_KEYS = 5_000;

const memoryStore = new Map<string, number[]>();
const upstashLimiterCache = new Map<string, Ratelimit>();
let cachedRedisClient: Redis | null = null;

function getUpstashLimiter(
  limit: number,
  windowMs: number,
  prefix: string
): Ratelimit | null {
  const env = getServerEnv();
  if (!env.isUpstashConfigured || !env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  if (!cachedRedisClient) {
    cachedRedisClient = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const cacheKey = `${prefix}:${limit}:${windowSeconds}`;
  const existing = upstashLimiterCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const limiter = new Ratelimit({
    redis: cachedRedisClient,
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    prefix,
    analytics: false,
  });

  upstashLimiterCache.set(cacheKey, limiter);
  return limiter;
}

function pruneMemoryStoreIfNeeded(cutoffMs: number): void {
  if (memoryStore.size <= MAX_MEMORY_KEYS) {
    return;
  }

  for (const [key, timestamps] of memoryStore.entries()) {
    const active = timestamps.filter((ts) => ts > cutoffMs);
    if (active.length === 0) {
      memoryStore.delete(key);
    } else {
      memoryStore.set(key, active);
    }
  }
}

function checkMemoryRateLimit(
  compositeKey: string,
  limit: number,
  windowMs: number,
  nowMs: number
): RateLimitResult {
  const cutoffMs = nowMs - windowMs;
  pruneMemoryStoreIfNeeded(cutoffMs);

  const existing = memoryStore.get(compositeKey) ?? [];
  const activeTimestamps = existing.filter((ts) => ts > cutoffMs);

  if (activeTimestamps.length >= limit) {
    const oldestActive = activeTimestamps[0] ?? nowMs;
    memoryStore.set(compositeKey, activeTimestamps);
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: oldestActive + windowMs,
      backend: "memory",
    };
  }

  activeTimestamps.push(nowMs);
  memoryStore.set(compositeKey, activeTimestamps);

  const oldestActive = activeTimestamps[0] ?? nowMs;
  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - activeTimestamps.length),
    resetAt: oldestActive + windowMs,
    backend: "memory",
  };
}

/**
 * Applies sliding-window rate limiting using Upstash Redis when configured,
 * falling back cleanly to an in-memory sliding window when Upstash env vars are unset.
 */
export async function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const limit = Math.max(1, options.limit ?? DEFAULT_LIMIT);
  const windowMs = Math.max(1000, options.windowMs ?? DEFAULT_WINDOW_MS);
  const prefix = options.prefix ?? DEFAULT_PREFIX;
  const nowMs = Date.now();

  const upstash = getUpstashLimiter(limit, windowMs, prefix);
  if (upstash) {
    try {
      const outcome = await upstash.limit(identifier);
      return {
        allowed: outcome.success,
        limit: outcome.limit,
        remaining: Math.max(0, outcome.remaining),
        resetAt: outcome.reset,
        backend: "upstash",
      };
    } catch {
      // Fail gracefully to in-memory limiting if Upstash REST endpoint is temporarily unreachable.
    }
  }

  return checkMemoryRateLimit(`${prefix}:${identifier}`, limit, windowMs, nowMs);
}

/** Clears the in-memory rate-limit store (intended for unit tests). */
export function resetRateLimitStoreForTesting(): void {
  memoryStore.clear();
}
