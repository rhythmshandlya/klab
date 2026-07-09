"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

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

/**
 * Register (and clean up) the nav primary action for the current page.
 *
 * Callers hand us a brand-new `onRun` closure on every render (e.g.
 * `onRun: () => void handleValidate()`). If that closure were an effect
 * dependency, the effect would re-run every render → call setAction → mutate the
 * context this hook itself consumes → re-render → new closure → run again, forever
 * ("Maximum update depth exceeded"), freezing every workspace page. So we keep the
 * latest onRun in a ref and register a *stable* wrapper, re-registering only when a
 * rendered field (label/icon/shortcut/disabled/pending) actually changes value.
 */
export function useRegisterWorkspaceAction(action: WorkspaceAction | null): void {
  const ctx = useContext(WorkspaceActionContext);
  const setAction = ctx?.setAction;

  // Latest-onRun ref, synced after each render so the stable wrapper below always
  // calls the current handler (kept out of the render body for react-hooks/refs).
  const onRunRef = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    onRunRef.current = action?.onRun;
  });

  const label = action?.label ?? null;
  const icon = action?.icon ?? null;
  const shortcut = action?.shortcut;
  const disabled = action?.disabled;
  const pending = action?.pending;

  useEffect(() => {
    if (!setAction) return;
    if (label == null || icon == null) {
      setAction(null);
      return;
    }
    setAction({
      label,
      icon,
      shortcut,
      disabled,
      pending,
      onRun: () => onRunRef.current?.(),
    });
    return () => setAction(null);
  }, [setAction, label, icon, shortcut, disabled, pending]);
}
