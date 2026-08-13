import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NetworkActivity } from "@/features/playground/components/network-activity";
import type { KubeSimulator } from "@/lib/kube/simulator";

describe("NetworkActivity", () => {
  it("shows health probe traffic by default", () => {
    const events: ReturnType<KubeSimulator["getNetworkActivity"]> = [];
    const simulator = {
      subscribeNetworkActivity: () => () => undefined,
      getNetworkActivity: () => events,
    } as unknown as KubeSimulator;

    render(<NetworkActivity simulator={simulator} />);

    expect(screen.getByRole("checkbox", { name: "Show health probes" })).toBeChecked();
  });
});
