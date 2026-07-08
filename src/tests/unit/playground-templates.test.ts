import { describe, expect, it } from "vitest";

import {
  DEFAULT_TEMPLATE_ID,
  getTemplateById,
  PLAYGROUND_TEMPLATES,
} from "@/content/playground-templates";
import { parseTemplate } from "@/lib/domain/schemas";

describe("playground templates", () => {
  it("all templates parse against the schema", () => {
    for (const template of PLAYGROUND_TEMPLATES) {
      expect(() => parseTemplate(template)).not.toThrow();
    }
  });

  it("has unique ids and at least the six required templates", () => {
    const ids = PLAYGROUND_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [
      "empty",
      "pod-service",
      "deployment-service",
      "probes",
      "namespaces",
      "dns",
    ]) {
      expect(ids).toContain(id);
    }
  });

  it("exposes a resolvable default template", () => {
    expect(getTemplateById(DEFAULT_TEMPLATE_ID)).toBeDefined();
  });

  it("every template has at least one editable file", () => {
    for (const template of PLAYGROUND_TEMPLATES) {
      expect(template.files.length).toBeGreaterThan(0);
    }
  });
});
