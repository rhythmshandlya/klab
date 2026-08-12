import { BaseImage, type ProcessContext } from "@ngrok/webernetes";

/**
 * `klab/debug-tools:1.0.0`: a long-running toolbox pod for hands-on debugging.
 * NOT a real OCI image. Its default command sleeps so learners can `kubectl exec`
 * into it. When exec'd with `curl <url>`, it performs a simulated in-cluster request
 * via the pod's network context and prints the response body.
 */
export class DebugToolsImage extends BaseImage {
  static readonly imageName = "klab/debug-tools";
  static readonly imageVersion = "1.0.0";
  readonly defaultCommand: string[] = ["sleep", "infinity"];

  override async exec(ctx: ProcessContext, argv: readonly string[]): Promise<number> {
    if (argv[0] === "curl") {
      return this.curl(ctx, argv.slice(1));
    }
    // Everything else (sleep, cat, env, sh, …) is handled by BaseImage's shell.
    return super.exec(ctx, argv);
  }

  private async curl(ctx: ProcessContext, args: readonly string[]): Promise<number> {
    const url = args.find((arg) => !arg.startsWith("-"));
    if (!url) {
      ctx.writeStderr("curl: no URL specified\n");
      return 2;
    }
    try {
      const response = await ctx.fetch(url);
      ctx.writeStdout(response.body ?? "");
      return response.status >= 200 && response.status < 400 ? 0 : 22;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.writeStderr(`curl: (6) could not resolve or reach host: ${message}\n`);
      return 6;
    }
  }
}
