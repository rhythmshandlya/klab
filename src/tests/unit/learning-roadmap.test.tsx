// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { DOCS_NAV } from "@/content/docs";
import { LearningRoadmap } from "@/features/docs/components/learning-roadmap";

describe("LearningRoadmap", () => {
  it("renders every section as a stage, with Real Incidents in its own 'Apply it' band", () => {
    render(<LearningRoadmap completed={new Set()} />);

    for (const section of DOCS_NAV) {
      expect(screen.getByRole("heading", { name: section.title })).toBeInTheDocument();
    }
    expect(screen.getByText("Apply it")).toBeInTheDocument();
  });

  it("marks completed lessons and surfaces cross-links into other modes", () => {
    const firstLesson = DOCS_NAV[0]!.lessons[0]!;
    render(<LearningRoadmap completed={new Set([firstLesson.slug.join("/")])} />);

    expect(screen.getAllByLabelText("Completed").length).toBeGreaterThan(0);

    // At least one lesson links out to Problems (via relatedLevelSlug) and one to
    // the Playground (via shared concepts) — the Docs→practice on-ramp.
    const problemLinks = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href")?.startsWith("/problems/"));
    const playgroundLinks = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href")?.startsWith("/playground/"));
    expect(problemLinks.length).toBeGreaterThan(0);
    expect(playgroundLinks.length).toBeGreaterThan(0);
  });

  it("counts completion per section", () => {
    const workloads = DOCS_NAV.find((s) => s.title === "Workloads");
    if (!workloads) return;
    render(<LearningRoadmap completed={new Set()} />);
    const heading = screen.getByRole("heading", { name: "Workloads" });
    const stage = heading.closest("section");
    expect(stage).not.toBeNull();
    expect(within(stage!).getByText(`0/${workloads.lessons.length}`)).toBeInTheDocument();
  });
});
