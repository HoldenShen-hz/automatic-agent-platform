import { ServiceRegistry } from "./shared/lifecycle/service-registry.js";
import {
  buildComplianceBootstrap,
  registerComplianceBootstrap,
  COMPLIANCE_BOOTSTRAP_SERVICE_ID,
} from "./compliance/compliance-bootstrap.js";
import {
  buildControlPlaneBootstrap,
  registerControlPlaneBootstrap,
  CONTROL_PLANE_BOOTSTRAP_SERVICE_ID,
  type ControlPlaneBootstrap,
  type ControlPlaneCapabilityBaseline,
} from "./five-plane-control-plane/control-plane-bootstrap.js";
import {
  buildExecutionPlaneBootstrap,
  registerExecutionPlaneBootstrap,
  EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID,
  type ExecutionPlaneBootstrap,
  type ExecutionCapabilityBaseline,
} from "./five-plane-execution/execution-plane-bootstrap.js";
import {
  buildInterfacePlaneBootstrap,
  registerInterfacePlaneBootstrap,
  INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID,
  type InterfacePlaneBootstrap,
  type InterfaceCapabilityBaseline,
} from "./five-plane-interface/interface-plane-bootstrap.js";
import {
  buildModelGatewayBootstrap,
  registerModelGatewayBootstrap,
  MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID,
} from "./model-gateway/model-gateway-bootstrap.js";
import {
  buildOrchestrationPlaneBootstrap,
  registerOrchestrationPlaneBootstrap,
  ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID,
  type OrchestrationPlaneBootstrap,
  type OrchestrationCapabilityBaseline,
} from "./five-plane-orchestration/orchestration-plane-bootstrap.js";
import {
  buildPromptEngineBootstrap,
  registerPromptEngineBootstrap,
  PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID,
} from "./prompt-engine/prompt-engine-bootstrap.js";
import {
  buildStateEvidencePlaneBootstrap,
  registerStateEvidencePlaneBootstrap,
  STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID,
  type StateEvidencePlaneBootstrap,
  type StateEvidenceCapabilityBaseline,
} from "./five-plane-state-evidence/state-evidence-plane-bootstrap.js";

export const FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID = "plane.runtime.catalog";
export const X1_FABRIC_BOOTSTRAP_SERVICE_ID = "plane.x1-fabric.bootstrap";

const FIVE_PLANE_BOOTSTRAP_SERVICE_IDS = [
  INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID,
  CONTROL_PLANE_BOOTSTRAP_SERVICE_ID,
  ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID,
  EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID,
  STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID,
] as const;

export interface X1FabricBootstrap {
  readonly capabilityGroupId: "x1-fabric";
  readonly capabilityCount: number;
  readonly registeredServiceIds: readonly [
    typeof MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID,
    typeof PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID,
    typeof COMPLIANCE_BOOTSTRAP_SERVICE_ID,
    typeof X1_FABRIC_BOOTSTRAP_SERVICE_ID,
  ];
}

export interface FivePlaneRuntimeCatalog {
  readonly interfacePlane: readonly InterfaceCapabilityBaseline[];
  readonly controlPlane: readonly ControlPlaneCapabilityBaseline[];
  readonly orchestrationPlane: readonly OrchestrationCapabilityBaseline[];
  readonly executionPlane: readonly ExecutionCapabilityBaseline[];
  readonly stateEvidencePlane: readonly StateEvidenceCapabilityBaseline[];
}

export interface BootstrapHealthCheck {
  readonly healthy: boolean;
  readonly failedServices: string[];
  readonly errors: string[];
  readonly checkedAt: string;
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

export function buildX1FabricBootstrap(): X1FabricBootstrap {
  return {
    capabilityGroupId: "x1-fabric",
    capabilityCount:
      buildModelGatewayBootstrap().catalog.length
      + buildPromptEngineBootstrap().catalog.length
      + buildComplianceBootstrap().catalog.length,
    registeredServiceIds: [
      MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID,
      PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID,
      COMPLIANCE_BOOTSTRAP_SERVICE_ID,
      X1_FABRIC_BOOTSTRAP_SERVICE_ID,
    ],
  };
}

export function performBootstrapHealthCheck(
  registry: ServiceRegistry = ServiceRegistry.createScoped(),
): BootstrapHealthCheck {
  const failedServices = FIVE_PLANE_BOOTSTRAP_SERVICE_IDS.filter((serviceId) => !registry.isInitialized(serviceId));
  return {
    healthy: failedServices.length === 0,
    failedServices: [...failedServices],
    errors: failedServices.map((serviceId) => `service_not_initialized:${serviceId}`),
    checkedAt: new Date().toISOString(),
  };
}

export function registerX1FabricBootstrap(
  registry: ServiceRegistry = ServiceRegistry.createScoped(),
): X1FabricBootstrap {
  registerModelGatewayBootstrap(registry);
  registerPromptEngineBootstrap(registry);
  registerComplianceBootstrap(registry);
  registry.register<X1FabricBootstrap>(X1_FABRIC_BOOTSTRAP_SERVICE_ID, {
    init: () => buildX1FabricBootstrap(),
    dependsOn: [
      MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID,
      PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID,
      COMPLIANCE_BOOTSTRAP_SERVICE_ID,
    ],
  });
  return registry.get<X1FabricBootstrap>(X1_FABRIC_BOOTSTRAP_SERVICE_ID);
}

export function registerFivePlaneRuntimeCatalog(registry: ServiceRegistry = ServiceRegistry.createScoped()): FivePlaneRuntimeCatalog {
  registerInterfacePlaneBootstrap(registry);
  registerX1FabricBootstrap(registry);
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
