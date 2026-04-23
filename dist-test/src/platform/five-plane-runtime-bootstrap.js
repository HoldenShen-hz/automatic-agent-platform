import { ServiceRegistry } from "./shared/lifecycle/service-registry.js";
import { buildControlPlaneBootstrap, registerControlPlaneBootstrap, CONTROL_PLANE_BOOTSTRAP_SERVICE_ID, } from "./control-plane/control-plane-bootstrap.js";
import { buildExecutionPlaneBootstrap, registerExecutionPlaneBootstrap, EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID, } from "./execution/execution-plane-bootstrap.js";
import { buildInterfacePlaneBootstrap, registerInterfacePlaneBootstrap, INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID, } from "./interface/interface-plane-bootstrap.js";
import { buildOrchestrationPlaneBootstrap, registerOrchestrationPlaneBootstrap, ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID, } from "./orchestration/orchestration-plane-bootstrap.js";
import { buildStateEvidencePlaneBootstrap, registerStateEvidencePlaneBootstrap, STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID, } from "./state-evidence/state-evidence-plane-bootstrap.js";
export const FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID = "plane.runtime.catalog";
export function buildFivePlaneRuntimeCatalog() {
    const interfacePlane = buildInterfacePlaneBootstrap().catalog;
    const controlPlane = buildControlPlaneBootstrap().catalog;
    const orchestrationPlane = buildOrchestrationPlaneBootstrap().catalog;
    const executionPlane = buildExecutionPlaneBootstrap().catalog;
    const stateEvidencePlane = buildStateEvidencePlaneBootstrap().catalog;
    return {
        interfacePlane,
        controlPlane,
        orchestrationPlane,
        executionPlane,
        stateEvidencePlane,
    };
}
export function registerFivePlaneRuntimeCatalog(registry = ServiceRegistry.getInstance()) {
    registerInterfacePlaneBootstrap(registry);
    registerControlPlaneBootstrap(registry);
    registerOrchestrationPlaneBootstrap(registry);
    registerExecutionPlaneBootstrap(registry);
    registerStateEvidencePlaneBootstrap(registry);
    registry.register(FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID, {
        init: () => {
            const interfacePlane = registry.get(INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID).catalog;
            const controlPlane = registry.get(CONTROL_PLANE_BOOTSTRAP_SERVICE_ID).catalog;
            const orchestrationPlane = registry.get(ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID).catalog;
            const executionPlane = registry.get(EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID).catalog;
            const stateEvidencePlane = registry.get(STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID).catalog;
            return {
                interfacePlane,
                controlPlane,
                orchestrationPlane,
                executionPlane,
                stateEvidencePlane,
            };
        },
        dependsOn: [
            INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID,
            CONTROL_PLANE_BOOTSTRAP_SERVICE_ID,
            ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID,
            EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID,
            STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID,
        ],
    });
    return registry.get(FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID);
}
//# sourceMappingURL=five-plane-runtime-bootstrap.js.map