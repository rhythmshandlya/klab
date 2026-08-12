import { BaseImage, type ProcessContext } from "@ngrok/webernetes";

import { textResponse } from "./http";
import { logSink } from "./log-sink";

/**
 * `klab/web-app:0.9.0`: the deprecated legacy build of web-app. NOT a real OCI image.
 *
 * Deliberately insidious: its /healthz still answers 200, so a pod running it becomes
 * READY and joins any matching Service, but every real request (GET /) answers 500.
 * Powers the Zombie ReplicaSet level, where an orphaned ReplicaSet keeps one of these
 * alive and poisons a share of production traffic.
 */
export class WebAppLegacyImage extends BaseImage {
  static readonly imageName = "klab/web-app";
  static readonly imageVersion = "0.9.0";
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

    log(`web-app v${WebAppLegacyImage.imageVersion} (legacy build) starting`);
    log(`listening on :${port}: this version is deprecated`);

    ctx.listenHttp(port, async (_ctx, request) => {
      const path = request.url.pathname;
      log(`${request.method} ${path}`);
      if (path === "/healthz") return textResponse(200, "ok");
      return textResponse(500, "legacy build: this version has been retired\n");
    });

    return ctx.waitUntilKilled();
  }
}

function toPort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
