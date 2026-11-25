import { z } from "zod";
import { err, ok, type ActionResult } from "@/domain/common/result";

export const QR_TOKEN_VERSION = "v1" as const;

const uuidSchema = z.string().uuid();
const noncePattern = /^[A-Za-z0-9_-]{16,128}$/;
const hmacPattern = /^[A-Za-z0-9_-]{32,128}$/;

export interface QrTokenComponents {
  readonly version?: typeof QR_TOKEN_VERSION;
  readonly bookingId: string;
  readonly sessionId: string;
  readonly nonce: string;
}

export interface ParsedQrToken {
  readonly version: typeof QR_TOKEN_VERSION;
  readonly bookingId: string;
  readonly sessionId: string;
  readonly nonce: string;
  readonly hmac: string;
  readonly signingPayload: string;
}

export function buildQrSigningPayload(input: QrTokenComponents): string {
  const version = input.version ?? QR_TOKEN_VERSION;
  return `${version}.${input.bookingId}.${input.sessionId}.${input.nonce}`;
}

export function formatQrToken(
  input: QrTokenComponents & { readonly hmac: string }
): string {
  return `${buildQrSigningPayload(input)}.${input.hmac}`;
}

/**
 * Parses and validates the structural syntax of a `v1.{bookingId}.{sessionId}.{nonce}.{hmac}` QR token.
 * Cryptographic HMAC verification must still be performed server-side via `verifyQrToken`.
 */
export function parseQrToken(rawToken: string): ActionResult<ParsedQrToken> {
  const trimmed = rawToken.trim();
  if (trimmed.length === 0) {
    return err("INVALID_QR_TOKEN", "QR token is empty");
  }

  const parts = trimmed.split(".");
  if (parts.length !== 5) {
    return err("INVALID_QR_TOKEN", "QR token must contain exactly 5 dot-separated segments");
  }

  const [version, bookingId, sessionId, nonce, hmac] = parts;

  if (version !== QR_TOKEN_VERSION) {
    return err("INVALID_QR_TOKEN", "Unsupported QR token version");
  }

  if (!bookingId || !uuidSchema.safeParse(bookingId).success) {
    return err("INVALID_QR_TOKEN", "QR token contains an invalid booking identifier");
  }

  if (!sessionId || !uuidSchema.safeParse(sessionId).success) {
    return err("INVALID_QR_TOKEN", "QR token contains an invalid session identifier");
  }

  if (!nonce || !noncePattern.test(nonce)) {
    return err("INVALID_QR_TOKEN", "QR token contains a malformed nonce");
  }

  if (!hmac || !hmacPattern.test(hmac)) {
    return err("INVALID_QR_TOKEN", "QR token contains a malformed signature");
  }

  return ok({
    version: QR_TOKEN_VERSION,
    bookingId,
    sessionId,
    nonce,
    hmac,
    signingPayload: buildQrSigningPayload({ version, bookingId, sessionId, nonce }),
  });
}

export const QrTokenSchema = z
  .string()
  .trim()
  .superRefine((val, ctx) => {
    const parsed = parseQrToken(val);
    if (!parsed.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: parsed.error.message,
      });
    }
  });
