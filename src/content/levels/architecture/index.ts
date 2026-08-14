import type { ProblemLevel } from "@/lib/domain/types";

import { buildThreeZoneApi } from "./build-three-zone-api";
import { buildDefaultDenyServiceGraph } from "./build-default-deny-service-graph";
import { buildMultiTeamGateway } from "./build-multi-team-gateway";
import { buildRecoverableStatefulDataPlane } from "./build-recoverable-stateful-data-plane";
import { buildHardenedAdminWorkload } from "./build-hardened-admin-workload";
import { buildFlashSaleScalingSystem } from "./build-flash-sale-scaling-system";
import { buildIncidentSurvivableObservability } from "./build-incident-survivable-observability";
import { buildTwoTeamPlatform } from "./build-two-team-platform";
import { buildSignedPromotionPipeline } from "./build-signed-promotion-pipeline";
import { buildLevel, type ArchitectureBuildSpec } from "./spec";

/**
 * The Architect track: nine reference architectures, one file each. They used to
 * share a single 3,900-line module, which made reviewing one design mean scrolling
 * past eight others.
 */
const BUILD_SPECS: readonly ArchitectureBuildSpec[] = [
  buildThreeZoneApi,
  buildDefaultDenyServiceGraph,
  buildMultiTeamGateway,
  buildRecoverableStatefulDataPlane,
  buildHardenedAdminWorkload,
  buildFlashSaleScalingSystem,
  buildIncidentSurvivableObservability,
  buildTwoTeamPlatform,
  buildSignedPromotionPipeline,
];

export const ARCHITECTURE_BUILD_LEVELS: ProblemLevel[] = BUILD_SPECS.map(buildLevel);

export const ARCHITECTURE_BUILD_SOLUTIONS: Record<
  string,
  Record<string, string>
> = Object.fromEntries(
  BUILD_SPECS.map((spec) => [
    spec.id,
    Object.fromEntries(spec.files.map((file) => [file.path, file.solution])),
  ]),
);
