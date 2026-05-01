import { ServiceRegistry } from "../../shared/lifecycle/service-registry.js";
import {
  listHarnessCapabilityBaselines,
  type HarnessCapabilityBaseline,
} from "./harness-baseline.js";

export type { HarnessCapabilityBaseline } from "./harness-baseline.js";

export const HARNESS_CATALOG_SERVICE_ID = "aiops.harness.catalog";
export const HARNESS_BOOTSTRAP_SERVICE_ID = "aiops.harness.bootstrap";
// §174-2024: NodeRuntime, SideEffectMgr, Evaluator, GraphScheduler are required
// for harness bootstrap - previously missing from registeredServiceIds
export const HARNESS_NODE_RUNTIME_SERVICE_ID = "aiops.harness.node_runtime";
export const HARNESS_SIDE_EFFECT_MGR_SERVICE_ID = "aiops.harness.side_effect_mgr";
export const HARNESS_EVALUATOR_SERVICE_ID = "aiops.harness.evaluator";
export const HARNESS_GRAPH_SCHEDULER_SERVICE_ID = "aiops.harness.graph_scheduler";

export interface HarnessBootstrap {
  readonly capabilityGroupId: "harness";
  readonly catalog: readonly HarnessCapabilityBaseline[];
  readonly registeredServiceIds: readonly [
    typeof HARNESS_CATALOG_SERVICE_ID,
    typeof HARNESS_BOOTSTRAP_SERVICE_ID,
    typeof HARNESS_NODE_RUNTIME_SERVICE_ID,
    typeof HARNESS_SIDE_EFFECT_MGR_SERVICE_ID,
    typeof HARNESS_EVALUATOR_SERVICE_ID,
    typeof HARNESS_GRAPH_SCHEDULER_SERVICE_ID,
  ];
}

export function buildHarnessBootstrap(): HarnessBootstrap {
  return {
    capabilityGroupId: "harness",
    catalog: listHarnessCapabilityBaselines(),
    registeredServiceIds: [
      HARNESS_CATALOG_SERVICE_ID,
      HARNESS_BOOTSTRAP_SERVICE_ID,
      HARNESS_NODE_RUNTIME_SERVICE_ID,
      HARNESS_SIDE_EFFECT_MGR_SERVICE_ID,
      HARNESS_EVALUATOR_SERVICE_ID,
      HARNESS_GRAPH_SCHEDULER_SERVICE_ID,
    ],
  };
}

export function registerHarnessBootstrap(
  registry: ServiceRegistry = ServiceRegistry.getInstance(),
): HarnessBootstrap {
  registry.register<readonly HarnessCapabilityBaseline[]>(HARNESS_CATALOG_SERVICE_ID, {
    init: () => listHarnessCapabilityBaselines(),
  });
  registry.register<HarnessBootstrap>(HARNESS_BOOTSTRAP_SERVICE_ID, {
    init: () => buildHarnessBootstrap(),
    dependsOn: [HARNESS_CATALOG_SERVICE_ID],
  });
  // §211-2527: Register all 6 harness service IDs - previously only 2 were registered
  registry.register(HARNESS_NODE_RUNTIME_SERVICE_ID, { init: () => ({ serviceId: HARNESS_NODE_RUNTIME_SERVICE_ID }) });
  registry.register(HARNESS_SIDE_EFFECT_MGR_SERVICE_ID, { init: () => ({ serviceId: HARNESS_SIDE_EFFECT_MGR_SERVICE_ID }) });
  registry.register(HARNESS_EVALUATOR_SERVICE_ID, { init: () => ({ serviceId: HARNESS_EVALUATOR_SERVICE_ID }) });
  registry.register(HARNESS_GRAPH_SCHEDULER_SERVICE_ID, { init: () => ({ serviceId: HARNESS_GRAPH_SCHEDULER_SERVICE_ID }) });
  return registry.get<HarnessBootstrap>(HARNESS_BOOTSTRAP_SERVICE_ID);
}
