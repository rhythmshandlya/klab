import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NetworkProbe } from "@/features/problems/components/network-probe";

describe("NetworkProbe", () => {
  it("runs and renders a bounded six-request sample", async () => {
    let request = 0;
    const onProbe = vi.fn(async () => {
      request += 1;
      return request % 3 === 0
        ? { ok: false, status: 502, body: "terminating backend" }
        : { ok: true, status: 200, body: "healthy backend" };
    });

    render(<NetworkProbe onProbe={onProbe} presets={["http://edge-api-svc/"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Sample 6x" }));

    expect(await screen.findByText("2/6 samples failed")).toBeInTheDocument();
    await waitFor(() => expect(onProbe).toHaveBeenCalledTimes(6));
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
  });
});
