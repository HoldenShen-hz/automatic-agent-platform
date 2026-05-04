import { ServiceRegistry } from "../platform/shared/lifecycle/service-registry.js";
import {
  listVerticalDomainBaselines,
  listVerticalDomainBaselinesByPhase,
  type DomainBaseline,
  type VerticalDomainPhase,
} from "./domain-baseline-catalog.js";

export type { DomainBaseline, VerticalDomainPhase } from "./domain-baseline-catalog.js";
export { listVerticalDomainBaselines, listVerticalDomainBaselinesByPhase } from "./domain-baseline-catalog.js";
export type DomainReadinessRing = "ring1" | "ring2" | "ring3";

export const DOMAINS_CATALOG_SERVICE_ID = "w5.domains.catalog";
export const DOMAINS_BOOTSTRAP_SERVICE_ID = "w5.domains.bootstrap";
export const DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS = {
  "9a": "w5.domains.phase.9a.bootstrap",
  "9b": "w5.domains.phase.9b.bootstrap",
  "9c": "w5.domains.phase.9c.bootstrap",
  "9d": "w5.domains.phase.9d.bootstrap",
  "9e": "w5.domains.phase.9e.bootstrap",
  "9f": "w5.domains.phase.9f.bootstrap",
} as const satisfies Record<VerticalDomainPhase, string>;
export const DOMAIN_RING_BOOTSTRAP_SERVICE_IDS = {
  ring1: "w5.domains.ring.ring1.bootstrap",
  ring2: "w5.domains.ring.ring2.bootstrap",
  ring3: "w5.domains.ring.ring3.bootstrap",
} as const satisfies Record<DomainReadinessRing, string>;

export interface DomainPhaseBootstrap {
  readonly phase: VerticalDomainPhase;
  readonly baselines: readonly DomainBaseline[];
  readonly registeredServiceId: string;
}

export interface DomainRingBootstrap {
  readonly ringId: DomainReadinessRing;
  readonly legacyPhases: readonly VerticalDomainPhase[];
  readonly baselines: readonly DomainBaseline[];
  readonly registeredServiceId: string;
}

export interface DomainsBootstrap {
  readonly capabilityGroupId: "domains";
  readonly catalog: readonly DomainBaseline[];
  readonly rings: readonly DomainRingBootstrap[];
  readonly phases: readonly DomainPhaseBootstrap[];
  readonly registeredServiceIds: readonly [typeof DOMAINS_CATALOG_SERVICE_ID, typeof DOMAINS_BOOTSTRAP_SERVICE_ID];
  readonly ringServiceIds: readonly string[];
  readonly phaseServiceIds: readonly string[];
}

const DOMAIN_PHASES = ["9a", "9b", "9c", "9d", "9e", "9f"] as const satisfies readonly VerticalDomainPhase[];
const DOMAIN_RINGS = ["ring1", "ring2", "ring3"] as const satisfies readonly DomainReadinessRing[];
const RING_PHASES: Readonly<Record<DomainReadinessRing, readonly VerticalDomainPhase[]>> = {
  ring1: ["9a", "9b"],
  ring2: ["9c", "9d"],
  ring3: ["9e", "9f"],
};

export function buildDomainPhaseBootstrap(phase: VerticalDomainPhase): DomainPhaseBootstrap {
  return {
    phase,
    baselines: listVerticalDomainBaselinesByPhase(phase),
    registeredServiceId: DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase],
  };
}

export function buildDomainRingBootstrap(ringId: DomainReadinessRing): DomainRingBootstrap {
  const legacyPhases = RING_PHASES[ringId];
  return {
    ringId,
    legacyPhases,
    baselines: legacyPhases.flatMap((phase) => listVerticalDomainBaselinesByPhase(phase)),
    registeredServiceId: DOMAIN_RING_BOOTSTRAP_SERVICE_IDS[ringId],
  };
}

export function buildDomainsBootstrap(): DomainsBootstrap {
  return {
    capabilityGroupId: "domains",
    catalog: listVerticalDomainBaselines(),
    rings: DOMAIN_RINGS.map((ringId) => buildDomainRingBootstrap(ringId)),
    phases: DOMAIN_PHASES.map((phase) => buildDomainPhaseBootstrap(phase)),
    registeredServiceIds: [DOMAINS_CATALOG_SERVICE_ID, DOMAINS_BOOTSTRAP_SERVICE_ID],
    ringServiceIds: DOMAIN_RINGS.map((ringId) => DOMAIN_RING_BOOTSTRAP_SERVICE_IDS[ringId]),
    phaseServiceIds: DOMAIN_PHASES.map((phase) => DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase]),
  };
}

export function registerDomainsBootstrap(
  registry: ServiceRegistry = ServiceRegistry.getInstance(),
): DomainsBootstrap {
  registry.register<readonly DomainBaseline[]>(DOMAINS_CATALOG_SERVICE_ID, {
    init: () => listVerticalDomainBaselines(),
  });
  for (const phase of DOMAIN_PHASES) {
    registry.register<DomainPhaseBootstrap>(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase], {
      init: () => buildDomainPhaseBootstrap(phase),
      dependsOn: [DOMAINS_CATALOG_SERVICE_ID],
    });
  }
  for (const ringId of DOMAIN_RINGS) {
    registry.register<DomainRingBootstrap>(DOMAIN_RING_BOOTSTRAP_SERVICE_IDS[ringId], {
      init: () => buildDomainRingBootstrap(ringId),
      dependsOn: RING_PHASES[ringId].map((phase) => DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase]),
    });
  }
  registry.register<DomainsBootstrap>(DOMAINS_BOOTSTRAP_SERVICE_ID, {
    init: () => buildDomainsBootstrap(),
    dependsOn: [
      DOMAINS_CATALOG_SERVICE_ID,
      ...DOMAIN_PHASES.map((phase) => DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase]),
      ...DOMAIN_RINGS.map((ringId) => DOMAIN_RING_BOOTSTRAP_SERVICE_IDS[ringId]),
    ],
  });
  return registry.get<DomainsBootstrap>(DOMAINS_BOOTSTRAP_SERVICE_ID);
}
