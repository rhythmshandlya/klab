import { BaseImage, type ProcessContext } from "@ngrok/webernetes";

import { jsonResponse, textResponse } from "./http";
import { logSink } from "./log-sink";

/**
 * `klab/api:1.0.0`: a service that calls another service by DNS name, to teach
 * service discovery and DNS. NOT a real OCI image.
 *
 * Endpoints:
 *   GET /healthz  -> 200
 *   GET /         -> proxies to UPSTREAM_URL (default http://web-svc/) and reports
 *                    the upstream status, demonstrating in-cluster DNS resolution.
 */
export class ApiImage extends BaseImage {
  static readonly imageName = "klab/api";
  static readonly imageVersion = "1.0.0";
  readonly defaultCommand: string[] = ["api"];

  override async exec(ctx: ProcessContext, argv: readonly string[]): Promise<number> {
    if (argv[0] !== "api") {
      return super.exec(ctx, argv);
    }
    const port = toPort(ctx.env.get("PORT"), 8080);
    const upstream = ctx.env.get("UPSTREAM_URL") ?? "http://web-svc/";
    const log = (message: string) =>
      logSink.append({
        namespace: ctx.pod.namespace,
        pod: ctx.pod.name,
        container: ctx.container.name,
        message,
      });

    log(`api v${ApiImage.imageVersion} starting on :${port}`);
    log(`upstream configured as ${upstream}`);

    ctx.listenHttp(port, async (_ctx, request) => {
      if (request.url.pathname === "/healthz") return textResponse(200, "ok");
      try {
        const response = await ctx.fetch(upstream);
        log(`GET ${upstream} -> ${response.status}`);
        // A DNS connection alone is not success: preserve the upstream status so a
        // typo in its path (404) or an unhealthy dependency (5xx) remains observable
        // to both callers and level validators.
        return jsonResponse(response.status, { upstream, status: response.status });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`upstream call failed: ${message}`);
        return jsonResponse(502, { upstream, error: message });
      }
    });

    return ctx.waitUntilKilled();
  }
}

function toPort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
