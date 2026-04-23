import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import { listStateEvidenceCapabilityBaselines, } from "./state-evidence-plane-baseline.js";
export const STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID = "plane.state-evidence.catalog";
export const STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID = "plane.state-evidence.bootstrap";
export function buildStateEvidencePlaneBootstrap() {
    return {
        planeId: "state-evidence",
        catalog: listStateEvidenceCapabilityBaselines(),
        registeredServiceIds: [STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID, STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID],
    };
}
export function registerStateEvidencePlaneBootstrap(registry = ServiceRegistry.getInstance()) {
    registry.register(STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID, {
        init: () => listStateEvidenceCapabilityBaselines(),
    });
    registry.register(STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID, {
        init: () => buildStateEvidencePlaneBootstrap(),
        dependsOn: [STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID],
    });
    return registry.get(STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID);
}
//# sourceMappingURL=state-evidence-plane-bootstrap.js.map