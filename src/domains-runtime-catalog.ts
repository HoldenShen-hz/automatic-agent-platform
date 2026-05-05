import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import {
  DOMAINS_BOOTSTRAP_SERVICE_ID,
  registerDomainsBootstrap,
  type DomainBaseline,
  type DomainReadinessRing,
  DOMAIN_RING_BOOTSTRAP_SERVICE_IDS,
} from "./domains/domains-bootstrap.js";

export const DOMAINS_RUNTIME_CATALOG_SERVICE_ID = "w5.runtime.catalog";

export interface DomainsRuntimeCatalog {
  readonly ring1: readonly DomainBaseline[];
  readonly ring2: readonly DomainBaseline[];
  readonly ring3: readonly DomainBaseline[];
}

export function buildDomainsRuntimeCatalog(): DomainsRuntimeCatalog {
  const bootstrap = registerDomainsBootstrap();
  const ringMap = new Map(bootstrap.rings.map((ring) => [ring.ringId, ring.baselines]));
  return {
    ring1: ringMap.get("ring1") ?? [],
    ring2: ringMap.get("ring2") ?? [],
    ring3: ringMap.get("ring3") ?? [],
  };
}

export function registerDomainsRuntimeCatalog(
  registry: ServiceRegistry = ServiceRegistry.createScoped(),
): DomainsRuntimeCatalog {
  const bootstrap = registerDomainsBootstrap(registry);
  const ringMap = new Map(bootstrap.rings.map((ring) => [ring.ringId, ring.baselines]));

  registry.register<DomainsRuntimeCatalog>(DOMAINS_RUNTIME_CATALOG_SERVICE_ID, {
    init: () => ({
      ring1: ringMap.get("ring1") ?? [],
      ring2: ringMap.get("ring2") ?? [],
      ring3: ringMap.get("ring3") ?? [],
    }),
    dependsOn: [DOMAINS_BOOTSTRAP_SERVICE_ID, ...Object.values(DOMAIN_RING_BOOTSTRAP_SERVICE_IDS)],
  });

  return registry.get<DomainsRuntimeCatalog>(DOMAINS_RUNTIME_CATALOG_SERVICE_ID);
}
