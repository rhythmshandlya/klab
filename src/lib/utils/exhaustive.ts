/**
 * Compile-time exhaustiveness guard for discriminated unions.
 * Placing this in a `default`/`else` branch makes TypeScript error if a new
 * union member is added but not handled. Throws at runtime as a safety net.
 *
 * @example
 * switch (command.kind) {
 *   case "get": return runGet(command);
 *   case "describe": return runDescribe(command);
 *   default: return assertNever(command);
 * }
 */
export function assertNever(value: never, message = "Unhandled union member"): never {
  throw new Error(`${message}: ${JSON.stringify(value)}`);
}
