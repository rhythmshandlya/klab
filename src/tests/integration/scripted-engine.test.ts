import { describe, expect, it } from "vitest";

import { getLevelBySlug } from "@/content/levels";
import { LEVEL_SOLUTIONS } from "@/content/levels/solutions";
import { createProblemEngine } from "@/lib/kube/problem-engine";

describe("ScriptedIncidentEngine reference scenario", () => {
  it("is deterministic across boot, solve, probe, commands, and reset", async () => {
    const level = getLevelBySlug("private-registry-pull-secret")!;
    const solution = LEVEL_SOLUTIONS[level.slug]!;
    const engine = createProblemEngine(level.engine);
    const snapshots: string[] = [];
    const unsubscribe = engine.subscribe((snapshot) => snapshots.push(JSON.stringify(snapshot)));

    try {
      expect(engine.kind).toBe("scripted");
      expect((await engine.boot(level)).ok).toBe(true);
      const brokenSnapshot = JSON.stringify(engine.getSnapshot());
      expect(engine.getSnapshot().pods[0]?.status?.phase).toBe("Pending");
      expect(engine.getSnapshot().resources).toContainEqual(
        expect.objectContaining({
          kind: "Secret",
          metadata: expect.objectContaining({ name: "registry-credentials" }),
          type: "kubernetes.io/dockerconfigjson",
        }),
      );

      const currentFiles = Object.fromEntries(
        level.files
          .filter((file) => file.access !== "hidden")
          .map((file) => [file.path, file.initialValue]),
      );
      expect((await engine.validate(level, currentFiles)).passed).toBe(false);
      expect((await engine.probe("http://private-api-svc/")).status).toBe(503);

      const pods = await engine.runCommand("kubectl get pods", "default", currentFiles);
      expect(pods.isError).toBe(false);
      expect(pods.output).toMatch(/Pending|ImagePullBackOff/);
      const events = await engine.runCommand("kubectl get events", "default", currentFiles);
      expect(events.signals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "event-reason", reason: "Failed" }),
        ]),
      );
      expect(events.output).toMatch(/pull access denied.*authorization failed/i);
      expect(events.output).not.toContain("secret registry-credentials not found");
      const secret = await engine.runCommand(
        "kubectl get secret registry-credentials -o yaml",
        "default",
        currentFiles,
      );
      expect(secret.isError).toBe(false);
      expect(secret.output).toContain("kubernetes.io/dockerconfigjson");
      const deployment = await engine.runCommand(
        "kubectl get deployment private-api -o yaml",
        "default",
        currentFiles,
      );
      expect(deployment.isError).toBe(false);
      expect(deployment.output).not.toContain("imagePullSecrets");

      const scaledToZero = solution.files["deployment.yaml"]!.replace("replicas: 1", "replicas: 0");
      expect((await engine.applyFiles({ "deployment.yaml": scaledToZero })).ok).toBe(true);
      const unsafeReport = await engine.validate(level, {
        ...currentFiles,
        "deployment.yaml": scaledToZero,
      });
      expect(unsafeReport.passed).toBe(false);
      expect((await engine.probe("http://private-api-svc/")).status).toBe(503);
      expect(engine.getSnapshot().pods[0]?.status?.phase).toBe("Pending");

      expect((await engine.applyFiles(solution.files)).ok).toBe(true);
      const solvedFiles = { ...currentFiles, ...solution.files };
      const solvedReport = await engine.validate(level, solvedFiles);
      expect(solvedReport.passed, JSON.stringify(solvedReport, null, 2)).toBe(true);
      expect((await engine.probe("http://private-api-svc/")).status).toBe(200);
      expect(engine.getSnapshot().pods[0]?.status?.phase).toBe("Running");
      expect(engine.getSnapshot().pods[0]?.spec?.imagePullSecrets).toEqual([
        { name: "registry-credentials" },
      ]);

      expect((await engine.reset(level)).ok).toBe(true);
      expect(JSON.stringify(engine.getSnapshot())).toBe(brokenSnapshot);
      expect((await engine.validate(level, currentFiles)).passed).toBe(false);
      expect(snapshots.length).toBeGreaterThanOrEqual(4);
    } finally {
      unsubscribe();
      await engine.close();
    }
  });

  it("samples intermittent shutdown failures and converges after adding a drain window", async () => {
    const level = getLevelBySlug("graceful-shutdown-502s")!;
    const solution = LEVEL_SOLUTIONS[level.slug]!;
    const engine = createProblemEngine(level.engine);

    try {
      expect((await engine.boot(level)).ok).toBe(true);
      const currentFiles = Object.fromEntries(
        level.files
          .filter((file) => file.access !== "hidden")
          .map((file) => [file.path, file.initialValue]),
      );
      const samples = await Promise.all([
        engine.probe("http://edge-api-svc/"),
        engine.probe("http://edge-api-svc/"),
        engine.probe("http://edge-api-svc/"),
      ]);
      expect(samples.map((sample) => sample.status)).toEqual([200, 200, 502]);
      expect(samples[2]?.body).toContain("edge-api-old");

      const oldLogs = await engine.runCommand("kubectl logs edge-api-old", "default", currentFiles);
      expect(oldLogs.output).toContain("closing listener immediately");
      expect((await engine.validate(level, currentFiles)).passed).toBe(false);

      expect((await engine.applyFiles(solution.files)).ok).toBe(true);
      const report = await engine.validate(level, { ...currentFiles, ...solution.files });
      expect(report.passed, JSON.stringify(report, null, 2)).toBe(true);
      const fixedSamples = await Promise.all([
        engine.probe("http://edge-api-svc/"),
        engine.probe("http://edge-api-svc/"),
        engine.probe("http://edge-api-svc/"),
      ]);
      expect(fixedSamples.map((sample) => sample.status)).toEqual([200, 200, 200]);
    } finally {
      await engine.close();
    }
  });
});
