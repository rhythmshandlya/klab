import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/components/topology/service-topology", () => ({
  ServiceTopology: () => null,
}));
vi.mock("@/components/terminal/xterm-terminal", () => ({
  XtermTerminal: () => null,
}));
vi.mock("@/components/editor/yaml-editor", () => ({
  YamlEditor: () => null,
}));

import { DoStep } from "@/features/docs/mission/steps/do-step";
import type { ClusterSnapshot } from "@/lib/kube/simulator";
import type { UseSimulator } from "@/features/problems/hooks/use-simulator";

const EMPTY_SNAPSHOT: ClusterSnapshot = {
  pods: [],
  services: [],
  deployments: [],
  replicaSets: [],
  endpointSlices: [],
  namespaces: [],
  nodes: [],
  events: [],
};

describe("DoStep", () => {
  const doStep = {
    kind: "do" as const,
    id: "d",
    goal: "Get the web pod ready.",
    files: [{ path: "pod.yaml", initialValue: "apiVersion: v1", language: "yaml" as const }],
    check: { kind: "pods-ready" as const, selector: { app: "web" }, minReady: 1 },
    debrief: "done!",
  };

  function makeFakeSim(snapshot: ClusterSnapshot): UseSimulator {
    return {
      status: "ready",
      ready: true,
      error: null,
      snapshot,
      simulator: {} as never,
      applyFiles: vi.fn(async () => ({ ok: true, value: [] })),
      reset: vi.fn(),
      probe: vi.fn(),
      validate: vi.fn(),
    } as unknown as UseSimulator;
  }

  it("does not complete before Apply, and stays incomplete if the check still fails after Apply", async () => {
    const onComplete = vi.fn();
    const sim = makeFakeSim(EMPTY_SNAPSHOT);
    render(<DoStep step={doStep} sim={sim} onComplete={onComplete} />);

    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Apply changes"));
    await waitFor(() => expect(sim.applyFiles).toHaveBeenCalled());

    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.queryByText("done!")).not.toBeInTheDocument();
  });

  it("completes exactly once when a ready snapshot arrives after Apply", async () => {
    const onComplete = vi.fn();
    const sim = makeFakeSim(EMPTY_SNAPSHOT);
    const { rerender } = render(<DoStep step={doStep} sim={sim} onComplete={onComplete} />);

    fireEvent.click(screen.getByText("Apply changes"));
    await waitFor(() => expect(sim.applyFiles).toHaveBeenCalled());

    const readySnapshot: ClusterSnapshot = {
      ...EMPTY_SNAPSHOT,
      pods: [
        {
          metadata: { name: "web-1", namespace: "default", labels: { app: "web" } },
          status: {
            phase: "Running",
            conditions: [{ type: "Ready", status: "True" }],
            containerStatuses: [
              { ready: true, restartCount: 0, name: "web", image: "web:latest", imageID: "" },
            ],
          },
        },
      ] as ClusterSnapshot["pods"],
    };
    const readySim = { ...sim, snapshot: readySnapshot };
    rerender(<DoStep step={doStep} sim={readySim} onComplete={onComplete} />);

    await waitFor(() => expect(screen.getByText("done!")).toBeInTheDocument());
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
