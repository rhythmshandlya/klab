import { describe, expect, it } from "vitest";

import { parseCommand, runCommandLine, tokenize } from "@/lib/kube/command-runner";
import type { ClusterSnapshot, KubeSimulator } from "@/lib/kube/simulator";

describe("tokenize", () => {
  it("splits on whitespace and respects quotes", () => {
    expect(tokenize(`kubectl logs pod -c "my container"`)).toEqual([
      "kubectl",
      "logs",
      "pod",
      "-c",
      "my container",
    ]);
  });
});

describe("parseCommand", () => {
  it("parses get with resource aliases", () => {
    expect(parseCommand("kubectl get po")).toMatchObject({ kind: "get", resource: "pods" });
    expect(parseCommand("kubectl get svc")).toMatchObject({ kind: "get", resource: "services" });
    expect(parseCommand("k get deploy")).toMatchObject({ kind: "get", resource: "deployments" });
  });

  it("parses -o yaml and a name", () => {
    expect(parseCommand("kubectl get pod web-app -o yaml")).toMatchObject({
      kind: "get",
      resource: "pods",
      name: "web-app",
      outputYaml: true,
    });
  });

  it("parses --sort-by for events", () => {
    expect(parseCommand("kubectl get events --sort-by=.lastTimestamp")).toMatchObject({
      kind: "get",
      resource: "events",
      sortByLastTimestamp: true,
    });
  });

  it("parses describe, logs, apply, delete", () => {
    expect(parseCommand("kubectl describe pod web-app")).toMatchObject({
      kind: "describe",
      resource: "pod",
      name: "web-app",
    });
    expect(parseCommand("kubectl logs web-app -c app")).toMatchObject({
      kind: "logs",
      pod: "web-app",
      container: "app",
    });
    expect(parseCommand("kubectl apply -f deployment.yaml")).toMatchObject({
      kind: "apply",
      file: "deployment.yaml",
    });
    expect(parseCommand("kubectl delete -f deployment.yaml")).toMatchObject({
      kind: "delete",
      file: "deployment.yaml",
    });
  });

  it("parses curl, dig, help, clear", () => {
    expect(parseCommand("curl http://web-svc/")).toMatchObject({
      kind: "curl",
      url: "http://web-svc/",
    });
    expect(parseCommand("dig web-svc")).toMatchObject({ kind: "dig", name: "web-svc" });
    expect(parseCommand("help")).toEqual({ kind: "help" });
    expect(parseCommand("clear")).toEqual({ kind: "clear" });
  });

  it("returns a helpful message for unknown commands, never throwing", () => {
    const result = parseCommand("kubectl frobnicate everything");
    expect(result.kind).toBe("unsupported");
    if (result.kind !== "unsupported") return;
    expect(result.message).toContain("get");
  });

  it("flags an unknown top-level command", () => {
    const result = parseCommand("sudo rm -rf /");
    expect(result).toMatchObject({ kind: "unsupported" });
  });
});

function dnsSimulator(): KubeSimulator {
  const snapshot: ClusterSnapshot = {
    pods: [],
    services: [
      {
        metadata: { name: "checkout-svc", namespace: "shop" },
        spec: { clusterIP: "10.96.0.42" },
      },
      {
        metadata: { name: "web-svc", namespace: "default" },
        spec: { clusterIP: "10.96.0.10" },
      },
    ],
    deployments: [],
    replicaSets: [],
    endpointSlices: [],
    namespaces: [],
    nodes: [],
    events: [],
  } as ClusterSnapshot;
  return { getSnapshot: () => snapshot } as unknown as KubeSimulator;
}

describe("Service DNS", () => {
  const run = (name: string, namespace = "default") =>
    runCommandLine(`dig ${name}`, {
      simulator: dnsSimulator(),
      namespace,
      files: {},
    });

  it("resolves an unqualified Service only in the caller's namespace", async () => {
    expect((await run("web-svc")).output).toContain("web-svc.default.svc.cluster.local");
    expect((await run("checkout-svc")).output).toContain("NXDOMAIN");
    expect((await run("checkout-svc", "shop")).output).toContain(
      "checkout-svc.shop.svc.cluster.local",
    );
  });

  it("resolves qualified names and rejects a wrong namespace or suffix", async () => {
    expect((await run("checkout-svc.shop")).output).toContain("10.96.0.42");
    expect((await run("checkout-svc.shop.svc.cluster.local.")).output).toContain("10.96.0.42");
    expect((await run("checkout-svc.default")).output).toContain("NXDOMAIN");
    expect((await run("checkout-svc.shop.example.local")).output).toContain("NXDOMAIN");
  });
});
