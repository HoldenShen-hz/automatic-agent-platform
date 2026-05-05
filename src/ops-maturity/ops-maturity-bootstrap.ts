import { ServiceRegistry } from "../platform/shared/lifecycle/service-registry.js";
import {
  listOpsMaturityCapabilityBaselines,
  type OpsMaturityCapabilityBaseline,
} from "./ops-maturity-baseline-catalog.js";

export type { OpsMaturityCapabilityBaseline } from "./ops-maturity-baseline-catalog.js";

export const OPS_MATURITY_CATALOG_SERVICE_ID = "w4.ops-maturity.catalog";
export const OPS_MATURITY_BOOTSTRAP_SERVICE_ID = "w4.ops-maturity.bootstrap";

export interface OpsMaturityBootstrap {
  readonly capabilityGroupId: "ops-maturity";
  readonly catalog: readonly OpsMaturityCapabilityBaseline[];
  readonly registeredServiceIds: readonly [
    typeof OPS_MATURITY_CATALOG_SERVICE_ID,
    typeof OPS_MATURITY_BOOTSTRAP_SERVICE_ID,
  ];
}

export function buildOpsMaturityBootstrap(): OpsMaturityBootstrap {
  return {
    capabilityGroupId: "ops-maturity",
    catalog: listOpsMaturityCapabilityBaselines(),
    registeredServiceIds: [OPS_MATURITY_CATALOG_SERVICE_ID, OPS_MATURITY_BOOTSTRAP_SERVICE_ID],
  };
}

export function registerOpsMaturityBootstrap(
  registry: ServiceRegistry = ServiceRegistry.createScoped(),
): OpsMaturityBootstrap {
  registry.register<readonly OpsMaturityCapabilityBaseline[]>(OPS_MATURITY_CATALOG_SERVICE_ID, {
    init: () => listOpsMaturityCapabilityBaselines(),
  });
  registry.register<OpsMaturityBootstrap>(OPS_MATURITY_BOOTSTRAP_SERVICE_ID, {
    init: () => buildOpsMaturityBootstrap(),
    dependsOn: [OPS_MATURITY_CATALOG_SERVICE_ID],
  });
  return registry.get<OpsMaturityBootstrap>(OPS_MATURITY_BOOTSTRAP_SERVICE_ID);
}
