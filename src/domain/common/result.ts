import { createAppError, type AppError, type CreateErrorOptions, type DomainErrorCode } from "./errors";

export type ActionResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: AppError };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function err<T = never>(
  code: DomainErrorCode,
  message: string,
  options?: CreateErrorOptions
): ActionResult<T> {
  return {
    ok: false,
    error: createAppError(code, message, options),
  };
}

export function isOk<T>(result: ActionResult<T>): result is { readonly ok: true; readonly data: T } {
  return result.ok;
}

export function isErr<T>(
  result: ActionResult<T>
): result is { readonly ok: false; readonly error: AppError } {
  return !result.ok;
}

export function mapResult<T, U>(
  result: ActionResult<T>,
  mapper: (value: T) => U
): ActionResult<U> {
  return result.ok ? ok(mapper(result.data)) : result;
}
