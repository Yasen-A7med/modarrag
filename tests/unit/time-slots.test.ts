import { describe, expect, it } from "vitest";
import { DomainError } from "@/domain/common/errors";
import {
  computeDurationMinutes,
  computeOccupiedRange,
  doBufferedSessionsOverlap,
  doHalfOpenIntervalsOverlap,
  doStudentSessionsOverlap,
  findOverlappingSessions,
} from "@/domain/booking/time-slots";

describe("time-slots buffer and overlap rules", () => {
  const sessionA = {
    id: "sess-a",
    startsAt: "2026-12-01T10:00:00.000Z",
    endsAt: "2026-12-01T12:00:00.000Z",
    bufferMinutes: 15,
  };

  it("computes occupied range including turnover buffer minutes", () => {
    const range = computeOccupiedRange(sessionA, 15);
    expect(range.startsAtIso).toBe("2026-12-01T10:00:00.000Z");
    expect(range.endsAtIso).toBe("2026-12-01T12:00:00.000Z");
    expect(range.bufferedEndsAtIso).toBe("2026-12-01T12:15:00.000Z");
    expect(computeDurationMinutes(sessionA)).toBe(120);
  });

  it("treats touching half-open intervals as non-overlapping", () => {
    const aStart = Date.parse("2026-12-01T10:00:00.000Z");
    const aEnd = Date.parse("2026-12-01T12:15:00.000Z");
    const bStart = Date.parse("2026-12-01T12:15:00.000Z");
    const bEnd = Date.parse("2026-12-01T14:15:00.000Z");

    expect(doHalfOpenIntervalsOverlap(aStart, aEnd, bStart, bEnd)).toBe(false);
    expect(doHalfOpenIntervalsOverlap(aStart, aEnd, bStart - 1, bEnd)).toBe(true);
  });

  it("detects buffer violations before and after an existing hall session", () => {
    const immediateAfter = {
      id: "sess-b",
      startsAt: "2026-12-01T12:00:00.000Z",
      endsAt: "2026-12-01T14:00:00.000Z",
      bufferMinutes: 15,
    };
    expect(doBufferedSessionsOverlap(sessionA, immediateAfter)).toBe(true);

    const exactBufferAfter = {
      id: "sess-c",
      startsAt: "2026-12-01T12:15:00.000Z",
      endsAt: "2026-12-01T14:15:00.000Z",
      bufferMinutes: 15,
    };
    expect(doBufferedSessionsOverlap(sessionA, exactBufferAfter)).toBe(false);

    const tooCloseBefore = {
      id: "sess-d",
      startsAt: "2026-12-01T08:00:00.000Z",
      endsAt: "2026-12-01T09:50:00.000Z",
      bufferMinutes: 15,
    };
    expect(doBufferedSessionsOverlap(sessionA, tooCloseBefore)).toBe(true);

    const exactBufferBefore = {
      id: "sess-e",
      startsAt: "2026-12-01T08:00:00.000Z",
      endsAt: "2026-12-01T09:45:00.000Z",
      bufferMinutes: 15,
    };
    expect(doBufferedSessionsOverlap(sessionA, exactBufferBefore)).toBe(false);
  });

  it("checks student wall-clock overlaps and optional transition buffers", () => {
    const backToBack = {
      startsAt: "2026-12-01T12:00:00.000Z",
      endsAt: "2026-12-01T13:30:00.000Z",
    };

    expect(doStudentSessionsOverlap(sessionA, backToBack)).toBe(false);
    expect(doStudentSessionsOverlap(sessionA, backToBack, 15)).toBe(true);

    const overlapping = {
      startsAt: "2026-12-01T11:30:00.000Z",
      endsAt: "2026-12-01T13:00:00.000Z",
    };
    expect(doStudentSessionsOverlap(sessionA, overlapping)).toBe(true);
  });

  it("ignores the session's own ID when finding conflicts for rescheduling", () => {
    const candidate = { ...sessionA };
    const otherConflict = {
      id: "sess-conflict",
      startsAt: "2026-12-01T11:00:00.000Z",
      endsAt: "2026-12-01T13:00:00.000Z",
      bufferMinutes: 15,
    };
    const safeLater = {
      id: "sess-safe",
      startsAt: "2026-12-01T12:15:00.000Z",
      endsAt: "2026-12-01T14:00:00.000Z",
      bufferMinutes: 15,
    };

    const conflicts = findOverlappingSessions(candidate, [
      sessionA,
      otherConflict,
      safeLater,
    ]);
    expect(conflicts.map((s) => s.id)).toEqual(["sess-conflict"]);
  });

  it("throws VALIDATION_ERROR on invalid intervals or negative buffer", () => {
    expect(() =>
      computeOccupiedRange(
        {
          startsAt: "2026-12-01T12:00:00.000Z",
          endsAt: "2026-12-01T12:00:00.000Z",
        },
        15
      )
    ).toThrow(DomainError);

    expect(() => computeOccupiedRange(sessionA, -5)).toThrow(DomainError);
    expect(() =>
      computeOccupiedRange({ startsAt: "not-a-date", endsAt: sessionA.endsAt }, 0)
    ).toThrow(DomainError);
  });
});
