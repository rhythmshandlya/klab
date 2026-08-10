import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

import { DocsContent } from "@/features/docs/components/docs-content";
import type { DocsLesson } from "@/lib/domain/types";

const ANNOTATED_LESSON: DocsLesson = {
  slug: ["test", "annotated-code"],
  title: "Annotated code",
  description: "A renderer fixture.",
  section: "Test",
  order: 1,
  concepts: [],
  content: [
    {
      type: "annotatedCode",
      language: "yaml",
      title: "One metadata block",
      caption: "Labels select; annotations describe.",
      lines: [
        { code: "metadata:", note: "The object's metadata." },
        { code: "  name: web" },
        { code: "  labels:", note: "Selectors match labels." },
      ],
    },
  ],
  labs: [],
};

describe("annotated docs code", () => {
  it("keeps source lines in one scrollable code listing and separates the callouts", () => {
    const { container } = render(<DocsContent lesson={ANNOTATED_LESSON} />);

    const source = screen.getByRole("region", { name: "YAML source code" });
    expect(source).toHaveAttribute("tabindex", "0");
    expect(container.querySelectorAll("pre")).toHaveLength(1);
    expect(container.querySelectorAll("[data-code-line]")).toHaveLength(3);
    expect(container.querySelectorAll("[data-indent-guides='1']")).toHaveLength(2);

    const callouts = screen.getByRole("complementary", {
      name: "One metadata block callouts",
    });
    expect(callouts.querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByText("Line 1")).toBeInTheDocument();
    expect(screen.getByText("Line 3")).toBeInTheDocument();
    expect(screen.getByText("Selectors match labels.")).toBeInTheDocument();
  });

  it("copies the uninterrupted source without line numbers or callout prose", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<DocsContent lesson={ANNOTATED_LESSON} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy code" }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("metadata:\n  name: web\n  labels:"),
    );
  });

  it("has no structural accessibility violations", async () => {
    const { container } = render(<DocsContent lesson={ANNOTATED_LESSON} />);
    const results = await axe(container);

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
