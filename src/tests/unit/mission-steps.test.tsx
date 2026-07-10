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

import { CheckStep } from "@/features/docs/mission/steps/check-step";
import { PredictStep } from "@/features/docs/mission/steps/predict-step";
import { DebriefStep } from "@/features/docs/mission/steps/debrief-step";
import { TeachStep } from "@/features/docs/mission/steps/teach-step";
import { DoStep } from "@/features/docs/mission/steps/do-step";
import type { ClusterSnapshot } from "@/lib/kube/simulator";
import type { UseSimulator } from "@/features/problems/hooks/use-simulator";

const quiz = {
  question: "Q?",
  options: [
    { id: "a", text: "wrong", correct: false, explain: "no" },
    { id: "b", text: "right", correct: true, explain: "yes" },
  ],
};

describe("CheckStep gating", () => {
  it("does not call onComplete on a wrong answer", () => {
    const onComplete = vi.fn();
    render(<CheckStep step={{ kind: "check", id: "c", quiz }} onComplete={onComplete} />);
    fireEvent.click(screen.getByText("wrong"));
    expect(onComplete).not.toHaveBeenCalled();
  });
  it("calls onComplete once the correct answer is chosen", () => {
    const onComplete = vi.fn();
    render(<CheckStep step={{ kind: "check", id: "c", quiz }} onComplete={onComplete} />);
    fireEvent.click(screen.getByText("right"));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
  it("shows the explanation for a wrong answer and lets the learner retry", () => {
    const onComplete = vi.fn();
    render(<CheckStep step={{ kind: "check", id: "c", quiz }} onComplete={onComplete} />);
    fireEvent.click(screen.getByText("wrong"));
    expect(screen.getByText("no")).toBeInTheDocument();
    fireEvent.click(screen.getByText("right"));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

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

describe("PredictStep gating", () => {
  const predict = {
    question: "What happens next?",
    options: [
      { id: "a", text: "nothing", correct: false, explain: "wrong guess" },
      { id: "b", text: "it restarts", correct: true, explain: "right guess" },
    ],
    reveal: "The pod restarts because of the crash loop.",
  };

  it("reveals the explanation and completes on any choice, including a wrong one", () => {
    const onComplete = vi.fn();
    render(
      <PredictStep
        step={{ kind: "predict", id: "p", predict }}
        onComplete={onComplete}
        snapshot={EMPTY_SNAPSHOT}
        namespace="default"
      />,
    );
    fireEvent.click(screen.getByText("nothing"));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByText(predict.reveal)).toBeInTheDocument();
    expect(screen.getByText("right guess")).toBeInTheDocument();
  });

  it("does not call onComplete a second time once revealed", () => {
    const onComplete = vi.fn();
    render(
      <PredictStep
        step={{ kind: "predict", id: "p", predict }}
        onComplete={onComplete}
        snapshot={EMPTY_SNAPSHOT}
        namespace="default"
      />,
    );
    fireEvent.click(screen.getByText("nothing"));
    fireEvent.click(screen.getByText("it restarts"));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe("DebriefStep", () => {
  it("calls onComplete when Finish mission is clicked", () => {
    const onComplete = vi.fn();
    render(
      <DebriefStep
        step={{
          kind: "debrief",
          id: "d",
          summary: "You fixed the crash loop.",
          takeaways: ["Readiness gates traffic", "Liveness restarts the container"],
          commands: ["kubectl get pods"],
        }}
        onComplete={onComplete}
      />,
    );
    fireEvent.click(screen.getByText("Finish mission"));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe("TeachStep", () => {
  it("renders the idea and completes once on ack, using the default ack label", () => {
    const onComplete = vi.fn();
    render(
      <TeachStep
        step={{ kind: "teach", id: "t", idea: "Readiness gates traffic." }}
        onComplete={onComplete}
        snapshot={EMPTY_SNAPSHOT}
        namespace="default"
      />,
    );
    expect(screen.getByText("Readiness gates traffic.")).toBeInTheDocument();
    const ackButton = screen.getByText("Got it");
    fireEvent.click(ackButton);
    fireEvent.click(ackButton);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("uses a custom ack label when provided", () => {
    const onComplete = vi.fn();
    render(
      <TeachStep
        step={{ kind: "teach", id: "t", idea: "idea", ack: "Understood" }}
        onComplete={onComplete}
        snapshot={EMPTY_SNAPSHOT}
        namespace="default"
      />,
    );
    fireEvent.click(screen.getByText("Understood"));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

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
