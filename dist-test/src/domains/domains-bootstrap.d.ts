import { ServiceRegistry } from "../platform/shared/lifecycle/service-registry.js";
import { type DomainBaseline, type VerticalDomainPhase } from "./domain-baseline-catalog.js";
export type { DomainBaseline, VerticalDomainPhase } from "./domain-baseline-catalog.js";
export declare const DOMAINS_CATALOG_SERVICE_ID = "w5.domains.catalog";
export declare const DOMAINS_BOOTSTRAP_SERVICE_ID = "w5.domains.bootstrap";
export declare const DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS: {
    readonly "9a": "w5.domains.phase.9a.bootstrap";
    readonly "9b": "w5.domains.phase.9b.bootstrap";
    readonly "9c": "w5.domains.phase.9c.bootstrap";
    readonly "9d": "w5.domains.phase.9d.bootstrap";
    readonly "9e": "w5.domains.phase.9e.bootstrap";
    readonly "9f": "w5.domains.phase.9f.bootstrap";
};
export interface DomainPhaseBootstrap {
    readonly phase: VerticalDomainPhase;
    readonly baselines: readonly DomainBaseline[];
    readonly registeredServiceId: string;
}
export interface DomainsBootstrap {
    readonly capabilityGroupId: "domains";
    readonly catalog: readonly DomainBaseline[];
    readonly phases: readonly DomainPhaseBootstrap[];
    readonly registeredServiceIds: readonly [typeof DOMAINS_CATALOG_SERVICE_ID, typeof DOMAINS_BOOTSTRAP_SERVICE_ID];
    readonly phaseServiceIds: readonly string[];
}
export declare function buildDomainPhaseBootstrap(phase: VerticalDomainPhase): DomainPhaseBootstrap;
export declare function buildDomainsBootstrap(): DomainsBootstrap;
export declare function registerDomainsBootstrap(registry?: ServiceRegistry): DomainsBootstrap;
