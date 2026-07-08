import { BaseImage, type ProcessContext } from "@ngrok/webernetes";

import { htmlResponse, textResponse } from "./http";
import { logSink } from "./log-sink";

/**
 * `klab/web-app:1.0.0` — a simple web server used across levels and docs.
 *
 * NOT a real OCI image: this is a TypeScript fake whose behavior is defined here.
 *
 * Endpoints:
 *   GET /healthz -> 200  (health/liveness signal — always healthy)
 *   GET /readyz  -> 404  (this app has no /readyz; used by the readiness-probe level)
 *   GET /        -> 200  (landing response, reached only when routed via a Service
 *                         that has this pod as a ready endpoint)
 *
 * The readiness-probe puzzle is a YAML mistake (probing /readyz instead of /healthz),
 * not an app bug — so the app's behavior here is fixed and correct.
 */
export class WebAppImage extends BaseImage {
  static readonly imageName = "klab/web-app";
  static readonly imageVersion = "1.0.0";
  readonly defaultCommand: string[] = ["web-app"];

  override async exec(ctx: ProcessContext, argv: readonly string[]): Promise<number> {
    if (argv[0] !== "web-app") {
      return super.exec(ctx, argv);
    }
    const port = toPort(ctx.env.get("PORT"), 8080);
    const log = (message: string) =>
      logSink.append({
        namespace: ctx.pod.namespace,
        pod: ctx.pod.name,
        container: ctx.container.name,
        message,
      });

    log(`web-app v${WebAppImage.imageVersion} starting`);
    log(`listening on :${port} — health probe at GET /healthz`);

    ctx.listenHttp(port, async (_ctx, request) => {
      const path = request.url.pathname;
      log(`${request.method} ${path}`);
      if (path === "/healthz") return textResponse(200, "ok");
      if (path === "/readyz") return textResponse(404, "not found");
      if (path === "/") {
        return htmlResponse(
          200,
          "<!doctype html><title>web-app</title><h1>web-app</h1><p>Hello from klab.</p>\n",
        );
      }
      return textResponse(404, "not found");
    });

    return ctx.waitUntilKilled();
  }
}

function toPort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
