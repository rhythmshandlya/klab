import type { V1Pod } from "@ngrok/webernetes";
import { describe, expect, it } from "vitest";

import type { QuickCommand } from "@/lib/domain/types";
import { resolveQuickCommand } from "@/lib/kube/quick-command";

function pod(
  name: string,
  labels: Record<string, string>,
  ready: boolean,
  restarts = 0,
  namespace = "default",
): V1Pod {
  return {
    metadata: { name, namespace, labels },
    status: {
      conditions: [{ type: "Ready", status: ready ? "True" : "False" }],
      containerStatuses: [{ name: "app", ready, restartCount: restarts, image: "test" }],
    },
  } as V1Pod;
}

function command(prefer: "not-ready" | "highest-restarts" | "first"): QuickCommand {
  return {
    id: prefer,
    command: "kubectl logs <pod>",
    target: {
      kind: "pod",
      namespace: "default",
      selector: { app: "worker" },
      prefer,
    },
  };
}

describe("resolveQuickCommand", () => {
  const pods = [
    pod("unrelated-broken", { app: "other" }, false, 99),
    pod("worker-ready", { app: "worker" }, true, 1),
    pod("worker-broken", { app: "worker" }, false, 7),
    pod("worker-shop", { app: "worker" }, false, 20, "shop"),
  ];

  it("uses the authored selector and namespace before applying preference", () => {
    expect(resolveQuickCommand(command("not-ready"), pods)).toBe("kubectl logs worker-broken");
    expect(resolveQuickCommand(command("highest-restarts"), pods)).toBe(
      "kubectl logs worker-broken",
    );
    expect(resolveQuickCommand(command("first"), pods)).toBe("kubectl logs worker-ready");
  });

  it("returns null when the target does not exist", () => {
    const missing = command("first");
    missing.target = { ...missing.target!, selector: { app: "missing" } };
    expect(resolveQuickCommand(missing, pods)).toBeNull();
  });

  it("leaves commands without placeholders untouched", () => {
    expect(resolveQuickCommand({ id: "pods", command: "kubectl get pods" }, pods)).toBe(
      "kubectl get pods",
    );
  });
});
