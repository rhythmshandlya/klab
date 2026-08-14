import { describe, expect, it, vi } from "vitest";

import {
  matchesLabelSelector,
  parseCommand,
  runCommandLine,
  tokenize,
  type CommandRuntime,
} from "@/lib/kube/command-runner";
import type { ClusterSnapshot, KubeSimulator } from "@/lib/kube/simulator";
import { ok } from "@/lib/utils/result";

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

  it("keeps unstructured resource kinds for fixture-backed incidents", () => {
    expect(parseCommand("kubectl get storageclass regional-ssd")).toMatchObject({
      kind: "get",
      resource: "storageclass",
      name: "regional-ssd",
    });
    expect(parseCommand("kubectl describe validatingwebhookconfiguration policy")).toMatchObject({
      kind: "describe",
      resource: "validatingwebhookconfiguration",
      name: "policy",
    });
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

  it("parses scale with kind/name and kind name forms", () => {
    expect(parseCommand("kubectl scale deployment web --replicas=3")).toEqual({
      kind: "scale",
      name: "web",
      replicas: 3,
      namespace: undefined,
    });
    expect(parseCommand("kubectl scale deploy/web --replicas 0 -n shop")).toMatchObject({
      kind: "scale",
      name: "web",
      replicas: 0,
      namespace: "shop",
    });
    expect(parseCommand("kubectl scale deployment web")).toMatchObject({ kind: "unsupported" });
    expect(parseCommand("kubectl scale pod web --replicas=2")).toMatchObject({
      kind: "unsupported",
    });
  });

  it("parses rollout status/restart/history", () => {
    expect(parseCommand("kubectl rollout status deployment/web")).toEqual({
      kind: "rollout",
      verb: "status",
      name: "web",
      namespace: undefined,
    });
    expect(parseCommand("kubectl rollout restart deployment web")).toMatchObject({
      kind: "rollout",
      verb: "restart",
      name: "web",
    });
    expect(parseCommand("kubectl rollout undo deployment/web")).toMatchObject({
      kind: "unsupported",
    });
  });

  it("parses exec with -- separator and flags", () => {
    expect(parseCommand("kubectl exec web -- env")).toEqual({
      kind: "exec",
      pod: "web",
      container: undefined,
      argv: ["env"],
      namespace: undefined,
    });
    expect(parseCommand("kubectl exec -it web -c app -- sh -c 'echo hi'")).toMatchObject({
      kind: "exec",
      pod: "web",
      container: "app",
      argv: ["sh", "-c", "echo hi"],
    });
    expect(parseCommand("kubectl exec web env")).toMatchObject({ kind: "unsupported" });
  });

  it("parses delete by kind + name alongside delete -f", () => {
    expect(parseCommand("kubectl delete pod web-1")).toEqual({
      kind: "delete-resource",
      manifestKind: "Pod",
      name: "web-1",
      namespace: undefined,
    });
    expect(parseCommand("kubectl delete deploy/web -n shop")).toMatchObject({
      kind: "delete-resource",
      manifestKind: "Deployment",
      name: "web",
      namespace: "shop",
    });
    expect(parseCommand("kubectl delete -f pod.yaml")).toMatchObject({
      kind: "delete",
      file: "pod.yaml",
    });
    expect(parseCommand("kubectl delete events boom")).toMatchObject({ kind: "unsupported" });
  });

  it("parses create namespace and rejects other creates", () => {
    expect(parseCommand("kubectl create namespace team-a")).toEqual({
      kind: "create-namespace",
      name: "team-a",
    });
    expect(parseCommand("kubectl create deployment web")).toMatchObject({ kind: "unsupported" });
  });

  it("parses get nodes and the -A/-l/-o wide flags", () => {
    expect(parseCommand("kubectl get nodes")).toMatchObject({ kind: "get", resource: "nodes" });
    expect(parseCommand("kubectl get pods -A")).toMatchObject({
      kind: "get",
      allNamespaces: true,
    });
    expect(parseCommand("kubectl get pods -l app=web")).toMatchObject({
      kind: "get",
      selector: "app=web",
    });
    expect(parseCommand("kubectl get pods -o wide")).toMatchObject({
      kind: "get",
      outputWide: true,
    });
  });

  it("parses describe for rs, ns, and node", () => {
    expect(parseCommand("kubectl describe rs web-abc")).toMatchObject({
      kind: "describe",
      resource: "replicaset",
      name: "web-abc",
    });
    expect(parseCommand("kubectl describe ns team-a")).toMatchObject({
      kind: "describe",
      resource: "namespace",
    });
    expect(parseCommand("kubectl describe node node-1")).toMatchObject({
      kind: "describe",
      resource: "node",
    });
  });
});

