export const SITE_ORIGIN = "https://klab-five.vercel.app";

export function absoluteUrl(pathname: string): string {
  return new URL(pathname, SITE_ORIGIN).toString();
}

/** Keep user-authored text from prematurely terminating an inline JSON-LD script. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
