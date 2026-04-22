import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import {
  listExecutionCapabilityBaselines,
  type ExecutionCapabilityBaseline,
} from "./execution-plane-baseline.js";
export type { ExecutionCapabilityBaseline } from "./execution-plane-baseline.js";

export const EXECUTION_PLANE_CATALOG_SERVICE_ID = "plane.execution.catalog";
export const EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID = "plane.execution.bootstrap";

export interface ExecutionPlaneBootstrap {
  readonly planeId: "execution";
  readonly catalog: readonly ExecutionCapabilityBaseline[];
  readonly registeredServiceIds: readonly [typeof EXECUTION_PLANE_CATALOG_SERVICE_ID, typeof EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID];
}

export function buildExecutionPlaneBootstrap(): ExecutionPlaneBootstrap {
  return {
    planeId: "execution",
    catalog: listExecutionCapabilityBaselines(),
    registeredServiceIds: [EXECUTION_PLANE_CATALOG_SERVICE_ID, EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID],
  };
}

export function registerExecutionPlaneBootstrap(
  registry: ServiceRegistry = ServiceRegistry.getInstance(),
): ExecutionPlaneBootstrap {
  registry.register<readonly ExecutionCapabilityBaseline[]>(EXECUTION_PLANE_CATALOG_SERVICE_ID, {
    init: () => listExecutionCapabilityBaselines(),
  });
  registry.register<ExecutionPlaneBootstrap>(EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID, {
    init: () => buildExecutionPlaneBootstrap(),
    dependsOn: [EXECUTION_PLANE_CATALOG_SERVICE_ID],
  });

  return registry.get<ExecutionPlaneBootstrap>(EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID);
}
