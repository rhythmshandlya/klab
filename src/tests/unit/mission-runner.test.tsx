// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mutate = vi.fn();
vi.mock("@/lib/storage/progress-store", () => ({ mutateProgress: (i: unknown) => mutate(i) }));

import { MissionRunner } from "@/features/docs/mission/mission-runner";
import type { Mission } from "@/lib/domain/mission-types";

const mission: Mission = {
  slug: ["foundations", "x"],
  section: "Foundations",
  order: 1,
  title: "X",
  coldOpen: { goal: "g", clusterNote: "c" },
  inheritsCluster: false,
  seedManifests: [],
  concepts: [],
  steps: [
    { kind: "teach", id: "t", idea: "hello", ack: "Got it" },
    { kind: "debrief", id: "d", summary: "s", takeaways: ["one"] },
  ],
};
const fakeSim = {
  snapshot: {
    pods: [],
    services: [],
    deployments: [],
    replicaSets: [],
    endpointSlices: [],
    namespaces: [],
    nodes: [],
    events: [],
  },
  ready: true,
} as never;

beforeEach(() => {
  localStorage.clear();
  mutate.mockClear();
});
afterEach(() => {
  localStorage.clear();
});

describe("MissionRunner", () => {
  it("gates Next until the step completes, then finishes and writes progress", () => {
    const onDone = vi.fn();
    render(<MissionRunner mission={mission} sim={fakeSim} onMissionComplete={onDone} />);
    // teach step: click ack, advance, then finish debrief
    fireEvent.click(screen.getByText("Got it"));
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Finish mission"));
    expect(mutate).toHaveBeenCalledWith({ kind: "completedLesson", slug: "foundations/x" });
    expect(onDone).toHaveBeenCalled();
  });

  it("keeps Next disabled before the teach step is acknowledged", () => {
    render(<MissionRunner mission={mission} sim={fakeSim} onMissionComplete={vi.fn()} />);
    expect(screen.getByText("Next")).toBeDisabled();
  });

  it("resumes from a persisted step index in localStorage", () => {
    localStorage.setItem("klab.mission.foundations/x.step", "1");
    render(<MissionRunner mission={mission} sim={fakeSim} onMissionComplete={vi.fn()} />);
    expect(screen.getByText("Finish mission")).toBeInTheDocument();
  });
});

const twoTeachMission: Mission = {
  slug: ["foundations", "two-teach"],
  section: "Foundations",
  order: 1,
  title: "Two Teach",
  coldOpen: { goal: "g", clusterNote: "c" },
  inheritsCluster: false,
  seedManifests: [],
  concepts: [],
  steps: [
    { kind: "teach", id: "t1", idea: "first idea", ack: "Got it" },
    { kind: "teach", id: "t2", idea: "second idea", ack: "Got it" },
    { kind: "debrief", id: "d", summary: "s", takeaways: ["one"] },
  ],
};

describe("MissionRunner with consecutive same-kind steps", () => {
  it("does not carry stale local state across two consecutive teach steps", () => {
    const onDone = vi.fn();
    render(<MissionRunner mission={twoTeachMission} sim={fakeSim} onMissionComplete={onDone} />);

    // Step 1: teach step renders its idea, ack unlocks Next.
    expect(screen.getByText("first idea")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Got it"));
    fireEvent.click(screen.getByText("Next"));

    // Step 2: a fresh teach step instance — its own idea renders and the ack
    // button must NOT be pre-completed/locked by the previous step's state.
    expect(screen.getByText("second idea")).toBeInTheDocument();
    expect(screen.queryByText("first idea")).not.toBeInTheDocument();
    expect(screen.getByText("Next")).toBeDisabled();
    const ackButton = screen.getByText("Got it").closest("button");
    expect(ackButton).not.toBeDisabled();

    fireEvent.click(screen.getByText("Got it"));
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Finish mission"));

    expect(mutate).toHaveBeenCalledWith({ kind: "completedLesson", slug: "foundations/two-teach" });
    expect(onDone).toHaveBeenCalled();
  });
});
