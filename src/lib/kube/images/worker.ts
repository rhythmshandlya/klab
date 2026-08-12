import { BaseImage, type ProcessContext } from "@ngrok/webernetes";

import { jsonResponse, textResponse } from "./http";
import { logSink } from "./log-sink";

/**
 * `klab/worker:1.0.0`: a queue worker that REQUIRES a `DATABASE_URL` env var.
 * NOT a real OCI image.
 *
 * Behavior:
 *   - `DATABASE_URL` unset  -> logs a FATAL line and exits 1. The kubelet restarts it,
 *                              producing a genuine CrashLoopBackOff (the CrashLoop level).
 *   - `DATABASE_URL` set    -> logs the connection, serves GET /healthz -> 200 and
 *                              GET / -> 200 with queue status.
 */
export class WorkerImage extends BaseImage {
  static readonly imageName = "klab/worker";
  static readonly imageVersion = "1.0.0";
  readonly defaultCommand: string[] = ["worker"];

  override async exec(ctx: ProcessContext, argv: readonly string[]): Promise<number> {
    if (argv[0] !== "worker") {
      return super.exec(ctx, argv);
    }
    const log = (message: string) =>
      logSink.append({
        namespace: ctx.pod.namespace,
        pod: ctx.pod.name,
        container: ctx.container.name,
        message,
      });

    log(`worker v${WorkerImage.imageVersion} starting`);
    const databaseUrl = ctx.env.get("DATABASE_URL");
    if (!databaseUrl) {
      log("FATAL: DATABASE_URL is not set: cannot connect to the job queue, exiting");
      return 1;
    }

    const port = toPort(ctx.env.get("PORT"), 8080);
    log(`connected to ${databaseUrl}`);
    log(`listening on :${port}: health probe at GET /healthz`);

    ctx.listenHttp(port, async (_ctx, request) => {
      const path = request.url.pathname;
      if (path === "/healthz") return textResponse(200, "ok");
      if (path === "/") return jsonResponse(200, { worker: "running", queue: "draining" });
      return textResponse(404, "not found");
    });

    return ctx.waitUntilKilled();
  }
}

function toPort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
