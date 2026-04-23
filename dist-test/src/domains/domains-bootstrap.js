import { ServiceRegistry } from "../platform/shared/lifecycle/service-registry.js";
import { listVerticalDomainBaselines, listVerticalDomainBaselinesByPhase, } from "./domain-baseline-catalog.js";
export const DOMAINS_CATALOG_SERVICE_ID = "w5.domains.catalog";
export const DOMAINS_BOOTSTRAP_SERVICE_ID = "w5.domains.bootstrap";
export const DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS = {
    "9a": "w5.domains.phase.9a.bootstrap",
    "9b": "w5.domains.phase.9b.bootstrap",
    "9c": "w5.domains.phase.9c.bootstrap",
    "9d": "w5.domains.phase.9d.bootstrap",
    "9e": "w5.domains.phase.9e.bootstrap",
    "9f": "w5.domains.phase.9f.bootstrap",
};
const DOMAIN_PHASES = ["9a", "9b", "9c", "9d", "9e", "9f"];
export function buildDomainPhaseBootstrap(phase) {
    return {
        phase,
        baselines: listVerticalDomainBaselinesByPhase(phase),
        registeredServiceId: DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase],
    };
}
export function buildDomainsBootstrap() {
    return {
        capabilityGroupId: "domains",
        catalog: listVerticalDomainBaselines(),
        phases: DOMAIN_PHASES.map((phase) => buildDomainPhaseBootstrap(phase)),
        registeredServiceIds: [DOMAINS_CATALOG_SERVICE_ID, DOMAINS_BOOTSTRAP_SERVICE_ID],
        phaseServiceIds: DOMAIN_PHASES.map((phase) => DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase]),
    };
}
export function registerDomainsBootstrap(registry = ServiceRegistry.getInstance()) {
    registry.register(DOMAINS_CATALOG_SERVICE_ID, {
        init: () => listVerticalDomainBaselines(),
    });
    for (const phase of DOMAIN_PHASES) {
        registry.register(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase], {
            init: () => buildDomainPhaseBootstrap(phase),
            dependsOn: [DOMAINS_CATALOG_SERVICE_ID],
        });
    }
    registry.register(DOMAINS_BOOTSTRAP_SERVICE_ID, {
        init: () => buildDomainsBootstrap(),
        dependsOn: [DOMAINS_CATALOG_SERVICE_ID, ...DOMAIN_PHASES.map((phase) => DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase])],
    });
    return registry.get(DOMAINS_BOOTSTRAP_SERVICE_ID);
}
//# sourceMappingURL=domains-bootstrap.js.map