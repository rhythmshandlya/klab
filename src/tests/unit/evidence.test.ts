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
    trigger: { type: "probe", hostMatches: "^web-svc$", pathMatches: "/readyz", status: 404 },
  },
  {
    id: "r-unhealthy",
    evidenceId: "probe-unhealthy",
    label: "Readiness probe failed",
    source: "events",
    trigger: { type: "event-reason", reason: "Unhealthy" },
  },
  {
    id: "r-fatal-log",
    evidenceId: "fatal-log",
    label: "Worker reports its missing config",
    source: "logs",
    trigger: { type: "log", podMatches: "^worker-", messageMatches: "DATABASE_URL" },
  },
  {
    id: "r-service-view",
    evidenceId: "service-view",
    label: "Service inspected",
    source: "object-explorer",
    trigger: { type: "object-view", kind: "Service", nameMatches: "^web-svc$" },
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
    const probe = {
      type: "probe" as const,
      method: "GET" as const,
      url: "http://web-svc/readyz",
      host: "web-svc",
      port: 80,
      path: "/readyz",
      status: 404,
      body: "not found",
    };
    expect(matchEvidence(RULES, [probe])).toContain("readyz-404");
    expect(matchEvidence(RULES, [{ ...probe, host: "orders-svc" }])).not.toContain("readyz-404");
    expect(matchEvidence(RULES, [{ ...probe, status: 200 }])).not.toContain("readyz-404");
  });

  it("matches an event-reason signal case-insensitively", () => {
    expect(
      matchEvidence(RULES, [
        {
          type: "event-reason",
          reason: "unhealthy",
          message: "probe failed",
          namespace: "default",
        },
      ]),
    ).toContain("probe-unhealthy");
  });

  it("matches structured log and object-inspection signals", () => {
    expect(
      matchEvidence(RULES, [
        {
          type: "log",
          namespace: "default",
          pod: "worker-abc",
          message: "FATAL: DATABASE_URL is not set",
        },
      ]),
    ).toContain("fatal-log");
    expect(
      matchEvidence(RULES, [
        { type: "object-view", kind: "Service", name: "web-svc", namespace: "default" },
      ]),
    ).toContain("service-view");
  });
});

describe("collectEvidence", () => {
  it("reports only newly collected evidence", () => {
    const first = collectEvidence(
      RULES,
      [
        {
          type: "probe",
          method: "GET",
          url: "http://web-svc/readyz",
          host: "web-svc",
          port: 80,
          path: "/readyz",
          status: 404,
          body: "not found",
        },
      ],
      new Set(),
    );
    expect(first.newlyCollected).toEqual(["readyz-404"]);

    const second = collectEvidence(
      RULES,
      [
        {
          type: "probe",
          method: "GET",
          url: "http://web-svc/readyz",
          host: "web-svc",
          port: 80,
          path: "/readyz",
          status: 404,
          body: "not found",
        },
      ],
      first.collected,
    );
    expect(second.newlyCollected).toEqual([]);
    expect(second.collected.has("readyz-404")).toBe(true);
  });
});
