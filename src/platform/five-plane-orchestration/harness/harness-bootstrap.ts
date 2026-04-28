import { ServiceRegistry } from "../../shared/lifecycle/service-registry.js";
import {
  listHarnessCapabilityBaselines,
  type HarnessCapabilityBaseline,
} from "./harness-baseline.js";

export type { HarnessCapabilityBaseline } from "./harness-baseline.js";

export const HARNESS_CATALOG_SERVICE_ID = "aiops.harness.catalog";
export const HARNESS_BOOTSTRAP_SERVICE_ID = "aiops.harness.bootstrap";

export interface HarnessBootstrap {
  readonly capabilityGroupId: "harness";
  readonly catalog: readonly HarnessCapabilityBaseline[];
  readonly registeredServiceIds: readonly [typeof HARNESS_CATALOG_SERVICE_ID, typeof HARNESS_BOOTSTRAP_SERVICE_ID];
}

export function buildHarnessBootstrap(): HarnessBootstrap {
  return {
    capabilityGroupId: "harness",
    catalog: listHarnessCapabilityBaselines(),
    registeredServiceIds: [HARNESS_CATALOG_SERVICE_ID, HARNESS_BOOTSTRAP_SERVICE_ID],
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
  return registry.get<HarnessBootstrap>(HARNESS_BOOTSTRAP_SERVICE_ID);
}
