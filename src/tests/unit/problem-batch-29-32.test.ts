import { afterEach, describe, expect, it } from "vitest";

import { getLevelBySlug } from "@/content/levels";
import { LEVEL_SOLUTIONS } from "@/content/levels/solutions";
import type { ProblemLevel } from "@/lib/domain/types";
import { renderFixtureSnapshot } from "@/lib/kube/cluster-fixture";
import { createProblemEngine, type ProblemEngine } from "@/lib/kube/problem-engine";

const reviewedSlugs = [
  "hostnetwork-lost-cluster-dns",
  "stateful-peers-cannot-discover",
  "orphaned-ingress",
  "local-traffic-black-hole",
] as const;

function initialFiles(level: ProblemLevel): Record<string, string> {
  return Object.fromEntries(level.files.map((file) => [file.path, file.initialValue]));
}

describe("Problems 29-32 end-to-end fidelity", () => {
  let engine: ProblemEngine | undefined;

  afterEach(async () => {
    await engine?.close();
    engine = undefined;
  });

  it.each(reviewedSlugs)(
    "moves %s from failing to passing with its canonical repair",
    async (slug) => {
      const level = getLevelBySlug(slug)!;
      const solution = LEVEL_SOLUTIONS[slug]!;
      engine = createProblemEngine(level.engine);
      expect((await engine.boot(level)).ok).toBe(true);

      expect((await engine.validate(level, initialFiles(level))).passed).toBe(false);
      expect((await engine.applyFiles(solution.files)).ok).toBe(true);
      expect(
        (await engine.validate(level, { ...initialFiles(level), ...solution.files })).passed,
      ).toBe(true);
    },
  );

  it.each(reviewedSlugs)(
    "executes every %s reference command against the fixture",
    async (slug) => {
      const level = getLevelBySlug(slug)!;
      engine = createProblemEngine(level.engine);
      expect((await engine.boot(level)).ok).toBe(true);

      for (const command of level.referenceCommands ?? []) {
        const result = await engine.runCommand(command, "default", initialFiles(level));
        expect(result.isError, `${command}: ${result.output}`).toBe(false);
      }
    },
  );

  it("keeps the host-network agent's policy-api destination healthy during the DNS incident", async () => {
    const level = getLevelBySlug("hostnetwork-lost-cluster-dns")!;
    engine = createProblemEngine(level.engine);
    expect((await engine.boot(level)).ok).toBe(true);

    const snapshot = engine.getSnapshot();
    expect(snapshot.services[0]?.metadata?.name).toBe("policy-api");
    expect(snapshot.pods.filter((pod) => pod.metadata?.labels?.app === "policy-api")).toHaveLength(
      1,
    );
    expect(snapshot.endpointSlices[0]?.endpoints).toHaveLength(1);
    expect(
      snapshot.resources?.some(
        (resource) => resource.kind === "DaemonSet" && resource.metadata?.name === "security-agent",
      ),
    ).toBe(true);
  });

  it("exposes the StatefulSet bootstrap deadlock and publishes all peers after repair", async () => {
    const level = getLevelBySlug("stateful-peers-cannot-discover")!;
    engine = createProblemEngine(level.engine);
    expect((await engine.boot(level)).ok).toBe(true);

    const broken = engine.getSnapshot();
    expect(broken.pods).toHaveLength(3);
    expect(broken.pods.every((pod) => pod.status?.conditions?.[0]?.status === "False")).toBe(true);
    expect(broken.endpointSlices[0]?.endpoints).toEqual([]);
    expect(
      broken.resources?.some(
        (resource) => resource.kind === "StatefulSet" && resource.metadata?.name === "database",
      ),
    ).toBe(true);

    expect((await engine.applyFiles(LEVEL_SOLUTIONS[level.slug]!.files)).ok).toBe(true);
    const healthy = engine.getSnapshot();
    expect(healthy.endpointSlices[0]?.endpoints).toHaveLength(3);
    expect(healthy.services[0]?.spec?.publishNotReadyAddresses).toBe(true);
    expect(
      healthy.resources?.some(
        (resource) => resource.kind === "StatefulSet" && resource.metadata?.name === "database",
      ),
    ).toBe(true);
  });

  it("keeps the IngressClass and backing Service observable while the Ingress is repaired", async () => {
    const level = getLevelBySlug("orphaned-ingress")!;
    engine = createProblemEngine(level.engine);
    expect((await engine.boot(level)).ok).toBe(true);

    const snapshot = engine.getSnapshot();
    expect(
      snapshot.resources?.some(
        (resource) => resource.kind === "IngressClass" && resource.metadata?.name === "nginx",
      ),
    ).toBe(true);
    expect(snapshot.services.some((service) => service.metadata?.name === "storefront")).toBe(true);
    expect(snapshot.pods.filter((pod) => pod.metadata?.labels?.app === "storefront")).toHaveLength(
      2,
    );
    expect(snapshot.endpointSlices[0]?.endpoints).toHaveLength(2);
  });

  it("models the six-node Local-policy black hole and accepts the omitted Cluster default", async () => {
    const level = getLevelBySlug("local-traffic-black-hole")!;
    const solution = LEVEL_SOLUTIONS[level.slug]!;
    engine = createProblemEngine(level.engine);
    expect((await engine.boot(level)).ok).toBe(true);

    const broken = engine.getSnapshot();
    expect(broken.nodes).toHaveLength(6);
    expect(new Set(broken.pods.map((pod) => pod.spec?.nodeName))).toEqual(
      new Set(["payments-1", "payments-2"]),
    );
    expect(broken.services[0]?.spec?.externalTrafficPolicy).toBe("Local");

    const omittedDefault = solution.files["payments-service.yaml"]!.replace(
      "  externalTrafficPolicy: Cluster\n",
      "",
    );
    const omittedFiles = {
      ...initialFiles(level),
      "payments-service.yaml": omittedDefault,
    };
    expect((await engine.applyFiles(omittedFiles)).ok).toBe(true);
    const report = await engine.validate(level, omittedFiles);
    expect(report.passed).toBe(true);
  });

  it("routes cross-namespace Services only to Pods in the Service namespace", () => {
    const snapshot = renderFixtureSnapshot({
      namespace: "default",
      pods: [
        {
          name: "wrong-namespace",
          labels: { app: "webhook" },
          podIP: "10.0.0.10",
          ready: true,
          containers: [{ name: "webhook", image: "example/webhook:1" }],
        },
        {
          name: "webhook-0",
          namespace: "policy-system",
          labels: { app: "webhook" },
          podIP: "10.0.1.10",
          ready: true,
          containers: [{ name: "webhook", image: "example/webhook:1" }],
        },
      ],
      services: [
        {
          name: "webhook",
          namespace: "policy-system",
          clusterIP: "10.96.0.20",
          selector: { app: "webhook" },
          ports: [{ name: "https", port: 443, targetPort: 8443 }],
        },
      ],
    });

    expect(
      snapshot.pods.find((pod) => pod.metadata?.name === "webhook-0")?.metadata?.namespace,
    ).toBe("policy-system");
    expect(snapshot.endpointSlices[0]?.endpoints).toHaveLength(1);
    expect(snapshot.endpointSlices[0]?.endpoints?.[0]?.targetRef?.name).toBe("webhook-0");
  });
});
