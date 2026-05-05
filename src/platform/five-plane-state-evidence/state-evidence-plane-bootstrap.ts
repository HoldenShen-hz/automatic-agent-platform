import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import {
  listStateEvidenceCapabilityBaselines,
  type StateEvidenceCapabilityBaseline,
} from "./state-evidence-plane-baseline.js";
export type { StateEvidenceCapabilityBaseline } from "./state-evidence-plane-baseline.js";

export const STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID = "plane.state-evidence.catalog";
export const STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID = "plane.state-evidence.bootstrap";

export interface StateEvidencePlaneBootstrap {
  readonly planeId: "state-evidence";
  readonly catalog: readonly StateEvidenceCapabilityBaseline[];
  readonly registeredServiceIds: readonly [typeof STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID, typeof STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID];
}

export function buildStateEvidencePlaneBootstrap(): StateEvidencePlaneBootstrap {
  return {
    planeId: "state-evidence",
    catalog: listStateEvidenceCapabilityBaselines(),
    registeredServiceIds: [STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID, STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID],
  };
}

export function registerStateEvidencePlaneBootstrap(
  registry: ServiceRegistry = ServiceRegistry.createScoped(),
): StateEvidencePlaneBootstrap {
  registry.register<readonly StateEvidenceCapabilityBaseline[]>(STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID, {
    init: () => listStateEvidenceCapabilityBaselines(),
  });
  registry.register<StateEvidencePlaneBootstrap>(STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID, {
    init: () => buildStateEvidencePlaneBootstrap(),
    dependsOn: [STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID],
  });

  return registry.get<StateEvidencePlaneBootstrap>(STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID);
}
