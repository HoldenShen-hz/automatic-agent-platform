import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import {
  SCALE_BOOTSTRAP_SERVICE_ID,
  registerScaleBootstrap,
  type ScaleCapabilityBaseline,
} from "./scale-ecosystem/scale-bootstrap.js";
import {
  OPS_MATURITY_BOOTSTRAP_SERVICE_ID,
  registerOpsMaturityBootstrap,
  type OpsMaturityCapabilityBaseline,
} from "./ops-maturity/ops-maturity-bootstrap.js";

export const SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID = "w4.runtime.catalog";

export interface ScaleOpsRuntimeCatalog {
  readonly scaleEcosystem: readonly ScaleCapabilityBaseline[];
  readonly opsMaturity: readonly OpsMaturityCapabilityBaseline[];
}

export function buildScaleOpsRuntimeCatalog(): ScaleOpsRuntimeCatalog {
  return {
    scaleEcosystem: registerScaleBootstrap().catalog,
    opsMaturity: registerOpsMaturityBootstrap().catalog,
  };
}

export function registerScaleOpsRuntimeCatalog(
  registry: ServiceRegistry = ServiceRegistry.createScoped(),
): ScaleOpsRuntimeCatalog {
  const scaleEcosystem = registerScaleBootstrap(registry).catalog;
  const opsMaturity = registerOpsMaturityBootstrap(registry).catalog;

  registry.register<ScaleOpsRuntimeCatalog>(SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID, {
    init: () => ({ scaleEcosystem, opsMaturity }),
    dependsOn: [SCALE_BOOTSTRAP_SERVICE_ID, OPS_MATURITY_BOOTSTRAP_SERVICE_ID],
  });

  return registry.get<ScaleOpsRuntimeCatalog>(SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID);
}
