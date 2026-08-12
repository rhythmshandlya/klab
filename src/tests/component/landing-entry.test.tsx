import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/sign-in-dialog", () => ({
  SignInDialog: () => null,
}));

import { Landing } from "@/components/landing/landing";

describe("landing entry choice", () => {
  it("separates the landing page from product navigation and presents both entry modes", () => {
    render(
      <Landing
        authEnabled
        authCapabilities={{ github: true, email: false }}
        destination="/problems"
      />,
    );

    expect(screen.getByRole("button", { name: "Sign in or create account" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Continue as guest" })).toBeVisible();
    expect(screen.getByText(/Guest work stays in this browser/)).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Browse public Kubernetes discussions" }),
    ).toHaveAttribute("href", "/community");
  });

  it("offers guest entry when account services are unavailable", () => {
    render(
      <Landing
        authEnabled={false}
        authCapabilities={{ github: false, email: false }}
        destination="/problems"
      />,
    );

    expect(screen.queryByRole("button", { name: "Sign in or create account" })).toBeNull();
    expect(screen.getByRole("button", { name: "Continue as guest" })).toBeVisible();
  });
});
