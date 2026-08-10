// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { getCurriculumCatalog } from "@/content/curriculum/server";
import { useProgress } from "@/features/progress/use-progress";

vi.mock("@/features/progress/use-progress", () => ({
  useProgress: vi.fn(),
}));

const mockUseProgress = vi.mocked(useProgress);

async function renderJourneyHome() {
  const { JourneyHome } = await import("@/features/docs/mission/journey-home");
  return render(<JourneyHome sections={getCurriculumCatalog().missionSections} />);
}

const foundations =
  getCurriculumCatalog().missionSections.find((section) => section.title === "Foundations")
    ?.missions ?? [];
if (foundations.length === 0) {
  throw new Error("Expected at least one Foundations mission to test against");
}
// Non-null: length is asserted above, and this list is derived fresh per test file
// (not mutated), so the index access is safe under noUncheckedIndexedAccess.
const mission1 = foundations[0]!;

describe("JourneyHome", () => {
  beforeEach(() => {
    mockUseProgress.mockReset();
  });

  it("renders the first mission's title and cold-open goal", async () => {
    mockUseProgress.mockReturnValue({
      completedLessonSlugs: [],
    } as unknown as ReturnType<typeof useProgress>);

    await renderJourneyHome();

    expect(screen.getByText(mission1.title)).toBeInTheDocument();
    expect(screen.getByText(mission1.goal)).toBeInTheDocument();
  });

  it("marks a completed mission done and advances 'current' to the next one", async () => {
    mockUseProgress.mockReturnValue({
      completedLessonSlugs: [mission1.key],
    } as unknown as ReturnType<typeof useProgress>);

    await renderJourneyHome();

    const node1 = screen.getByTestId(`mission-node-${mission1.key}`);
    expect(node1.getAttribute("data-status")).toBe("done");

    if (foundations.length > 1) {
      const mission2 = foundations[1]!;
      const node2 = screen.getByTestId(`mission-node-${mission2.key}`);
      expect(node2.getAttribute("data-status")).toBe("current");
    }
  });

  it("shows a compact section progress line", async () => {
    mockUseProgress.mockReturnValue({
      completedLessonSlugs: [],
    } as unknown as ReturnType<typeof useProgress>);

    await renderJourneyHome();

    expect(screen.getByText(`0 of ${foundations.length} missions`)).toBeInTheDocument();
  });
});
