/**
 * Assert a condition holds. Narrows the type on the truthy path.
 * Use for programmer errors (broken invariants), not user-facing failures:
 * user-facing command failures return a Result object instead of throwing.
 */
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invariant failed: ${message}`);
  }
}
