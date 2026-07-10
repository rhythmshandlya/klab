import { describe, expect, it } from "vitest";

import { conceptGraph } from "@/features/docs/mission/mission-diagram";
import type { ConceptDiagramVariant } from "@/lib/domain/mission-types";

const VARIANTS: ConceptDiagramVariant[] = [
  "control-loop",
  "cluster-architecture",
  "api-object",
  "workload-hierarchy",
  "service-routing",
];

describe("conceptGraph control-loop", () => {
  it("reveals nodes progressively with buildToStep", () => {
    const s0 = conceptGraph("control-loop", 0);
    const s2 = conceptGraph("control-loop", 2);
    expect(s2.nodes.length).toBeGreaterThan(s0.nodes.length);
  });

  it("every edge references existing nodes at its build step", () => {
    const g = conceptGraph("control-loop", 2);
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const e of g.edges) {
      expect(ids.has(e.source)).toBe(true);
      expect(ids.has(e.target)).toBe(true);
    }
  });
});

describe("conceptGraph all variants", () => {
  it.each(VARIANTS)("%s builds progressively and edges only reference revealed nodes", (variant) => {
    const full = conceptGraph(variant, 99);
    expect(full.nodes.length).toBeGreaterThan(0);

    for (let step = 0; step < full.nodes.length; step += 1) {
      const g = conceptGraph(variant, step);
      expect(g.nodes.length).toBe(step + 1);
      const ids = new Set(g.nodes.map((n) => n.id));
      for (const e of g.edges) {
        expect(ids.has(e.source)).toBe(true);
        expect(ids.has(e.target)).toBe(true);
      }
    }

    // node ids are unique
    const idSet = new Set(full.nodes.map((n) => n.id));
    expect(idSet.size).toBe(full.nodes.length);
  });
});
