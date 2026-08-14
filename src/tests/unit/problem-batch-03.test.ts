import { afterEach, describe, expect, it } from "vitest";

import { getLevelBySlug } from "@/content/levels";
import { LEVEL_SOLUTIONS } from "@/content/levels/solutions";
import { createProblemEngine, type ProblemEngine } from "@/lib/kube/problem-engine";

describe("problem review batch 03 regressions", () => {
  let engine: ProblemEngine | undefined;

  afterEach(async () => {
    await engine?.close();
    engine = undefined;
  });

  it("shows both ReplicaSets involved in the broken Recreate rollout", async () => {
    const level = getLevelBySlug("recreate-strategy-outage");
    expect(level).toBeDefined();
    if (!level) return;

    engine = createProblemEngine(level.engine);
    expect((await engine.boot(level)).ok).toBe(true);

    const snapshot = engine.getSnapshot();
    expect(snapshot.replicaSets.map((replicaSet) => replicaSet.metadata?.name)).toEqual([
      "checkout-5f2a1-oldrs",
      "checkout-7d9c1-newrs",
    ]);
    expect(snapshot.pods.every((pod) => pod.status?.podIP)).toBe(true);

    const result = await engine.runCommand("kubectl get rs", "default", {});
    expect(result.isError).toBe(false);
    expect(result.output).toContain("checkout-5f2a1-oldrs");
    expect(result.output).toContain("checkout-7d9c1-newrs");
  });

  it("rejects an immutable selector mutation while repairing the rollout", async () => {
    const level = getLevelBySlug("recreate-strategy-outage");
    const solution = LEVEL_SOLUTIONS["recreate-strategy-outage"];
    expect(level).toBeDefined();
    expect(solution).toBeDefined();
    if (!level || !solution) return;

    const mutated = solution.files["deployment.yaml"]!.replace(
      "      app: checkout\n  template:",
      "      app: checkout\n      tier: api\n  template:",
    );
    engine = createProblemEngine(level.engine);
    expect((await engine.boot(level)).ok).toBe(true);
    const result = await engine.applyFiles({ "deployment.yaml": mutated });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("field is immutable");
  });

  it("resets the immutable-selector incident to broken after a successful repair", async () => {
    const level = getLevelBySlug("immutable-deployment-selector");
    const solution = LEVEL_SOLUTIONS["immutable-deployment-selector"];
    expect(level).toBeDefined();
    expect(solution).toBeDefined();
    if (!level || !solution) return;

    engine = createProblemEngine(level.engine);
    expect((await engine.boot(level)).ok).toBe(true);
    expect((await engine.applyFiles(solution.files)).ok).toBe(true);
    expect((await engine.probe("http://search-svc/")).status).toBe(200);

    expect((await engine.reset(level)).ok).toBe(true);
    expect((await engine.probe("http://search-svc/")).status).toBe(503);
    expect(engine.getSnapshot().events).toEqual([]);
  });

  it("rejects every shape of immutable selector mutation", async () => {
    const level = getLevelBySlug("immutable-deployment-selector");
    const solution = LEVEL_SOLUTIONS["immutable-deployment-selector"];
    expect(level).toBeDefined();
    expect(solution).toBeDefined();
    if (!level || !solution) return;

    const mutated = solution.files["deployment.yaml"]!.replace(
      "      app: search\n  template:",
      "      app: search\n    matchExpressions:\n      - key: tier\n        operator: In\n        values: [api]\n  template:",
    );
    engine = createProblemEngine(level.engine);
    expect((await engine.boot(level)).ok).toBe(true);
    const result = await engine.applyFiles({ "deployment.yaml": mutated });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("field is immutable");
  });
});
