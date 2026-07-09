import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  useRegisterWorkspaceAction,
  useWorkspaceAction,
  WorkspaceActionProvider,
} from "@/components/app-shell/workspace-action";

/** Renders whatever primary action the current page registered — mirrors <TopNav />. */
function NavActionButton() {
  const action = useWorkspaceAction();
  if (!action) return null;
  return (
    <button type="button" onClick={action.onRun} disabled={action.disabled}>
      {action.label}
    </button>
  );
}

/**
 * Mimics the real workspaces (level-workspace / playground-workspace): it hands the
 * hook a brand-new `onRun` closure on every render (`onRun: () => void handleApply()`).
 * If registration keys off that closure's identity, mounting spins into an infinite
 * update loop — which surfaces here as render() either throwing "Maximum update depth
 * exceeded" or hanging until the test times out. A stable registration renders once.
 */
function FakeWorkspace({ onRun }: { onRun: () => void }) {
  useRegisterWorkspaceAction({
    label: "Run Validation",
    icon: "validate",
    shortcut: "⌘R",
    onRun: () => onRun(),
  });
  return null;
}

describe("useRegisterWorkspaceAction", () => {
  it("registers the nav action without an infinite update loop", () => {
    expect(() =>
      render(
        <WorkspaceActionProvider>
          <FakeWorkspace onRun={() => {}} />
          <NavActionButton />
        </WorkspaceActionProvider>,
      ),
    ).not.toThrow();

    expect(screen.getByRole("button", { name: "Run Validation" })).toBeInTheDocument();
  });

  it("runs the latest onRun handler when the nav action is triggered", () => {
    const run = vi.fn();
    render(
      <WorkspaceActionProvider>
        <FakeWorkspace onRun={run} />
        <NavActionButton />
      </WorkspaceActionProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Run Validation" }));
    expect(run).toHaveBeenCalledTimes(1);
  });
});
