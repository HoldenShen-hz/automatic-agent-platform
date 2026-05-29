import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import {
  DOMAINS_BOOTSTRAP_SERVICE_ID,
  registerDomainsBootstrap,
  type DomainBaseline,
  DOMAIN_RING_BOOTSTRAP_SERVICE_IDS,
} from "./domains/domains-bootstrap.js";

export const DOMAINS_RUNTIME_CATALOG_SERVICE_ID = "w5.runtime.catalog";

export interface DomainsRuntimeCatalog {
  readonly ring1: readonly DomainBaseline[];
  readonly ring2: readonly DomainBaseline[];
  readonly ring3: readonly DomainBaseline[];
}

let catalogInstances = new WeakMap<ServiceRegistry, DomainsRuntimeCatalog>();

export function buildDomainsRuntimeCatalog(
  registry: ServiceRegistry = ServiceRegistry.getInstance(),
): DomainsRuntimeCatalog {
  const bootstrap = registerDomainsBootstrap(registry);
  const ringMap = new Map(bootstrap.rings.map((ring) => [ring.ringId, ring.baselines]));
  return {
    ring1: ringMap.get("ring1") ?? [],
    ring2: ringMap.get("ring2") ?? [],
    ring3: ringMap.get("ring3") ?? [],
  };
}

export function registerDomainsRuntimeCatalog(
  registry: ServiceRegistry = ServiceRegistry.getInstance(),
): DomainsRuntimeCatalog {
  const existing = catalogInstances.get(registry);
  if (existing != null) {
    return existing;
  }
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

  const catalog = registry.get<DomainsRuntimeCatalog>(DOMAINS_RUNTIME_CATALOG_SERVICE_ID);
  catalogInstances.set(registry, catalog);
  return catalog;
}

export function resetDomainsRuntimeCatalogForTests(): void {
  catalogInstances = new WeakMap<ServiceRegistry, DomainsRuntimeCatalog>();
}
