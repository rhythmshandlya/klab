import { BaseImage, type ProcessContext } from "@ngrok/webernetes";

import { textResponse } from "./http";
import { logSink } from "./log-sink";

/**
 * `klab/web-app:2.0.0`: the "bad release" build of web-app. NOT a real OCI image.
 *
 * The process starts and keeps running, but a (simulated) broken asset build means it
 * can never serve successfully: /healthz and / both answer 500. With a correct
 * readiness probe against /healthz the pods therefore never become Ready: a rollout
 * that must be rolled back (the Rolling Update level). The root cause is discoverable
 * in the logs.
 */
export class WebAppV2Image extends BaseImage {
  static readonly imageName = "klab/web-app";
  static readonly imageVersion = "2.0.0";
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

    log(`web-app v${WebAppV2Image.imageVersion} starting`);
    log("FATAL: asset manifest missing from build: /healthz will report 500 until rebuilt");
    log(`listening on :${port}`);

    ctx.listenHttp(port, async (_ctx, request) => {
      const path = request.url.pathname;
      log(`${request.method} ${path} -> 500`);
      return textResponse(500, "internal error: asset manifest missing");
    });

    return ctx.waitUntilKilled();
  }
}

function toPort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
