/**
 * Result: an explicit success/failure value for user-facing operations
 * (command execution, manifest parsing, validation). Prefer this over throwing
 * for expected failures so the UI can render a helpful message instead of a crash.
 * Reserve thrown errors + `invariant` for programmer errors.
 */
export type Result<T, E = string> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): { readonly ok: true; readonly value: T } {
  return { ok: true, value };
}

export function err<E>(error: E): { readonly ok: false; readonly error: E } {
  return { ok: false, error };
}

export function isOk<T, E>(
  result: Result<T, E>,
): result is { readonly ok: true; readonly value: T } {
  return result.ok;
}
