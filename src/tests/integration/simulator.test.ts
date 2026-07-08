import { afterEach, describe, expect, it } from "vitest";

import { runCommandLine } from "@/lib/kube/command-runner";
import { KubeSimulator } from "@/lib/kube/simulator";
import { runValidators } from "@/lib/kube/validators";
import type { LevelValidatorDefinition } from "@/lib/domain/types";

const HEALTHY = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
        - name: web-app
          image: klab/web-app:1.0.0
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 0
            periodSeconds: 1
---
apiVersion: v1
kind: Service
metadata:
  name: web-svc
  namespace: default
spec:
  selector:
    app: web-app
  ports:
    - port: 80
      targetPort: 8080
`;

async function waitFor(predicate: () => boolean, timeoutMs = 15000, stepMs = 50): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
  return predicate();
}

describe("KubeSimulator (real Webernetes boot)", () => {
  let sim: KubeSimulator | undefined;

  afterEach(async () => {
    await sim?.close();
    sim = undefined;
  });

  it("boots, applies a Deployment + Service, and reconciles ready state", async () => {
    sim = new KubeSimulator();
    const booted = await sim.boot();
    expect(booted.ok, booted.ok ? "" : (booted as { error: string }).error).toBe(true);

    const applied = await sim.applyYaml(HEALTHY);
    expect(applied.ok).toBe(true);

    // Scheduler + kubelet create the pod.
    const hasPod = await waitFor(() => sim!.getSnapshot().pods.length > 0, 25000);
    expect(hasPod).toBe(true);

    // The readiness probe hits /healthz (200) → pod becomes ready → deployment ready.
    const ready = await waitFor(() => {
      const d = sim!.getSnapshot().deployments[0];
      return (d?.status?.readyReplicas ?? 0) >= 1;
    });
    expect(ready).toBe(true);

    // The endpointslice controller should publish a ready endpoint for the service.
    const hasEndpoints = await waitFor(() => {
      const slices = sim!.getSnapshot().endpointSlices;
      return slices.some((s) =>
        (s.endpoints ?? []).some(
          (e) => e.conditions?.ready !== false && (e.addresses?.length ?? 0) > 0,
        ),
      );
    });
    expect(hasEndpoints).toBe(true);

    // Behavior-based validators should now pass.
    const validators: LevelValidatorDefinition[] = [
      {
        id: "d",
        title: "deploy",
        successLabel: "ok",
        failureLabel: "no",
        kind: "deployment-ready",
        namespace: "default",
        name: "web-app",
        minReadyReplicas: 1,
      },
      {
        id: "e",
        title: "endpoints",
        successLabel: "ok",
        failureLabel: "no",
        kind: "service-has-ready-endpoints",
        namespace: "default",
        name: "web-svc",
        minReadyEndpoints: 1,
      },
    ];
    const report = await runValidators(validators, { simulator: sim });
    expect(report.passed).toBe(true);

    // kubectl-style commands read the same live cluster.
    const ctx = { simulator: sim, namespace: "default", files: {} };
    const getPods = await runCommandLine("kubectl get pods", ctx);
    expect(getPods.output).toContain("web-app");
    expect(getPods.output).toContain("NAME");

    const getSvc = await runCommandLine("kubectl get svc", ctx);
    expect(getSvc.output).toContain("web-svc");

    const unknown = await runCommandLine("frobnicate", ctx);
    expect(unknown.isError).toBe(true);
    expect(unknown.output).toContain("command not found");
  });
});
