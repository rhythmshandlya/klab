import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { CheckStep } from "@/features/docs/mission/steps/check-step";
import { PredictStep } from "@/features/docs/mission/steps/predict-step";
import { DebriefStep } from "@/features/docs/mission/steps/debrief-step";
import type { ClusterSnapshot } from "@/lib/kube/simulator";

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
