import { describe, expect, it } from "vitest";

import type { GoalCheck } from "@/lib/domain/types";
import { evaluateGoal } from "@/lib/kube/goal-checks";

function deployment(spec: Record<string, unknown>): Record<string, unknown> {
  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: { name: "app" },
    spec: {
      replicas: 3,
      selector: { matchLabels: { app: "checkout" } },
      template: {
        metadata: { labels: { app: "checkout" } },
        spec: { containers: [{ name: "api", image: "example/app:1" }] },
      },
      ...spec,
    },
  };
}

describe("intent-level Kubernetes goals", () => {
  it("accepts equivalent PDB bounds only when quorum and drain progress both fit", () => {
    const goal: GoalCheck = {
      goal: "disruption-budget-window",
      replicas: 3,
      minimumAvailable: 2,
      minimumDisruptions: 1,
    };
    const pdb = (spec: Record<string, unknown>) => ({
      apiVersion: "policy/v1",
      kind: "PodDisruptionBudget",
      metadata: { name: "api" },
      spec,
    });

    expect(evaluateGoal(goal, pdb({ minAvailable: 2 })).passed).toBe(true);
    expect(evaluateGoal(goal, pdb({ maxUnavailable: 1 })).passed).toBe(true);
    expect(evaluateGoal(goal, pdb({ maxUnavailable: "33%" })).passed).toBe(true);
    expect(evaluateGoal(goal, pdb({ minAvailable: 3 })).passed).toBe(false);
    expect(evaluateGoal(goal, pdb({ maxUnavailable: 2 })).passed).toBe(false);
    expect(evaluateGoal(goal, pdb({ minAvailable: 2, maxUnavailable: 1 })).passed).toBe(false);
  });

  it("rejects spread and anti-affinity rules that select a different workload", () => {
    const goal: GoalCheck = {
      goal: "spreads-across-topology",
      topologyKey: "topology.kubernetes.io/zone",
      maxSkew: 1,
    };
    const wrongSpread = deployment({
      template: {
        metadata: { labels: { app: "checkout" } },
        spec: {
          topologySpreadConstraints: [
            {
              maxSkew: 1,
              topologyKey: "topology.kubernetes.io/zone",
              whenUnsatisfiable: "DoNotSchedule",
              labelSelector: { matchLabels: { app: "unrelated" } },
            },
          ],
          containers: [{ name: "api", image: "example/app:1" }],
        },
      },
    });
    const wrongAntiAffinity = deployment({
      template: {
        metadata: { labels: { app: "checkout" } },
        spec: {
          affinity: {
            podAntiAffinity: {
              requiredDuringSchedulingIgnoredDuringExecution: [
                {
                  topologyKey: "topology.kubernetes.io/zone",
                  labelSelector: { matchLabels: { app: "unrelated" } },
                },
              ],
            },
          },
          containers: [{ name: "api", image: "example/app:1" }],
        },
      },
    });

    expect(evaluateGoal(goal, wrongSpread).passed).toBe(false);
    expect(evaluateGoal(goal, wrongAntiAffinity).passed).toBe(false);
  });

  it("requires the serving container itself to own the graceful drain hook", () => {
    const resource = deployment({
      template: {
        metadata: { labels: { app: "checkout" } },
        spec: {
          terminationGracePeriodSeconds: 30,
          containers: [
            { name: "api", image: "example/app:1" },
            {
              name: "sidecar",
              image: "example/sidecar:1",
              lifecycle: { preStop: { exec: { command: ["sh", "-c", "sleep 5"] } } },
            },
          ],
        },
      },
    });

    expect(
      evaluateGoal({ goal: "graceful-drain", container: "api", minGraceSeconds: 15 }, resource)
        .passed,
    ).toBe(false);
  });

  it("accepts native lifecycle sleep but rejects a TCP-only preStop hook", () => {
    const goal: GoalCheck = { goal: "graceful-drain", container: "api", minGraceSeconds: 15 };
    const withHook = (preStop: Record<string, unknown>) =>
      deployment({
        template: {
          metadata: { labels: { app: "checkout" } },
          spec: {
            terminationGracePeriodSeconds: 30,
            containers: [{ name: "api", image: "example/app:1", lifecycle: { preStop } }],
          },
        },
      });

    expect(evaluateGoal(goal, withHook({ sleep: { seconds: 10 } })).passed).toBe(true);
    expect(evaluateGoal(goal, withHook({ sleep: { seconds: 30 } })).passed).toBe(false);
    expect(evaluateGoal(goal, withHook({ tcpSocket: { port: 8080 } })).passed).toBe(false);
  });

  it("accepts numeric and named Service targets but rejects an unrelated port", () => {
    const goal: GoalCheck = {
      goal: "service-targets-serving-port",
      servicePort: 80,
      servingPort: 8080,
      servingPortName: "http",
    };
    const service = (targetPort: number | string) => ({
      apiVersion: "v1",
      kind: "Service",
      metadata: { name: "web" },
      spec: { ports: [{ name: "http", port: 80, targetPort }] },
    });

    expect(evaluateGoal(goal, service(8080)).passed).toBe(true);
    expect(evaluateGoal(goal, service("http")).passed).toBe(true);
    expect(evaluateGoal(goal, service(9090)).passed).toBe(false);
  });

  it("uses Kubernetes rounding and defaults for rolling-update bounds", () => {
    const defaultRollout = deployment({ replicas: 2 });
    expect(evaluateGoal({ goal: "zero-downtime-rollout" }, defaultRollout).passed).toBe(true);

    const deadlockedRollout = deployment({
      replicas: 2,
      strategy: {
        type: "RollingUpdate",
        rollingUpdate: { maxSurge: 0, maxUnavailable: 0 },
      },
    });
    expect(evaluateGoal({ goal: "zero-downtime-rollout" }, deadlockedRollout).passed).toBe(false);

    const excessiveSurge = deployment({
      replicas: 4,
      strategy: {
        type: "RollingUpdate",
        rollingUpdate: { maxSurge: "50%", maxUnavailable: "0%" },
      },
    });
    expect(
      evaluateGoal({ goal: "zero-downtime-rollout", maxSurge: 1 }, excessiveSurge).passed,
    ).toBe(false);
    const boundedPercentageSurge = deployment({
      replicas: 4,
      strategy: {
        type: "RollingUpdate",
        rollingUpdate: { maxSurge: "25%", maxUnavailable: "0%" },
      },
    });
    expect(
      evaluateGoal({ goal: "zero-downtime-rollout", maxSurge: 1 }, boundedPercentageSurge).passed,
    ).toBe(true);

    const onePercentSurge = deployment({
      replicas: 3,
      strategy: {
        type: "RollingUpdate",
        rollingUpdate: { maxSurge: "1%", maxUnavailable: 1 },
      },
    });
    expect(
      evaluateGoal({ goal: "rollout-fits-capacity", schedulableReplicas: 3 }, onePercentSurge)
        .passed,
    ).toBe(false);
  });

  it("accepts Kubernetes Service DNS forms but rejects the wrong endpoint", () => {
    const goal: GoalCheck = {
      goal: "connects-to-service",
      container: "api",
      env: "UPSTREAM_URL",
      service: "web-svc",
      namespace: "default",
      port: 80,
      path: "/",
    };
    const withUrl = (value: string) =>
      deployment({
        template: {
          metadata: { labels: { app: "checkout" } },
          spec: {
            containers: [
              {
                name: "api",
                image: "example/app:1",
                env: [{ name: "UPSTREAM_URL", value }],
              },
            ],
          },
        },
      });

    expect(
      evaluateGoal(goal, withUrl("http://web-svc.default.svc.cluster.local.:80/")).passed,
    ).toBe(true);
    expect(evaluateGoal(goal, withUrl("http://web-scv/")).passed).toBe(false);
    expect(evaluateGoal(goal, withUrl("http://web-svc/not-found")).passed).toBe(false);
  });

  it("treats omitted externalTrafficPolicy as Kubernetes' Cluster default", () => {
    const service = (externalTrafficPolicy?: "Cluster" | "Local") => ({
      apiVersion: "v1",
      kind: "Service",
      metadata: { name: "payments-public" },
      spec: {
        type: "LoadBalancer",
        ...(externalTrafficPolicy ? { externalTrafficPolicy } : {}),
      },
    });
    const goal: GoalCheck = { goal: "external-traffic-routes-cluster-wide" };

    expect(evaluateGoal(goal, service()).passed).toBe(true);
    expect(evaluateGoal(goal, service("Cluster")).passed).toBe(true);
    expect(evaluateGoal(goal, service("Local")).passed).toBe(false);
  });

  it("accepts any startup probe that checks the serving port for the full warm-up", () => {
    const goal: GoalCheck = {
      goal: "startup-probe-covers-warmup",
      container: "api",
      servingPort: 8080,
      httpPath: "/healthz",
      minBudgetSeconds: 6,
    };
    const withProbe = (startupProbe: Record<string, unknown>) =>
      deployment({
        template: {
          metadata: { labels: { app: "checkout" } },
          spec: {
            containers: [
              {
                name: "api",
                image: "example/app:1",
                ports: [{ name: "http", containerPort: 8080 }],
                startupProbe,
              },
            ],
          },
        },
      });

    expect(
      evaluateGoal(
        goal,
        withProbe({ tcpSocket: { port: "http" }, periodSeconds: 2, failureThreshold: 3 }),
      ).passed,
    ).toBe(true);
    expect(
      evaluateGoal(
        goal,
        withProbe({
          httpGet: { path: "/healthz", port: 8080 },
          periodSeconds: 1,
          failureThreshold: 2,
        }),
      ).passed,
    ).toBe(false);
    expect(
      evaluateGoal(
        goal,
        withProbe({
          httpGet: { path: "/healthz", port: 9090 },
          periodSeconds: 2,
          failureThreshold: 3,
        }),
      ).passed,
    ).toBe(false);
  });
});
