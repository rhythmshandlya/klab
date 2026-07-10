import { describe, expect, it } from "vitest";
import { parseMission, assertMissionInvariants } from "@/lib/domain/mission-schema";
import type { Mission } from "@/lib/domain/mission-types";

const valid: Mission = {
  slug: ["foundations", "what-is-kubernetes"],
  section: "Foundations",
  order: 1,
  title: "What is Kubernetes?",
  coldOpen: { goal: "Get one Pod running.", clusterNote: "Empty cluster." },
  inheritsCluster: false,
  seedManifests: [],
  concepts: ["pods"],
  steps: [
    { kind: "teach", id: "t1", idea: "A cluster runs your desired state." },
    { kind: "check", id: "c1", quiz: { question: "Q?", options: [
      { id: "a", text: "yes", correct: true, explain: "right" },
      { id: "b", text: "no", correct: false, explain: "nope" },
    ] } },
    { kind: "do", id: "d1", goal: "Apply a Pod.", files: [
      { path: "pod.yaml", initialValue: "apiVersion: v1", language: "yaml" },
    ], check: { kind: "pods-ready", selector: { app: "web" }, minReady: 1 }, debrief: "Done." },
  ],
};

describe("parseMission", () => {
  it("accepts a valid mission", () => {
    expect(parseMission(valid).slug).toEqual(["foundations", "what-is-kubernetes"]);
  });
  it("rejects a mission with no steps", () => {
    expect(() => parseMission({ ...valid, steps: [] })).toThrow();
  });
  it("rejects an unknown step kind", () => {
    expect(() => parseMission({ ...valid, steps: [{ kind: "nope", id: "x" }] })).toThrow();
  });
});

describe("assertMissionInvariants", () => {
  it("passes when a quiz has exactly one correct option", () => {
    expect(() => assertMissionInvariants(valid)).not.toThrow();
  });
  it("throws when a quiz has no correct option", () => {
    const bad = structuredClone(valid);
    (bad.steps[1] as { quiz: QuizSpecLike }).quiz.options.forEach((o) => (o.correct = false));
    expect(() => assertMissionInvariants(bad)).toThrow(/exactly one correct/);
  });
  it("throws when step ids are not unique", () => {
    const bad = structuredClone(valid);
    const s = bad.steps[1];
    if (s) s.id = "t1"; // noUncheckedIndexedAccess: narrow before mutating
    expect(() => assertMissionInvariants(bad)).toThrow(/unique/);
  });
});

type QuizSpecLike = { options: { correct: boolean }[] };
