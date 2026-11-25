import { err, ok, type ActionResult } from "@/domain/common/result";
import { getServerEnv } from "@/lib/env";

const TURNSTILE_VERIFY_ENDPOINT =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileVerificationOutput {
  readonly verified: boolean;
  readonly skipped: boolean;
  readonly mode: "cloudflare" | "bypass";
}

export interface VerifyTurnstileOptions {
  readonly remoteIp?: string;
  readonly secretKey?: string;
  readonly fetchFn?: typeof fetch;
}

interface CloudflareTurnstileResponse {
  readonly success: boolean;
  readonly "error-codes"?: readonly string[];
}

/**
 * Verifies a Cloudflare Turnstile challenge token on the server.
 * When TURNSTILE_SECRET_KEY is unset, returns a safe bypass result so local/unconfigured
 * deployments continue operating without hard lockouts.
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  options: VerifyTurnstileOptions = {}
): Promise<ActionResult<TurnstileVerificationOutput>> {
  const secretKey = options.secretKey ?? getServerEnv().TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    return ok({
      verified: true,
      skipped: true,
      mode: "bypass",
    });
  }

  const trimmedToken = token?.trim() ?? "";
  if (trimmedToken.length === 0) {
    return err("BOT_CHECK_FAILED", "Human verification token is required");
  }

  const fetchImpl = options.fetchFn ?? fetch;
  const body = new URLSearchParams({
    secret: secretKey,
    response: trimmedToken,
  });

  if (options.remoteIp) {
    body.set("remoteip", options.remoteIp);
  }

  try {
    const response = await fetchImpl(TURNSTILE_VERIFY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      cache: "no-store",
    });

    if (!response.ok) {
      return err(
        "BOT_CHECK_FAILED",
        `Turnstile verification service returned HTTP ${response.status}`
      );
    }

    const payload = (await response.json()) as CloudflareTurnstileResponse;
    if (!payload.success) {
      return err("BOT_CHECK_FAILED", "Turnstile verification failed", {
        details: { errorCodes: payload["error-codes"] ?? [] },
      });
    }

    return ok({
      verified: true,
      skipped: false,
      mode: "cloudflare",
    });
  } catch (error) {
    return err("BOT_CHECK_FAILED", "Unable to reach Turnstile verification service", {
      details: {
        cause: error instanceof Error ? error.message : "unknown_error",
      },
    });
  }
}
