import { beforeEach, describe, expect, it } from "vitest";

import { getLevelBySlug } from "@/content/levels";
import { useLevelStore } from "@/features/problems/level-store";

describe("problem level file store", () => {
  const level = getLevelBySlug("broken-readiness-probe")!;

  beforeEach(() => {
    useLevelStore.getState().initLevel(level);
  });

  it("exposes editable and reference files and starts on the editable file", () => {
    expect(Object.keys(useLevelStore.getState().files).sort()).toEqual([
      "pod.yaml",
      "service.yaml",
    ]);
    expect(useLevelStore.getState().activeFilePath).toBe("pod.yaml");
  });

  it("updates editable files but rejects writes to reference files", () => {
    const initial = useLevelStore.getState().files;
    useLevelStore.getState().setFile("pod.yaml", "edited");
    useLevelStore.getState().setFile("service.yaml", "forbidden");

    expect(useLevelStore.getState().files["pod.yaml"]).toBe("edited");
    expect(useLevelStore.getState().files["service.yaml"]).toBe(initial["service.yaml"]);
  });
});
