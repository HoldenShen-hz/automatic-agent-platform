import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import {
  listStateEvidenceCapabilityBaselines,
  type StateEvidenceCapabilityBaseline,
} from "./state-evidence-plane-baseline.js";
export type { StateEvidenceCapabilityBaseline } from "./state-evidence-plane-baseline.js";
import { RuntimeTruthRepository, type RuntimeRepository } from "./truth/runtime-truth-repository.js";

export const STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID = "plane.state-evidence.catalog";
export const STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID = "plane.state-evidence.bootstrap";
// R4-33/R4-35: Bootstrap-level service ID for RuntimeTruthRepository - previously created per-orchestration-run
export const RUNTIME_TRUTH_REPOSITORY_SERVICE_ID = "plane.state-evidence.runtime-truth-repository";

export interface StateEvidencePlaneBootstrap {
  readonly planeId: "state-evidence";
  readonly catalog: readonly StateEvidenceCapabilityBaseline[];
  readonly registeredServiceIds: readonly [
    typeof STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID,
    typeof STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID,
    typeof RUNTIME_TRUTH_REPOSITORY_SERVICE_ID,
  ];
}

export function buildStateEvidencePlaneBootstrap(): StateEvidencePlaneBootstrap {
  return {
    planeId: "state-evidence",
    catalog: listStateEvidenceCapabilityBaselines(),
    registeredServiceIds: [STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID, STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID, RUNTIME_TRUTH_REPOSITORY_SERVICE_ID],
  };
}

export function registerStateEvidencePlaneBootstrap(
  registry: ServiceRegistry = ServiceRegistry.createScoped(),
): StateEvidencePlaneBootstrap {
  registry.register<readonly StateEvidenceCapabilityBaseline[]>(STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID, {
    init: () => listStateEvidenceCapabilityBaselines(),
  });
  // R4-33/R4-35: Register RuntimeTruthRepository as a singleton bootstrap service
  // Previously this was created per-orchestration-run in multi-step-orchestration.ts:255
  registry.register<RuntimeRepository>(RUNTIME_TRUTH_REPOSITORY_SERVICE_ID, {
    init: () => new RuntimeTruthRepository(),
    dependsOn: [STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID],
  });
  registry.register<StateEvidencePlaneBootstrap>(STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID, {
    init: () => buildStateEvidencePlaneBootstrap(),
    dependsOn: [STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID, RUNTIME_TRUTH_REPOSITORY_SERVICE_ID],
  });

  return registry.get<StateEvidencePlaneBootstrap>(STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID);
}

/**
 * Gets the RuntimeTruthRepository from the service registry.
 * R4-33/R4-35: Use this instead of creating RuntimeTruthRepository per-orchestration-run.
 */
export function getRuntimeTruthRepository(registry: ServiceRegistry): RuntimeRepository {
  return registry.get<RuntimeRepository>(RUNTIME_TRUTH_REPOSITORY_SERVICE_ID);
}
