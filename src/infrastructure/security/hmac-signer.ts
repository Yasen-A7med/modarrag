import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  QR_TOKEN_VERSION,
  buildQrSigningPayload,
  formatQrToken,
  parseQrToken,
  type ParsedQrToken,
} from "@/domain/booking/qr-token";
import { err, ok, type ActionResult } from "@/domain/common/result";
import { getServerEnv } from "@/lib/env";

export interface SignQrTokenInput {
  readonly bookingId: string;
  readonly sessionId: string;
  readonly nonce?: string;
}

export interface SignedQrToken {
  readonly token: string;
  readonly tokenHash: string;
  readonly payload: string;
  readonly nonce: string;
  readonly signature: string;
}

export interface VerifyQrTokenOptions {
  readonly expectedSessionId?: string;
  readonly expectedBookingId?: string;
  readonly expectedTokenHash?: string;
  readonly secret?: string;
}

function resolveSigningSecret(secretOverride?: string): string {
  const secret = secretOverride ?? getServerEnv().QR_SIGNING_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("QR signing secret is missing or too short");
  }
  return secret;
}

function constantTimeEqualUtf8(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/** Computes a SHA-256 hex digest of the full signed QR token for DB `qr_token_hash` storage. */
export function hashQrToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Computes HMAC-SHA256 hex signature for a canonical QR signing payload. */
export function computeQrHmac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/** Generates a signed QR token `v1.{bookingId}.{sessionId}.{nonce}.{hmac}` and its SHA-256 hash. */
export function signQrToken(
  input: SignQrTokenInput,
  secretOverride?: string
): SignedQrToken {
  const secret = resolveSigningSecret(secretOverride);
  const nonce = input.nonce ?? randomBytes(16).toString("hex");
  const payload = buildQrSigningPayload({
    version: QR_TOKEN_VERSION,
    bookingId: input.bookingId,
    sessionId: input.sessionId,
    nonce,
  });

  const signature = computeQrHmac(payload, secret);
  const token = formatQrToken({
    version: QR_TOKEN_VERSION,
    bookingId: input.bookingId,
    sessionId: input.sessionId,
    nonce,
    hmac: signature,
  });

  return {
    token,
    tokenHash: hashQrToken(token),
    payload,
    nonce,
    signature,
  };
}

/**
 * Verifies a QR token using structural validation, constant-time HMAC comparison,
 * optional session/booking assertions, and optional SHA-256 hash comparison.
 */
export function verifyQrToken(
  rawToken: string,
  options: VerifyQrTokenOptions = {}
): ActionResult<ParsedQrToken> {
  const parsedResult = parseQrToken(rawToken);
  if (!parsedResult.ok) {
    return parsedResult;
  }

  const parsed = parsedResult.data;
  const secret = resolveSigningSecret(options.secret);
  const expectedSignature = computeQrHmac(parsed.signingPayload, secret);

  if (!constantTimeEqualUtf8(parsed.hmac, expectedSignature)) {
    return err("INVALID_QR_TOKEN", "QR token signature verification failed");
  }

  if (options.expectedSessionId && parsed.sessionId !== options.expectedSessionId) {
    return err("INVALID_QR_TOKEN", "QR token does not match the active session");
  }

  if (options.expectedBookingId && parsed.bookingId !== options.expectedBookingId) {
    return err("INVALID_QR_TOKEN", "QR token does not match the expected booking");
  }

  if (options.expectedTokenHash) {
    const actualHash = hashQrToken(rawToken.trim());
    if (!constantTimeEqualUtf8(actualHash, options.expectedTokenHash.trim().toLowerCase())) {
      return err("INVALID_QR_TOKEN", "QR token hash mismatch");
    }
  }

  return ok(parsed);
}
