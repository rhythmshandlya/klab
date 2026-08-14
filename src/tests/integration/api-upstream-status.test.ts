import { afterEach, describe, expect, it } from "vitest";

import { dnsResolutionFailure } from "@/content/levels/dns-resolution-failure";
import { createProblemEngine, type ProblemEngine } from "@/lib/kube/problem-engine";
import type { ProbeResult } from "@/lib/kube/simulator";

async function waitForStatus(
  engine: ProblemEngine,
  url: string,
  status: number,
  timeoutMs = 45_000,
): Promise<ProbeResult> {
  const deadline = Date.now() + timeoutMs;
  let result = await engine.probe(url);
  while (result.status !== status && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    result = await engine.probe(url);
  }
  return result;
}

describe("klab/api upstream response contract", () => {
  let engine: ProblemEngine | undefined;

  afterEach(async () => {
    await engine?.close();
    engine = undefined;
  });

  it(
    "propagates a reachable upstream's error status and reports it in the body",
    { timeout: 60_000 },
    async () => {
      const level = dnsResolutionFailure;

      engine = createProblemEngine(level.engine);
      expect((await engine.boot(level)).ok).toBe(true);
      const brokenOrders = level.files
        .find((file) => file.path === "orders-api.yaml")!
        .initialValue.replace("http://web-scv/", "http://web-svc/not-found");
      expect((await engine.applyFiles({ "orders-api.yaml": brokenOrders })).ok).toBe(true);

      const response = await waitForStatus(engine, "http://orders-svc/", 404);
      expect(response.status).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        upstream: "http://web-svc/not-found",
        status: 404,
      });
    },
  );
});
