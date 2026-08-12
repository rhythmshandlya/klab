import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Better Auth client so the menu renders deterministically with no network.
vi.mock("@/lib/auth/client", () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
  signIn: { social: vi.fn(), email: vi.fn(), magicLink: vi.fn() },
  signUp: { email: vi.fn() },
}));
const routerReplace = vi.fn();
const routerRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplace, refresh: routerRefresh }),
}));

import { AuthMenu } from "@/components/auth/auth-menu";
import { signOut, useSession } from "@/lib/auth/client";

const mockUseSession = vi.mocked(useSession);
type SessionResult = ReturnType<typeof useSession>;
const asResult = (v: { data: unknown; isPending: boolean }) => v as unknown as SessionResult;

describe("AuthMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows sign-in and exit actions in the guest menu when signed out", () => {
    mockUseSession.mockReturnValue(asResult({ data: null, isPending: false }));
    render(<AuthMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Guest menu" }));
    expect(screen.getByRole("menuitem", { name: "Sign in to sync" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Exit guest mode" })).toBeInTheDocument();
  });

  it("shows a neutral placeholder (no Sign in) while the session is pending", () => {
    mockUseSession.mockReturnValue(asResult({ data: null, isPending: true }));
    render(<AuthMenu />);
    expect(screen.queryByRole("button", { name: "Guest menu" })).toBeNull();
  });

  it("clears guest mode and returns to the landing page", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    mockUseSession.mockReturnValue(asResult({ data: null, isPending: false }));
    render(<AuthMenu />);

    fireEvent.click(screen.getByRole("button", { name: "Guest menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Exit guest mode" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/entry/guest", { method: "DELETE" }),
    );
    expect(routerReplace).toHaveBeenCalledWith("/");
    expect(routerRefresh).toHaveBeenCalledTimes(1);
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
    fireEvent.click(screen.getByRole("button", { name: "Ada Lovelace account menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });
});
