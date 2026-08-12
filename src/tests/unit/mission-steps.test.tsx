import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const useSimulatorMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/topology/service-topology", () => ({
  ServiceTopology: () => null,
}));
vi.mock("@/components/terminal/xterm-terminal", () => ({
  XtermTerminal: () => null,
}));
vi.mock("@/components/editor/yaml-editor", () => ({
  YamlEditor: ({ minimap }: { minimap?: boolean }) => (
    <div data-testid="mission-editor" data-minimap={String(minimap)} />
  ),
}));
vi.mock("@/features/problems/hooks/use-simulator", () => ({
  useSimulator: useSimulatorMock,
}));

import { MissionWorkspaceCard } from "@/features/docs/components/mission-workspace-card";
import { DoStep } from "@/features/docs/mission/steps/do-step";
import type { MissionRun } from "@/content/curriculum/model";
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
    expect(screen.getByTestId("mission-editor")).toHaveAttribute("data-minimap", "false");
    expect(screen.getByRole("tab", { name: "pod.yaml" })).toHaveAttribute("aria-selected", "true");

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

  it("offers compact Editor, Terminal, and Cluster views", () => {
    const sim = makeFakeSim(EMPTY_SNAPSHOT);
    render(<DoStep step={doStep} sim={sim} compact onComplete={vi.fn()} />);

    expect(screen.getByRole("tab", { name: "Cluster" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Terminal" }));
    expect(screen.getByRole("tab", { name: "Terminal" })).toHaveAttribute("aria-selected", "true");
    expect(document.querySelector("[data-mission-workspace]")).toHaveAttribute(
      "data-compact",
      "true",
    );
  });

  it("minimizes into a reading companion without remounting the mission", () => {
    const sim = makeFakeSim(EMPTY_SNAPSHOT);
    useSimulatorMock.mockReturnValue(sim);
    const run: MissionRun = {
      initialManifests: [],
      mission: {
        slug: ["test", "mission"],
        section: "Test",
        order: 1,
        title: "Test mission",
        coldOpen: {
          goal: "Keep learning while the cluster runs.",
          clusterNote: "A local cluster is ready.",
        },
        steps: [
          doStep,
          {
            kind: "debrief",
            id: "wrap",
            summary: "Complete.",
            takeaways: ["State persists."],
          },
        ],
        inheritsCluster: false,
        concepts: [],
      },
    };

    render(<MissionWorkspaceCard run={run} />);
    fireEvent.click(screen.getByRole("button", { name: "Start mission" }));

    expect(screen.getByRole("dialog", { name: "Mission: Test mission" })).toBeInTheDocument();
    const editorBeforeMinimize = screen.getByTestId("mission-editor");

    fireEvent.click(screen.getByRole("button", { name: "Minimize mission" }));

    expect(
      screen.getByRole("complementary", { name: "Mission companion: Test mission" }),
    ).toBeInTheDocument();
    expect(document.querySelector("[data-mission-overlay]")).toBeNull();
    expect(screen.getByTestId("mission-editor")).toBe(editorBeforeMinimize);

    fireEvent.click(screen.getByRole("button", { name: "Expand mission" }));
    expect(screen.getByRole("dialog", { name: "Mission: Test mission" })).toBeInTheDocument();
    expect(screen.getByTestId("mission-editor")).toBe(editorBeforeMinimize);
  });
});
