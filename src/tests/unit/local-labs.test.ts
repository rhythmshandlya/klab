import { beforeEach, describe, expect, it } from "vitest";

import { createLab, deleteLab, getLab, loadLabs, updateLab } from "@/lib/storage/local-labs";

describe("local-labs storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("creates, reads, updates, and deletes a lab", () => {
    const lab = createLab({
      name: "my lab",
      templateId: "deployment-service",
      files: { "a.yaml": "x" },
    });
    expect(lab.id).toBeTruthy();
    expect(getLab(lab.id)?.name).toBe("my lab");

    updateLab(lab.id, { name: "renamed", files: { "a.yaml": "y" } });
    const updated = getLab(lab.id);
    expect(updated?.name).toBe("renamed");
    expect(updated?.files["a.yaml"]).toBe("y");
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(lab.createdAt);

    deleteLab(lab.id);
    expect(getLab(lab.id)).toBeUndefined();
  });

  it("defaults a blank name and keeps the old name on blank rename", () => {
    const lab = createLab({ name: "   ", templateId: "empty", files: {} });
    expect(lab.name).toBe("Untitled Playground");
    updateLab(lab.id, { name: "  " });
    expect(getLab(lab.id)?.name).toBe("Untitled Playground");
  });

  it("sorts most recently updated first", () => {
    const first = createLab({ name: "first", templateId: "empty", files: {} });
    createLab({ name: "second", templateId: "empty", files: {} });
    updateLab(first.id, { files: { "f.yaml": "z" } });
    expect(loadLabs()[0]?.name).toBe("first");
  });

  it("migrates legacy sandboxes once and clears the old key", () => {
    window.localStorage.setItem(
      "klab:sandboxes:v1",
      JSON.stringify([
        { name: "old one", templateId: "pod-service", files: { "p.yaml": "v" }, savedAt: 123 },
      ]),
    );
    const labs = loadLabs();
    expect(labs).toHaveLength(1);
    expect(labs[0]?.name).toBe("old one");
    expect(labs[0]?.createdAt).toBe(123);
    expect(window.localStorage.getItem("klab:sandboxes:v1")).toBeNull();
    // Second read must not duplicate.
    expect(loadLabs()).toHaveLength(1);
  });

  it("survives corrupted storage", () => {
    window.localStorage.setItem("klab:labs:v1", "{not json");
    expect(loadLabs()).toEqual([]);
  });
});
