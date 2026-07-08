import { describe, expect, it } from "vitest";

import type { EvidenceRule } from "@/lib/domain/types";
import { collectEvidence, matchEvidence, type InvestigationSignal } from "@/lib/kube/evidence";

const RULES: EvidenceRule[] = [
  {
    id: "r-running",
    evidenceId: "pod-running",
    label: "Pod is Running",
    source: "terminal",
    trigger: { type: "command", commandMatches: "get pods", outputMatches: "Running" },
  },
  {
    id: "r-readyz-404",
    evidenceId: "readyz-404",
    label: "GET /readyz returns 404",
    source: "network",
    trigger: { type: "probe", pathMatches: "/readyz", status: 404 },
  },
  {
    id: "r-unhealthy",
    evidenceId: "probe-unhealthy",
    label: "Readiness probe failed",
    source: "events",
    trigger: { type: "event-reason", reason: "Unhealthy" },
  },
];

describe("matchEvidence", () => {
  it("matches a command signal only when both command and output match", () => {
    const good: InvestigationSignal = {
      type: "command",
      command: "kubectl get pods",
      output: "web-app  0/1  Running  0  8m",
    };
    expect(matchEvidence(RULES, [good])).toContain("pod-running");

    const wrongOutput: InvestigationSignal = {
      type: "command",
      command: "kubectl get pods",
      output: "No resources found.",
    };
    expect(matchEvidence(RULES, [wrongOutput])).not.toContain("pod-running");
  });

  it("matches a probe signal on path + status", () => {
    expect(matchEvidence(RULES, [{ type: "probe", path: "/readyz", status: 404 }])).toContain(
      "readyz-404",
    );
    expect(matchEvidence(RULES, [{ type: "probe", path: "/readyz", status: 200 }])).not.toContain(
      "readyz-404",
    );
  });

  it("matches an event-reason signal case-insensitively", () => {
    expect(matchEvidence(RULES, [{ type: "event-reason", reason: "unhealthy" }])).toContain(
      "probe-unhealthy",
    );
  });
});

describe("collectEvidence", () => {
  it("reports only newly collected evidence", () => {
    const first = collectEvidence(
      RULES,
      [{ type: "probe", path: "/readyz", status: 404 }],
      new Set(),
    );
    expect(first.newlyCollected).toEqual(["readyz-404"]);

    const second = collectEvidence(
      RULES,
      [{ type: "probe", path: "/readyz", status: 404 }],
      first.collected,
    );
    expect(second.newlyCollected).toEqual([]);
    expect(second.collected.has("readyz-404")).toBe(true);
  });
});