describe("matchesLabelSelector", () => {
  it("supports equality, inequality, existence, and comma conjunction", () => {
    const labels = { app: "web", tier: "frontend" };
    expect(matchesLabelSelector(labels, "app=web")).toBe(true);
    expect(matchesLabelSelector(labels, "app==web,tier=frontend")).toBe(true);
    expect(matchesLabelSelector(labels, "app!=api")).toBe(true);
    expect(matchesLabelSelector(labels, "tier")).toBe(true);
    expect(matchesLabelSelector(labels, "app=api")).toBe(false);
    expect(matchesLabelSelector(labels, "missing")).toBe(false);
    expect(matchesLabelSelector(undefined, "app=web")).toBe(false);
  });
});

describe("new executors against a fake runtime", () => {
  function makeRuntime(snapshot: Partial<ClusterSnapshot>): CommandRuntime {
    const full: ClusterSnapshot = {
      pods: [],
      services: [],
      deployments: [],
      replicaSets: [],
      endpointSlices: [],
      namespaces: [],
      nodes: [],
      events: [],
      ...snapshot,
    } as ClusterSnapshot;
    return {
      getSnapshot: () => full,
      probe: vi.fn(),
      getLogs: vi.fn(() => []),
      applyYaml: vi.fn(async () => ok([{ kind: "Namespace", name: "team-a", namespace: "" }])),
      deleteYaml: vi.fn(async () => ok([])),
      exec: vi.fn(async () => ok({ exitCode: 0, stdout: "PATH=/bin\n", stderr: "" })),
      scaleDeployment: vi.fn(async () => ok(undefined)),
      restartDeployment: vi.fn(async () => ok(undefined)),
      deleteResource: vi.fn(async () => ok(undefined)),
    } satisfies CommandRuntime;
  }

  const webDeployment = {
    metadata: { name: "web", namespace: "default" },
    spec: { replicas: 2 },
    status: { replicas: 2, updatedReplicas: 2, availableReplicas: 2 },
  } as ClusterSnapshot["deployments"][number];

  it("kubectl scale calls the runtime and reports kubectl-style output", async () => {
    const runtime = makeRuntime({ deployments: [webDeployment] });
    const result = await runCommandLine("kubectl scale deployment web --replicas=5", {
      simulator: runtime,
      namespace: "default",
      files: {},
    });
    expect(runtime.scaleDeployment).toHaveBeenCalledWith("web", "default", 5);
    expect(result.output).toBe("deployment.apps/web scaled");
    expect(result.isError).toBe(false);
  });

  it("kubectl rollout status reads live deployment status", async () => {
    const runtime = makeRuntime({ deployments: [webDeployment] });
    const done = await runCommandLine("kubectl rollout status deployment/web", {
      simulator: runtime,
      namespace: "default",
      files: {},
    });
    expect(done.output).toContain("successfully rolled out");

    const rollingRuntime = makeRuntime({
      deployments: [
        {
          ...webDeployment,
          status: { replicas: 2, updatedReplicas: 1, availableReplicas: 1 },
        } as ClusterSnapshot["deployments"][number],
      ],
    });
    const waiting = await runCommandLine("kubectl rollout status deployment/web", {
      simulator: rollingRuntime,
      namespace: "default",
      files: {},
    });
    expect(waiting.output).toContain("Waiting for deployment");
  });

  it("kubectl exec requires a live pod and prints stdout", async () => {
    const runtime = makeRuntime({
      pods: [{ metadata: { name: "web-1", namespace: "default" } }] as ClusterSnapshot["pods"],
    });
    const result = await runCommandLine("kubectl exec web-1 -- env", {
      simulator: runtime,
      namespace: "default",
      files: {},
    });
    expect(runtime.exec).toHaveBeenCalledWith("default", "web-1", undefined, ["env"]);
    expect(result.output).toContain("PATH=/bin");

    const missing = await runCommandLine("kubectl exec ghost -- env", {
      simulator: runtime,
      namespace: "default",
      files: {},
    });
    expect(missing.isError).toBe(true);
    expect(missing.output).toContain("not found");
  });

  it("kubectl delete pod calls deleteResource with the manifest kind", async () => {
    const runtime = makeRuntime({});
    const result = await runCommandLine("kubectl delete pod web-1", {
      simulator: runtime,
      namespace: "default",
      files: {},
    });
    expect(runtime.deleteResource).toHaveBeenCalledWith("Pod", "web-1", "default");
    expect(result.output).toBe('pod "web-1" deleted');
  });

  it("degrades gracefully when the runtime lacks a capability", async () => {
    const runtime = makeRuntime({ deployments: [webDeployment] });
    delete (runtime as { scaleDeployment?: unknown }).scaleDeployment;
    const result = await runCommandLine("kubectl scale deployment web --replicas=1", {
      simulator: runtime,
      namespace: "default",
      files: {},
    });
    expect(result.isError).toBe(true);
    expect(result.output).toContain("not available");
  });

  it("kubectl get pods -l filters by label and -A spans namespaces", async () => {
    const pods = [
      { metadata: { name: "web-1", namespace: "default", labels: { app: "web" } } },
      { metadata: { name: "api-1", namespace: "shop", labels: { app: "api" } } },
    ] as ClusterSnapshot["pods"];
    const runtime = makeRuntime({ pods });
    const labeled = await runCommandLine("kubectl get pods -l app=web -A", {
      simulator: runtime,
      namespace: "default",
      files: {},
    });
    expect(labeled.output).toContain("web-1");
    expect(labeled.output).not.toContain("api-1");
    expect(labeled.output).toContain("NAMESPACE");

    const scoped = await runCommandLine("kubectl get pods", {
      simulator: runtime,
      namespace: "shop",
      files: {},
    });
    expect(scoped.output).toContain("api-1");
    expect(scoped.output).not.toContain("web-1");
  });

  it("kubectl get nodes renders node rows", async () => {
    const runtime = makeRuntime({
      nodes: [
        {
          metadata: { name: "node-1", labels: { "node-role.kubernetes.io/control-plane": "" } },
          status: {
            conditions: [{ type: "Ready", status: "True" }],
            nodeInfo: { kubeletVersion: "v1.36.0" },
          },
        },
      ] as unknown as ClusterSnapshot["nodes"],
    });
    const result = await runCommandLine("kubectl get nodes", {
      simulator: runtime,
      namespace: "default",
      files: {},
    });
    expect(result.output).toContain("node-1");
    expect(result.output).toContain("Ready");
    expect(result.output).toContain("control-plane");
    expect(result.output).toContain("v1.36.0");
  });

  it("gets and describes unstructured fixture resources", async () => {
    const runtime = makeRuntime({
      resources: [
        {
          apiVersion: "storage.k8s.io/v1",
          kind: "StorageClass",
          metadata: { name: "regional-ssd", labels: { tier: "production" } },
          provisioner: "pd.csi.storage.gke.io",
          volumeBindingMode: "WaitForFirstConsumer",
        },
      ],
    });

    const listed = await runCommandLine("kubectl get storageclass regional-ssd -o yaml", {
      simulator: runtime,
      namespace: "default",
      files: {},
    });
    expect(listed.isError).toBe(false);
    expect(listed.output).toContain("kind: StorageClass");

    const described = await runCommandLine("kubectl describe sc regional-ssd", {
      simulator: runtime,
      namespace: "default",
      files: {},
    });
    expect(described.isError).toBe(false);
    expect(described.output).toContain("Kind:               StorageClass");
    expect(described.output).toContain("WaitForFirstConsumer");
  });

  it("kubectl create namespace applies a namespace manifest", async () => {
    const runtime = makeRuntime({});
    const result = await runCommandLine("kubectl create namespace team-a", {
      simulator: runtime,
      namespace: "default",
      files: {},
    });
    expect(runtime.applyYaml).toHaveBeenCalledWith(expect.stringContaining("kind: Namespace"));
    expect(result.output).toBe("namespace/team-a created");
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
    const missing = await run("checkout-svc");
    expect(missing.output).toContain("status: NXDOMAIN");
    expect(missing.output).not.toContain("timed out");
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
