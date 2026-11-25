export type DomainErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "CAPACITY_FULL"
  | "ELIGIBILITY_DENIED"
  | "SCHEDULE_CONFLICT"
  | "TIME_OVERLAP"
  | "INVALID_QR_TOKEN"
  | "QR_EXPIRED"
  | "ALREADY_CHECKED_IN"
  | "RATE_LIMITED"
  | "BOT_CHECK_FAILED"
  | "INTERNAL_ERROR";

export interface AppError {
  readonly code: DomainErrorCode;
  readonly message: string;
  readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface CreateErrorOptions {
  readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
  readonly details?: Readonly<Record<string, unknown>>;
}

export function createAppError(
  code: DomainErrorCode,
  message: string,
  options?: CreateErrorOptions
): AppError {
  return {
    code,
    message,
    ...(options?.fieldErrors ? { fieldErrors: options.fieldErrors } : {}),
    ...(options?.details ? { details: options.details } : {}),
  };
}

/** Typed domain error suitable for throwing in internal invariants and boundaries. */
export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: DomainErrorCode, message: string, options?: CreateErrorOptions) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.fieldErrors = options?.fieldErrors;
    this.details = options?.details;
  }

  toAppError(): AppError {
    return createAppError(this.code, this.message, {
      fieldErrors: this.fieldErrors,
      details: this.details,
    });
  }
}

export function toHttpStatus(code: DomainErrorCode): number {
  switch (code) {
    case "VALIDATION_ERROR":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
    case "ELIGIBILITY_DENIED":
    case "BOT_CHECK_FAILED":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
    case "CAPACITY_FULL":
    case "SCHEDULE_CONFLICT":
    case "TIME_OVERLAP":
    case "ALREADY_CHECKED_IN":
      return 409;
    case "INVALID_QR_TOKEN":
    case "QR_EXPIRED":
      return 422;
    case "RATE_LIMITED":
      return 429;
    case "INTERNAL_ERROR":
      return 500;
  }
}
