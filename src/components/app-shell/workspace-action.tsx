"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { type IconName } from "@/components/icons";

/**
 * The nav's primary action is route-specific (Problems → Run Validation,
 * Playground → Apply Manifest, Docs → Run Example). Rather than prop-drill through
 * the App Router layout, pages register a handler here and <TopNav /> renders it.
 * When nothing is registered the button falls back to a disabled route label.
 */
export interface WorkspaceAction {
  label: string;
  icon: IconName;
  shortcut?: string;
  onRun: () => void;
  disabled?: boolean;
  pending?: boolean;
}

interface WorkspaceActionContextValue {
  action: WorkspaceAction | null;
  setAction: (action: WorkspaceAction | null) => void;
}

const WorkspaceActionContext = createContext<WorkspaceActionContextValue | null>(null);

export function WorkspaceActionProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<WorkspaceAction | null>(null);
  const value = useMemo(() => ({ action, setAction }), [action]);
  return (
    <WorkspaceActionContext.Provider value={value}>{children}</WorkspaceActionContext.Provider>
  );
}

export function useWorkspaceAction(): WorkspaceAction | null {
  const ctx = useContext(WorkspaceActionContext);
  return ctx?.action ?? null;
}

/** Register (and clean up) the nav primary action for the current page. */
export function useRegisterWorkspaceAction(action: WorkspaceAction | null): void {
  const ctx = useContext(WorkspaceActionContext);
  const { label, icon, shortcut, onRun, disabled, pending } = action ?? {};
  useEffect(() => {
    if (!ctx) return;
    ctx.setAction(action);
    return () => ctx.setAction(null);
    // Re-register when any field changes; ctx.setAction is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, icon, shortcut, onRun, disabled, pending]);
}
