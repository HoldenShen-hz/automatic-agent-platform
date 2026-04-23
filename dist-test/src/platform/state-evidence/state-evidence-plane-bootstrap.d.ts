import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import { type StateEvidenceCapabilityBaseline } from "./state-evidence-plane-baseline.js";
export type { StateEvidenceCapabilityBaseline } from "./state-evidence-plane-baseline.js";
export declare const STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID = "plane.state-evidence.catalog";
export declare const STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID = "plane.state-evidence.bootstrap";
export interface StateEvidencePlaneBootstrap {
    readonly planeId: "state-evidence";
    readonly catalog: readonly StateEvidenceCapabilityBaseline[];
    readonly registeredServiceIds: readonly [typeof STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID, typeof STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID];
}
export declare function buildStateEvidencePlaneBootstrap(): StateEvidencePlaneBootstrap;
export declare function registerStateEvidencePlaneBootstrap(registry?: ServiceRegistry): StateEvidencePlaneBootstrap;
