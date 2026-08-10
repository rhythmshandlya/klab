import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Better Auth client so the menu renders deterministically with no network.
vi.mock("@/lib/auth/client", () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
  signIn: { social: vi.fn(), email: vi.fn(), magicLink: vi.fn() },
  signUp: { email: vi.fn() },
}));

import { AuthMenu } from "@/components/auth/auth-menu";
import { signOut, useSession } from "@/lib/auth/client";

const mockUseSession = vi.mocked(useSession);
type SessionResult = ReturnType<typeof useSession>;
const asResult = (v: { data: unknown; isPending: boolean }) => v as unknown as SessionResult;

describe("AuthMenu", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a Sign in button when signed out", () => {
    mockUseSession.mockReturnValue(asResult({ data: null, isPending: false }));
    render(<AuthMenu />);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows a neutral placeholder (no Sign in) while the session is pending", () => {
    mockUseSession.mockReturnValue(asResult({ data: null, isPending: true }));
    render(<AuthMenu />);
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  });

  it("shows the signed-in user and signs out from the menu", async () => {
    vi.mocked(signOut).mockResolvedValue({ data: null, error: null });
    mockUseSession.mockReturnValue(
      asResult({
        data: { user: { id: "user-ada", name: "Ada Lovelace", email: "ada@example.com" } },
        isPending: false,
      }),
    );
    render(<AuthMenu />);
    fireEvent.click(screen.getByRole("button", { name: /Ada Lovelace/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });
});
