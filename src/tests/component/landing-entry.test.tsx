import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/sign-in-dialog", () => ({
  SignInDialog: () => null,
}));

import { Landing } from "@/components/landing/landing";

describe("landing entry choice", () => {
  it("separates the landing page from product navigation and presents both entry modes", async () => {
    const { container } = render(
      <Landing
        authEnabled
        authCapabilities={{ github: true, email: false }}
        destination="/problems"
      />,
    );

    expect(screen.getByRole("button", { name: "Log in" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Log in to save progress" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Try as guest" })).toBeVisible();
    expect(screen.getByText(/Guest work stays here/)).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();
    const landingNav = within(screen.getByRole("navigation", { name: "Landing page" }));
    expect(landingNav.getByText("Blogs", { exact: true })).toHaveAttribute(
      "title",
      "Blogs coming soon",
    );
    expect(landingNav.queryByRole("link", { name: "Product" })).not.toBeInTheDocument();
    expect(landingNav.queryByRole("link", { name: "Simulator" })).not.toBeInTheDocument();
    expect(landingNav.queryByRole("link", { name: "Community" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Everything connects." })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Kubernetes behavior, simulated in your browser." }),
    ).toBeVisible();
    expect(screen.getByText(/not a hidden remote cluster/i)).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Break a cluster. Fix it. Remember why." }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Log in to k8lab" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Continue as guest" })).toBeVisible();
    expect(screen.queryByText("60")).not.toBeInTheDocument();
    expect(screen.queryByText("51 repair scenarios")).not.toBeInTheDocument();
    const results = await axe(container);
    expect(
      results.violations.map(
        (violation) =>
          `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`,
      ),
    ).toEqual([]);
  });

  it("offers guest entry when account services are unavailable", () => {
    render(
      <Landing
        authEnabled={false}
        authCapabilities={{ github: false, email: false }}
        destination="/problems"
      />,
    );

    expect(screen.getByRole("link", { name: "Try as guest" })).toHaveAttribute("href", "#start");
    expect(screen.queryByRole("button", { name: "Log in to save progress" })).toBeNull();
    expect(screen.getByRole("button", { name: "Try as guest" })).toBeVisible();
  });

  it("lets visitors control the incident demo", async () => {
    const user = userEvent.setup();
    render(
      <Landing
        authEnabled
        authCapabilities={{ github: true, email: false }}
        destination="/problems"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Fix selector" }));
    expect(screen.getByText("service/payments-svc configured")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Verify" }));
    expect(screen.getByText("Traffic restored")).toBeVisible();
  });
});
