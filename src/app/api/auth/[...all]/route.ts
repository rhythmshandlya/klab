import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/lib/auth/server";
import { isAuthConfigured } from "@/lib/env";

/**
 * Better Auth catch-all handler. When auth isn't configured (no DB/secret/provider:
 * e.g. the guest static build or CI), respond 501 instead of constructing the auth
 * instance, so the build never requires a database and guests are unaffected.
 */

export const dynamic = "force-dynamic";

function notConfigured(): Response {
  return new Response(JSON.stringify({ error: "Authentication is not configured." }), {
    status: 501,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(request: Request): Promise<Response> {
  if (!isAuthConfigured()) return notConfigured();
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request): Promise<Response> {
  if (!isAuthConfigured()) return notConfigured();
  return toNextJsHandler(getAuth()).POST(request);
}
