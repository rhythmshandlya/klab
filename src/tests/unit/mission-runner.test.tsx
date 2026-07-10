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
