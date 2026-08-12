import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  social: vi.fn(),
  emailSignIn: vi.fn(),
  magicLink: vi.fn(),
  emailSignUp: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("@/lib/auth/client", () => ({
  signIn: {
    social: auth.social,
    email: auth.emailSignIn,
    magicLink: auth.magicLink,
  },
  signUp: { email: auth.emailSignUp },
  requestPasswordReset: auth.resetPassword,
}));

import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { BRAND } from "@/config/brand";

describe("SignInDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("presents clear sign-in and account creation paths", () => {
    render(<SignInDialog open onOpenChange={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with GitHub" })).toBeInTheDocument();
    expect(screen.getByText(/Guest progress is merged/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret-value" } });
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    expect(
      screen.getByRole("heading", { name: `Create your ${BRAND.accountName}` }),
    ).toBeInTheDocument();
    expect(screen.getByText("Use at least 10 characters.")).toBeInTheDocument();
  });

  it("shows a recoverable GitHub error instead of leaving the dialog busy", async () => {
    auth.social.mockRejectedValueOnce(new Error("offline"));
    render(<SignInDialog open onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Continue with GitHub" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "GitHub sign-in could not be started. Please try again.",
    );
    expect(screen.getByRole("button", { name: "Continue with GitHub" })).toBeEnabled();
  });
});
