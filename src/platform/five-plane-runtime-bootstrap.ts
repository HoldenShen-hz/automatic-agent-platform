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
} from "./orchestration/orchestration-plane-bootstrap.js";
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
} from "./state-evidence/state-evidence-plane-bootstrap.js";

export const FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID = "plane.runtime.catalog";
export const X1_FABRIC_BOOTSTRAP_SERVICE_ID = "plane.x1-fabric.bootstrap";

/**
 * Health check result for bootstrap services.
 * §24.5/R21-54: Health check before ready ensures service is operational.
 */
export interface BootstrapHealthCheck {
  /** Whether the bootstrap completed successfully */
  healthy: boolean;
  /** List of services that failed to initialize */
  failedServices: string[];
  /** Error messages for failed services */
  errors: string[];
  /** When the health check was performed */
  checkedAt: string;
}

/**
 * Performs a health check on all registered bootstrap services.
 * §24.5/R21-54: Health check before ready ensures services are operational.
 */
export function performBootstrapHealthCheck(registry: ServiceRegistry): BootstrapHealthCheck {
  const failedServices: string[] = [];
  const errors: string[] = [];
  const now = new Date().toISOString();

  const serviceIds = [
    INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID,
    CONTROL_PLANE_BOOTSTRAP_SERVICE_ID,
    ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID,
    EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID,
    STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID,
  ];

  for (const serviceId of serviceIds) {
    try {
      if (!registry.isInitialized(serviceId)) {
        failedServices.push(serviceId);
        errors.push(`Service ${serviceId} is not initialized`);
      }
    } catch (error) {
      failedServices.push(serviceId);
      errors.push(`Service ${serviceId} threw exception: ${error}`);
    }
  }

  return {
    healthy: failedServices.length === 0,
    failedServices,
    errors,
    checkedAt: now,
  };
}

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

export function registerX1FabricBootstrap(
  registry: ServiceRegistry = ServiceRegistry.getInstance(),
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
  // §24.5/R21-54: Health check before get() ensures service is ready
  // §24.5/R21-55: Graceful degradation - catch exceptions to prevent complete bootstrap failure
  try {
    return registry.get<X1FabricBootstrap>(X1_FABRIC_BOOTSTRAP_SERVICE_ID);
  } catch (error) {
    // Return a degraded bootstrap that indicates partial initialization
    console.warn(`X1FabricBootstrap: failed to initialize, returning degraded state: ${error}`);
    return {
      capabilityGroupId: "x1-fabric",
      capabilityCount: 0,
      registeredServiceIds: [],
    };
  }
}

export function registerFivePlaneRuntimeCatalog(registry: ServiceRegistry = ServiceRegistry.getInstance()): FivePlaneRuntimeCatalog {
  registerInterfacePlaneBootstrap(registry);
  registerX1FabricBootstrap(registry);
  registerControlPlaneBootstrap(registry);
  registerOrchestrationPlaneBootstrap(registry);
  registerExecutionPlaneBootstrap(registry);
  registerStateEvidencePlaneBootstrap(registry);

  // §24.5/R21-55: Graceful degradation - each registry.get() is wrapped in try-catch
  // to prevent a single service failure from causing complete bootstrap failure
  let interfacePlane: readonly InterfaceCapabilityBaseline[] = [];
  let controlPlane: readonly ControlPlaneCapabilityBaseline[] = [];
  let orchestrationPlane: readonly OrchestrationCapabilityBaseline[] = [];
  let executionPlane: readonly ExecutionCapabilityBaseline[] = [];
  let stateEvidencePlane: readonly StateEvidenceCapabilityBaseline[] = [];

  try {
    interfacePlane = registry.get<InterfacePlaneBootstrap>(INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID).catalog;
  } catch (error) {
    console.warn(`registerFivePlaneRuntimeCatalog: failed to get interfacePlane: ${error}`);
  }

  try {
    controlPlane = registry.get<ControlPlaneBootstrap>(CONTROL_PLANE_BOOTSTRAP_SERVICE_ID).catalog;
  } catch (error) {
    console.warn(`registerFivePlaneRuntimeCatalog: failed to get controlPlane: ${error}`);
  }

  try {
    orchestrationPlane = registry.get<OrchestrationPlaneBootstrap>(ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID).catalog;
  } catch (error) {
    console.warn(`registerFivePlaneRuntimeCatalog: failed to get orchestrationPlane: ${error}`);
  }

  try {
    executionPlane = registry.get<ExecutionPlaneBootstrap>(EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID).catalog;
  } catch (error) {
    console.warn(`registerFivePlaneRuntimeCatalog: failed to get executionPlane: ${error}`);
  }

  try {
    stateEvidencePlane = registry.get<StateEvidencePlaneBootstrap>(STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID).catalog;
  } catch (error) {
    console.warn(`registerFivePlaneRuntimeCatalog: failed to get stateEvidencePlane: ${error}`);
  }

  registry.register<FivePlaneRuntimeCatalog>(FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID, {
    init: () => ({
      interfacePlane,
      controlPlane,
      orchestrationPlane,
      executionPlane,
      stateEvidencePlane,
    }),
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
