import { describe, expect, it } from "vitest";

import { getLevelBySlug, LEVEL_CATALOG, LEVELS } from "@/content/levels";
import { LEVEL_SOLUTIONS } from "@/content/levels/solutions";
import { parseLevel } from "@/lib/domain/schemas";
import { evaluateLevelConstraints } from "@/lib/kube/manifest-constraints";
import { unsupportedProblemCapabilities } from "@/lib/kube/problem-capabilities";

const XP_BY_DIFFICULTY = { beginner: 100, intermediate: 150, advanced: 200 } as const;

describe("level content", () => {
  it("every authored level parses against the schema", () => {
    for (const level of LEVELS) {
      expect(() => parseLevel(level)).not.toThrow();
    }
  });

  it("has no duplicate catalog slugs", () => {
    const slugs = LEVEL_CATALOG.map((l) => l.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const titles = LEVEL_CATALOG.map((level) => level.title.toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("ships the exact sixty-problem curriculum with a real architecture track", () => {
    expect(LEVELS).toHaveLength(60);
    expect(LEVELS.filter((level) => level.challengeMode === "repair")).toHaveLength(51);
    expect(LEVELS.filter((level) => level.challengeMode === "build")).toHaveLength(9);
    expect(LEVELS.filter((level) => level.difficulty === "architect")).toHaveLength(9);
    expect(LEVELS.filter((level) => level.incidentSource).length).toBeGreaterThanOrEqual(12);
  });

  it("publishes versioned curriculum metadata with a valid prerequisite graph", () => {
    const slugs = new Set(LEVELS.map((level) => level.slug));
    const visit = (slug: string, path: string[]): void => {
      expect(path, `prerequisite cycle: ${[...path, slug].join(" -> ")}`).not.toContain(slug);
      const level = getLevelBySlug(slug)!;
      for (const prerequisite of level.prerequisites) visit(prerequisite, [...path, slug]);
    };

    for (const level of LEVELS) {
      expect(level.publicationStatus, level.slug).toBe("published");
      expect(level.contentVersion, level.slug).toBeGreaterThan(0);
      expect(level.learningObjectives.length, level.slug).toBeGreaterThanOrEqual(2);
      expect(new Set(level.learningPaths).size, level.slug).toBe(level.learningPaths.length);
      expect(new Set(level.capabilities).size, level.slug).toBe(level.capabilities.length);
      expect(level.kubernetesVersion).toEqual({ min: "1.34", max: "1.36", tested: "1.36" });

      for (const prerequisite of level.prerequisites) {
        expect(slugs.has(prerequisite), `${level.slug} prerequisite ${prerequisite}`).toBe(true);
        expect(prerequisite, level.slug).not.toBe(level.slug);
      }
      for (const next of level.postSolveExplanation.recommendedNextSlugs) {
        expect(slugs.has(next), `${level.slug} next ${next}`).toBe(true);
        expect(next, level.slug).not.toBe(level.slug);
      }
      expect(unsupportedProblemCapabilities(level), `${level.slug} engine capabilities`).toEqual(
        [],
      );
      if (level.incidentSource) {
        expect(level.incidentSource.href, level.slug).toMatch(/^https:\/\//);
        expect(level.incidentSource.attribution, level.slug).toBe("inspired-by");
        expect(level.incidentSource.adaptationNote.length, level.slug).toBeGreaterThanOrEqual(80);
        expect(level.incidentSource.adaptationNote, level.slug).toMatch(
          /not an exact reproduction/i,
        );
      }
      visit(level.slug, []);
    }
  });

  it("keeps recommendations acyclic", () => {
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (slug: string): void => {
      if (visited.has(slug)) return;
      expect(visiting.has(slug), `recommendation cycle at ${slug}`).toBe(false);
      visiting.add(slug);
      for (const next of getLevelBySlug(slug)?.postSolveExplanation.recommendedNextSlugs ?? []) {
        visit(next);
      }
      visiting.delete(slug);
      visited.add(slug);
    };
    for (const level of LEVELS) visit(level.slug);
  });

  it("keeps Architect final bosses distinct from repair problems", () => {
    for (const level of LEVELS) {
      if (level.challengeMode === "repair") {
        expect(level.difficulty, level.slug).not.toBe("architect");
        continue;
      }

      expect(level.difficulty, level.slug).toBe("architect");
      expect(level.xp, level.slug).toBe(500);
      expect(level.learningPaths, level.slug).toContain("platform-architect");
      expect(level.prerequisites.length, level.slug).toBeGreaterThanOrEqual(3);
      expect(
        level.files.filter((file) => file.access === "editable").length,
        level.slug,
      ).toBeGreaterThanOrEqual(4);
    }
  });

  it("every catalog entry is a playable authored level", () => {
    expect(LEVEL_CATALOG).toHaveLength(60);
    for (const entry of LEVEL_CATALOG) {
      expect(getLevelBySlug(entry.slug), entry.slug).toBeDefined();
    }
  });

  it("covers the Kubernetes production domains missing from the original bank", () => {
    const covered = new Set(LEVELS.flatMap((level) => level.concepts));
    for (const concept of [
      "statefulsets",
      "daemonsets",
      "jobs",
      "cronjobs",
      "ingress",
      "gateway-api",
      "owners-gc",
      "init-containers",
      "resource-quotas",
      "limit-ranges",
      "configmaps",
      "storage",
      "service-accounts",
      "rbac",
      "security-contexts",
      "network-policies",
      "autoscaling",
      "crds",
      "operators",
      "admission-controllers",
      "reconciliation",
    ] as const) {
      expect(covered.has(concept), `${concept} coverage`).toBe(true);
    }
  });

  it("covers every difficulty tier with consistent XP", () => {
    for (const difficulty of ["beginner", "intermediate", "advanced"] as const) {
      const tier = LEVELS.filter((l) => l.difficulty === difficulty);
      expect(tier.length, `${difficulty} levels`).toBeGreaterThanOrEqual(4);
      for (const level of tier) {
        expect(level.xp, `${level.slug} xp`).toBe(XP_BY_DIFFICULTY[difficulty]);
      }
    }
  });

  it("every level has a canonical solution whose files match the editable files", () => {
    for (const level of LEVELS) {
      const solution = LEVEL_SOLUTIONS[level.slug];
      expect(solution, `${level.slug} solution`).toBeDefined();
      const editablePaths = new Set(
        level.files.filter((file) => file.access === "editable").map((file) => file.path),
      );
      expect(Object.keys(solution!.files).sort(), `${level.slug} solution file set`).toEqual(
        [...editablePaths].sort(),
      );
      for (const path of Object.keys(solution!.files)) {
        expect(editablePaths.has(path), `${level.slug}: ${path} is editable`).toBe(true);
      }
    }
  });

  it("every level ships investigation affordances (quick commands, probe targets, hints)", () => {
    for (const level of LEVELS) {
      expect(level.quickCommands.length, `${level.slug} quickCommands`).toBeGreaterThan(0);
      expect(level.probeTargets.length, `${level.slug} probeTargets`).toBeGreaterThan(0);
      expect(level.hints.length, `${level.slug} hints`).toBeGreaterThanOrEqual(3);
      expect(level.evidenceRules.length, `${level.slug} evidenceRules`).toBeGreaterThanOrEqual(4);
      const totalPenalty = level.hints.reduce((sum, h) => sum + h.xpPenalty, 0);
      expect(totalPenalty, `${level.slug} hint penalties exceed level XP`).toBeLessThanOrEqual(
        level.xp,
      );
    }
  });

  it("hint unlock references point at real evidence rules", () => {
    for (const level of LEVELS) {
      const ruleIds = new Set(level.evidenceRules.map((r) => r.id));
      for (const hint of level.hints) {
        for (const ruleId of hint.unlockAfter ?? []) {
          expect(ruleIds.has(ruleId)).toBe(true);
        }
      }
    }
  });

  it("enforces the replacement workspace, constraint, command, and evidence contracts", () => {
    const sourceTrigger = {
      terminal: "command",
      logs: "log",
      events: "event-reason",
      network: "probe",
      topology: "topology-view",
      "object-explorer": "object-view",
      validator: "validator",
    } as const;
    const catalogSources = new Set<string>();

    for (const level of LEVELS) {
      expect(level.engine.kind, `${level.slug} engine`).toBeDefined();
      const paths = level.files.map((file) => file.path);
      expect(new Set(paths).size, `${level.slug} duplicate file path`).toBe(paths.length);
      expect(
        level.files.some((file) => file.access === "editable"),
        `${level.slug} editable file`,
      ).toBe(true);

      const editablePaths = level.files
        .filter((file) => file.access === "editable")
        .map((file) => file.path)
        .sort();
      const accessRules = level.constraints.filter(
        (constraint) => constraint.kind === "editable-files",
      );
      expect(accessRules.length, `${level.slug} editable-files constraint`).toBe(1);
      expect(
        accessRules[0]?.kind === "editable-files" ? [...accessRules[0].paths].sort() : [],
      ).toEqual(editablePaths);
      for (const constraint of level.constraints) {
        if (constraint.kind === "manifest") {
          expect(paths, `${level.slug}/${constraint.id} file`).toContain(constraint.file);
        }
      }

      const commandIds = level.quickCommands.map((command) => command.id);
      expect(new Set(commandIds).size, `${level.slug} duplicate quick command id`).toBe(
        commandIds.length,
      );
      for (const command of level.quickCommands) {
        if (command.command.includes("<pod>")) {
          expect(command.target, `${level.slug}/${command.id} target`).toBeDefined();
          expect(Object.keys(command.target?.selector ?? {}).length).toBeGreaterThan(0);
        }
      }

      const ruleIds = level.evidenceRules.map((rule) => rule.id);
      expect(new Set(ruleIds).size, `${level.slug} duplicate evidence rule id`).toBe(
        ruleIds.length,
      );
      for (const rule of level.evidenceRules) {
        catalogSources.add(rule.source);
        expect(
          rule.trigger.type,
          `${level.slug}/${rule.id}: ${rule.source} must use its structured trigger`,
        ).toBe(sourceTrigger[rule.source]);
        const trigger = rule.trigger;
        if (trigger.type === "command") {
          expect(
            () => new RegExp(trigger.commandMatches),
            `${level.slug}/${rule.id}`,
          ).not.toThrow();
          const outputMatches = trigger.outputMatches;
          if (outputMatches) {
            expect(() => new RegExp(outputMatches), `${level.slug}/${rule.id}`).not.toThrow();
          }
        }
      }

      for (const ids of [
        level.validators.map((item) => item.id),
        level.constraints.map((item) => item.id),
        level.hints.map((item) => item.id),
        level.bootSequence?.map((item) => item.id) ?? [],
      ]) {
        expect(new Set(ids).size, `${level.slug} duplicate authored ids`).toBe(ids.length);
      }

      if (level.engine.kind === "scripted" && level.engine.scenarioId === "manifest-assessment") {
        const initial = Object.fromEntries(
          level.files
            .filter((file) => file.access !== "hidden")
            .map((file) => [file.path, file.initialValue]),
        );
        const manifestRules = level.constraints.filter((rule) => rule.kind === "manifest");
        expect(manifestRules.length, `${level.slug} assessment rules`).toBeGreaterThan(0);
        expect(
          evaluateLevelConstraints(level, initial).some((result) => !result.passed),
          `${level.slug} starts with a real policy failure`,
        ).toBe(true);
        if (level.challengeMode === "repair") {
          expect(level.referenceCommands?.length, `${level.slug} production runbook`).toBe(4);
          expect(
            new Set(level.referenceCommands ?? []).size,
            `${level.slug} runbook commands`,
          ).toBe(4);
        }
        if (level.challengeMode === "build") {
          expect(level.postSolveExplanation.docsHref, `${level.slug} lesson link`).not.toMatch(
            /^\/learn\//,
          );
        }
      }
    }

    for (const source of ["terminal", "logs", "events", "network", "topology", "object-explorer"]) {
      expect(catalogSources.has(source), `${source} evidence coverage`).toBe(true);
    }
  });

  it("the reference level is playable and models the readiness bug", () => {
    const level = getLevelBySlug("broken-readiness-probe");
    expect(level).toBeDefined();
    expect(level?.files[0]?.initialValue).toContain("/readyz");
    expect(level?.validators.some((v) => v.kind === "service-has-ready-endpoints")).toBe(true);
  });
});
