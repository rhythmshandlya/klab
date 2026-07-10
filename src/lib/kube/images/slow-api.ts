import { BaseImage, type ProcessContext } from "@ngrok/webernetes";

import { jsonResponse, textResponse } from "./http";
import { logSink } from "./log-sink";

/** A deterministic process that needs five seconds before it opens its HTTP listener. */
export class SlowApiImage extends BaseImage {
  static readonly imageName = "klab/slow-api";
  static readonly imageVersion = "1.0.0";
  readonly defaultCommand: string[] = ["slow-api"];

  override async exec(ctx: ProcessContext, argv: readonly string[]): Promise<number> {
    if (argv[0] !== "slow-api") return super.exec(ctx, argv);

    const log = (message: string) =>
      logSink.append({
        namespace: ctx.pod.namespace,
        pod: ctx.pod.name,
        container: ctx.container.name,
        message,
      });

    log("slow-api starting: warming caches for 5 seconds");
    await ctx.sleep(5_000);
    log("startup complete; listening on :8080");

    ctx.listenHttp(8080, async (_ctx, request) => {
      if (request.url.pathname === "/healthz") return textResponse(200, "ok");
      if (request.url.pathname === "/") return jsonResponse(200, { status: "ready" });
      return textResponse(404, "not found");
    });

    return ctx.waitUntilKilled();
  }
}
