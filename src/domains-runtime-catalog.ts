import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import {
  DOMAINS_BOOTSTRAP_SERVICE_ID,
  DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS,
  registerDomainsBootstrap,
  type DomainBaseline,
} from "./domains/domains-bootstrap.js";

export const DOMAINS_RUNTIME_CATALOG_SERVICE_ID = "w5.runtime.catalog";

export type DomainReadinessRing = "ring1" | "ring2" | "ring3";

export interface DomainsRuntimeCatalog {
  readonly ring1: readonly DomainBaseline[];
  readonly ring2: readonly DomainBaseline[];
  readonly ring3: readonly DomainBaseline[];
}

const RING_PHASES: Readonly<Record<DomainReadinessRing, readonly string[]>> = {
  ring1: ["9a", "9b"],
  ring2: ["9c", "9d"],
  ring3: ["9e", "9f"],
};

function buildRingBaselines(phaseMap: ReadonlyMap<string, readonly DomainBaseline[]>): DomainsRuntimeCatalog {
  return {
    ring1: RING_PHASES.ring1.flatMap((phase) => phaseMap.get(phase) ?? []),
    ring2: RING_PHASES.ring2.flatMap((phase) => phaseMap.get(phase) ?? []),
    ring3: RING_PHASES.ring3.flatMap((phase) => phaseMap.get(phase) ?? []),
  };
}

export function buildDomainsRuntimeCatalog(): DomainsRuntimeCatalog {
  const bootstrap = registerDomainsBootstrap();
  return buildRingBaselines(new Map(bootstrap.phases.map((phase) => [phase.phase, phase.baselines])));
}

export function registerDomainsRuntimeCatalog(
  registry: ServiceRegistry = ServiceRegistry.getInstance(),
): DomainsRuntimeCatalog {
  const bootstrap = registerDomainsBootstrap(registry);
  const phaseMap = new Map(bootstrap.phases.map((phase) => [phase.phase, phase.baselines]));

  registry.register<DomainsRuntimeCatalog>(DOMAINS_RUNTIME_CATALOG_SERVICE_ID, {
    init: () => buildRingBaselines(phaseMap),
    dependsOn: [DOMAINS_BOOTSTRAP_SERVICE_ID, ...Object.values(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS)],
  });

  return registry.get<DomainsRuntimeCatalog>(DOMAINS_RUNTIME_CATALOG_SERVICE_ID);
}
