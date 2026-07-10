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

      expect((await engine.applyFiles(solution.files)).ok).toBe(true);
      const solvedFiles = { ...currentFiles, ...solution.files };
      const solvedReport = await engine.validate(level, solvedFiles);
      expect(solvedReport.passed, JSON.stringify(solvedReport, null, 2)).toBe(true);
      expect((await engine.probe("http://private-api-svc/")).status).toBe(200);
      expect(engine.getSnapshot().pods[0]?.status?.phase).toBe("Running");

      expect((await engine.reset(level)).ok).toBe(true);
      expect(JSON.stringify(engine.getSnapshot())).toBe(brokenSnapshot);
      expect((await engine.validate(level, currentFiles)).passed).toBe(false);
      expect(snapshots.length).toBeGreaterThanOrEqual(4);
    } finally {
      unsubscribe();
      await engine.close();
    }
  });
});
