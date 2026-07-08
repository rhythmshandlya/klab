import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClusterMark } from "@/components/icons";

describe("ClusterMark", () => {
  it("is decorative (hidden from a11y tree) by default", () => {
    const { container } = render(<ClusterMark />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("becomes a labeled image when given a title", () => {
    render(<ClusterMark title="klab logo" />);
    expect(screen.getByRole("img", { name: "klab logo" })).toBeInTheDocument();
  });
});
