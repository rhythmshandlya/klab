import { GET as getPlaygrounds, POST as mutatePlaygrounds } from "../playgrounds/route";

export const dynamic = "force-dynamic";

/** Compatibility endpoint for stale clients during the Labs → Playgrounds rename. */
export async function GET(request: Request): Promise<Response> {
  return getPlaygrounds(request);
}

export async function POST(request: Request): Promise<Response> {
  return mutatePlaygrounds(request);
}
