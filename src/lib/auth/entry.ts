export const GUEST_ENTRY_COOKIE = "klab_guest_entry";
export const GUEST_ENTRY_VALUE = "1";
export const GUEST_ENTRY_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const PRODUCT_HOME = "/problems";

const PRODUCT_PREFIXES = ["/problems", "/playground", "/docs", "/community", "/account"];

export function isProductPath(pathname: string): boolean {
  return PRODUCT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Accept only same-origin product destinations supplied by our own entry redirect. */
export function safeEntryDestination(
  value: string | string[] | undefined,
  fallback = PRODUCT_HOME,
): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return fallback;

  try {
    const url = new URL(candidate, "https://klab.local");
    if (url.origin !== "https://klab.local" || !isProductPath(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function homeEntryDestination({
  hasSession,
  hasGuestEntry,
  requestedDestination,
}: {
  hasSession: boolean;
  hasGuestEntry: boolean;
  requestedDestination: string;
}): string | null {
  return hasSession || hasGuestEntry ? requestedDestination : null;
}
