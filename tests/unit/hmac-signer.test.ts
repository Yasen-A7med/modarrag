import { describe, expect, it } from "vitest";
import { parseQrToken } from "@/domain/booking/qr-token";
import { hashQrToken, signQrToken, verifyQrToken } from "@/infrastructure/security/hmac-signer";

const BOOKING_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_SESSION_ID = "33333333-3333-4333-8333-333333333333";
const TEST_SECRET = "test-qr-signing-secret-with-more-than-32-chars";

describe("hmac-signer QR tokens", () => {
  it("signs a QR token in v1.{bookingId}.{sessionId}.{nonce}.{hmac} format and hashes it", () => {
    const signed = signQrToken(
      { bookingId: BOOKING_ID, sessionId: SESSION_ID },
      TEST_SECRET
    );

    const segments = signed.token.split(".");
    expect(segments).toHaveLength(5);
    expect(segments[0]).toBe("v1");
    expect(segments[1]).toBe(BOOKING_ID);
    expect(segments[2]).toBe(SESSION_ID);
    expect(segments[3]).toMatch(/^[0-9a-f]{32}$/);
    expect(segments[4]).toMatch(/^[0-9a-f]{64}$/);

    expect(signed.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(signed.tokenHash).toBe(hashQrToken(signed.token));
  });

  it("verifies authentic QR tokens with matching session, booking, and tokenHash", () => {
    const signed = signQrToken(
      { bookingId: BOOKING_ID, sessionId: SESSION_ID },
      TEST_SECRET
    );

    const verification = verifyQrToken(signed.token, {
      expectedSessionId: SESSION_ID,
      expectedBookingId: BOOKING_ID,
      expectedTokenHash: signed.tokenHash,
      secret: TEST_SECRET,
    });

    expect(verification.ok).toBe(true);
    if (verification.ok) {
      expect(verification.data.bookingId).toBe(BOOKING_ID);
      expect(verification.data.sessionId).toBe(SESSION_ID);
      expect(verification.data.nonce).toBe(signed.nonce);
    }
  });

  it("rejects tampered tokens, wrong secrets, and mismatched session or hash", () => {
    const signed = signQrToken(
      { bookingId: BOOKING_ID, sessionId: SESSION_ID },
      TEST_SECRET
    );

    // Tamper signature last character
    const lastChar = signed.token.slice(-1);
    const tamperedSig = signed.token.slice(0, -1) + (lastChar === "a" ? "b" : "a");
    const tamperedResult = verifyQrToken(tamperedSig, { secret: TEST_SECRET });
    expect(tamperedResult.ok).toBe(false);
    if (!tamperedResult.ok) {
      expect(tamperedResult.error.code).toBe("INVALID_QR_TOKEN");
    }

    // Wrong signing secret
    const wrongSecretResult = verifyQrToken(signed.token, {
      secret: "another-completely-different-secret-32-chars",
    });
    expect(wrongSecretResult.ok).toBe(false);

    // Wrong expected sessionId
    const wrongSessionResult = verifyQrToken(signed.token, {
      expectedSessionId: OTHER_SESSION_ID,
      secret: TEST_SECRET,
    });
    expect(wrongSessionResult.ok).toBe(false);

    // Wrong expected tokenHash
    const wrongHashResult = verifyQrToken(signed.token, {
      expectedTokenHash: "0".repeat(64),
      secret: TEST_SECRET,
    });
    expect(wrongHashResult.ok).toBe(false);
  });

  it("rejects structurally malformed QR tokens during parsing", () => {
    expect(parseQrToken("").ok).toBe(false);
    expect(parseQrToken("v1.only.three").ok).toBe(false);
    expect(parseQrToken(`v2.${BOOKING_ID}.${SESSION_ID}.abcd1234abcd1234.${"a".repeat(64)}`).ok).toBe(
      false
    );
    expect(parseQrToken(`v1.not-a-uuid.${SESSION_ID}.abcd1234abcd1234.${"a".repeat(64)}`).ok).toBe(
      false
    );
  });
});
