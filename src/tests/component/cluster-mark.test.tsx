import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BRAND, BrandMark } from "@/config/brand";

describe("BrandMark", () => {
  it("is decorative (hidden from a11y tree) by default", () => {
    const { container } = render(<BrandMark />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg?.querySelector("image")).toHaveAttribute("href", BRAND.logo.assets.mark);
  });

  it("becomes a labeled image when given a title", () => {
    render(<BrandMark title={BRAND.logo.title} />);
    expect(screen.getByRole("img", { name: BRAND.logo.title })).toBeInTheDocument();
  });
});
