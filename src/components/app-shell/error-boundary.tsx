"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { icons } from "@/components/icons";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** Rendered when a child throws. Receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  label?: string;
}

interface State {
  error: Error | null;
}

/** Catches render/runtime errors in a subtree (e.g. the simulator/editor) so a single
 * failure doesn't blank the whole app. Error boundaries must be class components. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the error for debugging rather than hiding it.
    console.error(`[klab] ${this.props.label ?? "component"} error:`, error, info.componentStack);
  }

  reset = (): void => this.setState({ error: null });

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    const Alert = icons.error;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <Alert className="text-red size-6" aria-hidden />
        <div>
          <p className="text-foreground text-sm font-medium">
            {this.props.label ?? "Something"} failed to load
          </p>
          <p className="text-muted mt-1 max-w-md text-xs">{error.message}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={this.reset}>
          Try again
        </Button>
      </div>
    );
  }
}
