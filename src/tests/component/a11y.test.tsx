import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";

import { ClusterMark } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";

/**
 * Structural accessibility checks (jsdom can't compute color contrast, so those rules
 * are skipped; we assert everything else axe can evaluate has no violations).
 */
async function expectNoViolations(ui: React.ReactElement) {
  const { container } = render(ui);
  const results = await axe(container);
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

describe("accessibility", () => {
  it("Button (labeled and icon-only) has no violations", async () => {
    await expectNoViolations(
      <div>
        <Button>Run Validation</Button>
        <Button aria-label="Open command palette" size="icon">
          <span aria-hidden>K</span>
        </Button>
      </div>,
    );
  });

  it("Badge with an icon + text label has no violations", async () => {
    await expectNoViolations(<Badge tone="success">Ready</Badge>);
  });

  it("Panel with a labeled header has no violations", async () => {
    await expectNoViolations(
      <Panel>
        <PanelHeader title="Cluster Explorer" />
        <div className="p-3">content</div>
      </Panel>,
    );
  });

  it("decorative ClusterMark is hidden from the a11y tree", async () => {
    await expectNoViolations(<ClusterMark className="size-6" />);
  });
});
