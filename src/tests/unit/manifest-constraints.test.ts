import { describe, expect, it } from "vitest";

import { getLevelBySlug, LEVELS } from "@/content/levels";
import { LEVEL_SOLUTIONS } from "@/content/levels/solutions";
import { evaluateLevelConstraints } from "@/lib/kube/manifest-constraints";
import { parseManifests, stringifyManifest } from "@/lib/kube/manifest-parser";

function filesFor(slug: string): Record<string, string> {
  const level = getLevelBySlug(slug);
  if (!level) throw new Error(`Unknown level ${slug}`);
  return Object.fromEntries(
    level.files
      .filter((file) => file.access !== "hidden")
      .map((file) => [file.path, file.initialValue]),
  );
}

function expectConstraintFailure(slug: string, files: Record<string, string>, id: string): void {
  const level = getLevelBySlug(slug);
  if (!level) throw new Error(`Unknown level ${slug}`);
  const result = evaluateLevelConstraints(level, files).find(
    (candidate) => candidate.id === `constraint:${id}`,
  );
  expect(result, `${slug}/${id}`).toBeDefined();
  expect(result?.passed, `${slug}/${id}: ${result?.detail}`).toBe(false);
}

function mutatePath(
  root: Record<string, unknown>,
  path: string,
  replacement: unknown,
  remove = false,
): void {
  const segments = path.split(".");
  let current: unknown = root;
  for (const segment of segments.slice(0, -1)) {
    current = Array.isArray(current)
      ? current[Number(segment)]
      : (current as Record<string, unknown>)[segment];
  }
  const leaf = segments.at(-1)!;
  if (Array.isArray(current)) {
    if (remove) current.splice(Number(leaf), 1);
    else current[Number(leaf)] = replacement;
  } else if (remove) {
    delete (current as Record<string, unknown>)[leaf];
  } else {
    (current as Record<string, unknown>)[leaf] = replacement;
  }
}

describe("machine-enforced problem constraints", () => {
  it("accepts every canonical solution", () => {
    for (const level of LEVELS) {
      const solution = LEVEL_SOLUTIONS[level.slug];
      const results = evaluateLevelConstraints(level, {
        ...filesFor(level.slug),
        ...solution?.files,
      });
      expect(
        results.every((result) => result.passed),
        `${level.slug}: ${results
          .filter((result) => !result.passed)
          .map((result) => result.detail)
          .join(" | ")}`,
      ).toBe(true);
    }
  });

  it("rejects swapping the crash-looping worker for an unrelated healthy image", () => {
    const files = filesFor("pod-crashloop-mystery");
    files["deployment.yaml"] = files["deployment.yaml"]!.replace(
      "klab/worker:1.0.0",
      "klab/web-app:1.0.0",
    );
    expectConstraintFailure("pod-crashloop-mystery", files, "keep-image");
  });

  it("rejects deleting readiness or liveness probes", () => {
    const readiness = filesFor("broken-readiness-probe");
    readiness["pod.yaml"] = readiness["pod.yaml"]!.replace(
      /      readinessProbe:[\s\S]*?(?=      livenessProbe:)/,
      "",
    );
    expectConstraintFailure("broken-readiness-probe", readiness, "keep-image");

    const liveness = filesFor("liveness-probe-death-spiral");
    liveness["deployment.yaml"] = liveness["deployment.yaml"]!.replace(
      /          livenessProbe:[\s\S]*$/,
      "",
    );
    expectConstraintFailure("liveness-probe-death-spiral", liveness, "keep-liveness");
  });

  it("rejects bypassing DNS configuration by replacing the application image", () => {
    const files = filesFor("dns-resolution-failure");
    files["orders-api.yaml"] = files["orders-api.yaml"]!.replace(
      "klab/api:1.0.0",
      "klab/web-app:1.0.0",
    );
    expectConstraintFailure("dns-resolution-failure", files, "no-renames");
  });

  it("rejects extra resources and edits outside the declared editable file set", () => {
    const files = filesFor("service-selector-mismatch");
    files["service.yaml"] +=
      "\n---\napiVersion: v1\nkind: Pod\nmetadata:\n  name: helper\nspec:\n  containers:\n    - name: helper\n      image: klab/web-app:1.0.0\n";
    expectConstraintFailure("service-selector-mismatch", files, "keep-pods");

    const level = getLevelBySlug("service-selector-mismatch")!;
    const readonlyChanged = filesFor(level.slug);
    readonlyChanged["deployment.yaml"] += "\n# changed";
    expectConstraintFailure(level.slug, readonlyChanged, "edit-svc-only");
  });

  it("rejects three independent bypass classes for every authored level", () => {
    for (const level of LEVELS) {
      const constraint = level.constraints.find((candidate) => candidate.kind === "manifest");
      expect(constraint, `${level.slug} manifest constraint`).toBeDefined();
      if (!constraint || constraint.kind !== "manifest") continue;
      const canonical = { ...filesFor(level.slug), ...LEVEL_SOLUTIONS[level.slug]?.files };
      const parsed = parseManifests(canonical[constraint.file]!);
      expect(parsed.ok, `${level.slug} canonical parse`).toBe(true);
      if (!parsed.ok) continue;

      const renamed = structuredClone(parsed.value[0]!.raw);
      (renamed.metadata as Record<string, unknown>).name = `${constraint.resource.name}-bypass`;
      expectConstraintFailure(
        level.slug,
        { ...canonical, [constraint.file]: stringifyManifest(renamed) },
        constraint.id,
      );

      expectConstraintFailure(
        level.slug,
        {
          ...canonical,
          [constraint.file]: `${canonical[constraint.file]}\n---\napiVersion: v1\nkind: Pod\nmetadata:\n  name: helper\nspec:\n  containers:\n    - name: helper\n      image: klab/web-app:1.0.0\n`,
        },
        constraint.id,
      );

      const assertion = constraint.assertions[0]!;
      const mutated = structuredClone(parsed.value[0]!.raw);
      const replacement =
        assertion.operator === "gte"
          ? Number(assertion.value) - 1
          : assertion.operator === "lte"
            ? Number(assertion.value) + 1
            : assertion.operator === "equals"
              ? typeof assertion.value === "number"
                ? assertion.value + 1
                : typeof assertion.value === "boolean"
                  ? !assertion.value
                  : `${assertion.value}-bypass`
              : "__bypass__";
      mutatePath(mutated, assertion.path, replacement, assertion.operator === "present");
      expectConstraintFailure(
        level.slug,
        { ...canonical, [constraint.file]: stringifyManifest(mutated) },
        constraint.id,
      );
    }
  });
});
