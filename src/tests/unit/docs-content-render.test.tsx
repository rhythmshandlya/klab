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

const DIAGRAM_LESSON: DocsLesson = {
  slug: ["test", "diagrams"],
  title: "Diagrams",
  description: "A diagram renderer fixture.",
  section: "Test",
  order: 2,
  concepts: [],
  content: [
    { type: "diagram", variant: "control-loop", title: "The reconciliation loop" },
    { type: "diagram", variant: "cluster-architecture", title: "Cluster building blocks" },
  ],
  labs: [],
};

describe("annotated docs code", () => {
  it("keeps the YAML uninterrupted and explicitly keys each field-guide note", () => {
    const { container } = render(<DocsContent lesson={ANNOTATED_LESSON} />);

    const source = screen.getByRole("region", {
      name: "YAML source code with numbered markers",
    });
    expect(source).toHaveAttribute("tabindex", "0");
    expect(container.querySelectorAll("pre")).toHaveLength(1);
    expect(container.querySelectorAll("[data-code-line]")).toHaveLength(3);
    expect(container.querySelectorAll("[data-indent-guides='1']")).toHaveLength(2);

    expect(container.querySelectorAll("[data-callout-for-line]")).toHaveLength(2);
    expect(container.querySelector("[data-callout-for-line='1'] code")).toHaveTextContent(
      "metadata:",
    );
    expect(container.querySelector("[data-callout-for-line='3'] code")).toHaveTextContent(
      "labels:",
    );
    expect(container.querySelector("[title='Callout 1']")).toHaveClass("size-6", "text-[10px]");
    expect(container.querySelector("[data-callout-for-line='1'] > span")).toHaveClass(
      "size-6",
      "text-[10px]",
    );
    expect(screen.getByText("Line 1")).toBeInTheDocument();
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

describe("docs diagrams", () => {
  it("uses the expanded native layout and omits the reconciliation overlay curves", () => {
    const { container } = render(<DocsContent lesson={DIAGRAM_LESSON} />);

    expect(screen.getByText("API server")).toBeInTheDocument();
    expect(screen.getByText("Worker node")).toBeInTheDocument();
    expect(screen.getByText("Container runtime")).toBeInTheDocument();
    expect(container.querySelector("svg[viewBox='0 0 900 260']")).toBeNull();
  });
});
