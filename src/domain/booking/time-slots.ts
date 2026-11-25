import { DomainError } from "@/domain/common/errors";

export interface TimeInterval {
  readonly startsAt: Date | string;
  readonly endsAt: Date | string;
}

export interface BufferedSessionInterval extends TimeInterval {
  readonly id?: string;
  readonly bufferMinutes?: number;
}

export interface OccupiedRange {
  readonly startMs: number;
  readonly endMs: number;
  readonly bufferedEndMs: number;
  readonly startsAtIso: string;
  readonly endsAtIso: string;
  readonly bufferedEndsAtIso: string;
}

const MS_PER_MINUTE = 60_000;

export function toEpochMs(value: Date | string): number {
  const date = value instanceof Date ? value : new Date(value);
  const ms = date.getTime();
  if (Number.isNaN(ms)) {
    throw new DomainError("VALIDATION_ERROR", "Invalid timestamp provided for time slot");
  }
  return ms;
}

export function validateTimeInterval(interval: TimeInterval): {
  readonly startMs: number;
  readonly endMs: number;
} {
  const startMs = toEpochMs(interval.startsAt);
  const endMs = toEpochMs(interval.endsAt);

  if (startMs >= endMs) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Time interval end must be strictly after start"
    );
  }

  return { startMs, endMs };
}

/**
 * Computes half-open occupied range `[startsAt, endsAt + bufferMinutes)` matching
 * PostgreSQL `tstzrange(starts_at, ends_at + make_interval(mins => buffer_minutes), '[)')`.
 */
export function computeOccupiedRange(
  interval: TimeInterval,
  bufferMinutes = 0
): OccupiedRange {
  if (!Number.isFinite(bufferMinutes) || bufferMinutes < 0) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Buffer minutes must be a finite non-negative number"
    );
  }

  const { startMs, endMs } = validateTimeInterval(interval);
  const bufferedEndMs = endMs + bufferMinutes * MS_PER_MINUTE;

  return {
    startMs,
    endMs,
    bufferedEndMs,
    startsAtIso: new Date(startMs).toISOString(),
    endsAtIso: new Date(endMs).toISOString(),
    bufferedEndsAtIso: new Date(bufferedEndMs).toISOString(),
  };
}

/** Half-open `[start, end)` interval overlap predicate. Touching boundaries do not overlap. */
export function doHalfOpenIntervalsOverlap(
  aStartMs: number,
  aEndMs: number,
  bStartMs: number,
  bEndMs: number
): boolean {
  return aStartMs < bEndMs && bStartMs < aEndMs;
}

/**
 * Checks whether two hall or teacher sessions overlap when accounting for each
 * session's turnover buffer `[startsAt, endsAt + bufferMinutes)`.
 */
export function doBufferedSessionsOverlap(
  a: BufferedSessionInterval,
  b: BufferedSessionInterval,
  defaultBufferMinutes = 0
): boolean {
  const aBuffer = a.bufferMinutes ?? defaultBufferMinutes;
  const bBuffer = b.bufferMinutes ?? defaultBufferMinutes;

  const rangeA = computeOccupiedRange(a, aBuffer);
  const rangeB = computeOccupiedRange(b, bBuffer);

  return doHalfOpenIntervalsOverlap(
    rangeA.startMs,
    rangeA.bufferedEndMs,
    rangeB.startMs,
    rangeB.bufferedEndMs
  );
}

/**
 * Checks whether two student bookings overlap in wall-clock session time
 * (optionally enforcing a transition buffer between back-to-back sessions).
 */
export function doStudentSessionsOverlap(
  a: TimeInterval,
  b: TimeInterval,
  transitionBufferMinutes = 0
): boolean {
  return doBufferedSessionsOverlap(
    { ...a, bufferMinutes: transitionBufferMinutes },
    { ...b, bufferMinutes: transitionBufferMinutes }
  );
}

/** Filters existing sessions that conflict with a candidate session slot. */
export function findOverlappingSessions<T extends BufferedSessionInterval>(
  candidate: BufferedSessionInterval,
  existing: readonly T[],
  defaultBufferMinutes = 0
): readonly T[] {
  return existing.filter((other) => {
    if (candidate.id !== undefined && other.id !== undefined && candidate.id === other.id) {
      return false;
    }
    return doBufferedSessionsOverlap(candidate, other, defaultBufferMinutes);
  });
}

export function computeDurationMinutes(interval: TimeInterval): number {
  const { startMs, endMs } = validateTimeInterval(interval);
  return Math.round((endMs - startMs) / MS_PER_MINUTE);
}
