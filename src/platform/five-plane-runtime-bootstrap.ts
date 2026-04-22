import { ServiceRegistry } from "./shared/lifecycle/service-registry.js";
import {
  buildControlPlaneBootstrap,
  registerControlPlaneBootstrap,
  CONTROL_PLANE_BOOTSTRAP_SERVICE_ID,
  type ControlPlaneBootstrap,
  type ControlPlaneCapabilityBaseline,
} from "./control-plane/control-plane-bootstrap.js";
import {
  buildExecutionPlaneBootstrap,
  registerExecutionPlaneBootstrap,
  EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID,
  type ExecutionPlaneBootstrap,
  type ExecutionCapabilityBaseline,
} from "./execution/execution-plane-bootstrap.js";
import {
  buildInterfacePlaneBootstrap,
  registerInterfacePlaneBootstrap,
  INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID,
  type InterfacePlaneBootstrap,
  type InterfaceCapabilityBaseline,
} from "./interface/interface-plane-bootstrap.js";
import {
  buildOrchestrationPlaneBootstrap,
  registerOrchestrationPlaneBootstrap,
  ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID,
  type OrchestrationPlaneBootstrap,
  type OrchestrationCapabilityBaseline,
} from "./orchestration/orchestration-plane-bootstrap.js";
import {
  buildStateEvidencePlaneBootstrap,
  registerStateEvidencePlaneBootstrap,
  STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID,
  type StateEvidencePlaneBootstrap,
  type StateEvidenceCapabilityBaseline,
} from "./state-evidence/state-evidence-plane-bootstrap.js";

export const FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID = "plane.runtime.catalog";

export interface FivePlaneRuntimeCatalog {
  readonly interfacePlane: readonly InterfaceCapabilityBaseline[];
  readonly controlPlane: readonly ControlPlaneCapabilityBaseline[];
  readonly orchestrationPlane: readonly OrchestrationCapabilityBaseline[];
  readonly executionPlane: readonly ExecutionCapabilityBaseline[];
  readonly stateEvidencePlane: readonly StateEvidenceCapabilityBaseline[];
}

export function buildFivePlaneRuntimeCatalog(): FivePlaneRuntimeCatalog {
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

export function registerFivePlaneRuntimeCatalog(registry: ServiceRegistry = ServiceRegistry.getInstance()): FivePlaneRuntimeCatalog {
  registerInterfacePlaneBootstrap(registry);
  registerControlPlaneBootstrap(registry);
  registerOrchestrationPlaneBootstrap(registry);
  registerExecutionPlaneBootstrap(registry);
  registerStateEvidencePlaneBootstrap(registry);

  registry.register<FivePlaneRuntimeCatalog>(FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID, {
    init: () => {
      const interfacePlane = registry.get<InterfacePlaneBootstrap>(INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID).catalog;
      const controlPlane = registry.get<ControlPlaneBootstrap>(CONTROL_PLANE_BOOTSTRAP_SERVICE_ID).catalog;
      const orchestrationPlane = registry.get<OrchestrationPlaneBootstrap>(ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID).catalog;
      const executionPlane = registry.get<ExecutionPlaneBootstrap>(EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID).catalog;
      const stateEvidencePlane = registry.get<StateEvidencePlaneBootstrap>(STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID).catalog;
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

  return registry.get<FivePlaneRuntimeCatalog>(FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID);
}
