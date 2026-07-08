import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("renders its children", () => {
    render(<Badge>Ready</Badge>);
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("applies the requested tone styling", () => {
    render(<Badge tone="success">Healthy</Badge>);
    const badge = screen.getByText("Healthy");
    // Tone maps to a green-tinted class set; color is paired with the text label.
    expect(badge.className).toContain("text-green");
  });
});
