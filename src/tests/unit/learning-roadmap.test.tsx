// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { getCurriculumCatalog } from "@/content/curriculum/server";
import { LearningRoadmap } from "@/features/docs/components/learning-roadmap";

const CATALOG = getCurriculumCatalog();

describe("LearningRoadmap", () => {
  it("renders every section, including Real Incidents, as one explained course path", () => {
    render(<LearningRoadmap sections={CATALOG.sections} completed={new Set()} />);

    for (const section of CATALOG.sections) {
      expect(screen.getByRole("heading", { name: section.title })).toBeInTheDocument();
    }
    expect(screen.queryByText("Apply it")).not.toBeInTheDocument();
    expect(
      screen.getByLabelText(`Stage ${CATALOG.sections.length}, not started`),
    ).toBeInTheDocument();
  });

  it("marks completed lessons and surfaces cross-links into other modes", () => {
    const firstLesson = CATALOG.sections[0]!.lessons[0]!;
    render(<LearningRoadmap sections={CATALOG.sections} completed={new Set([firstLesson.key])} />);

    expect(screen.getAllByLabelText("Completed").length).toBeGreaterThan(0);

    // At least one lesson links out to Problems (via relatedLevelSlug) and one to
    // the Playground (via shared concepts): the Docs→practice on-ramp.
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
    const workloads = CATALOG.sections.find((section) => section.title === "Workloads");
    if (!workloads) return;
    render(<LearningRoadmap sections={CATALOG.sections} completed={new Set()} />);
    const heading = screen.getByRole("heading", { name: "Workloads" });
    const stage = heading.closest("section");
    expect(stage).not.toBeNull();
    expect(within(stage!).getByText(`0/${workloads.lessons.length}`)).toBeInTheDocument();
  });
});
