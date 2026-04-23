import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import { DOMAINS_BOOTSTRAP_SERVICE_ID, DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS, registerDomainsBootstrap, } from "./domains/domains-bootstrap.js";
export const DOMAINS_RUNTIME_CATALOG_SERVICE_ID = "w5.runtime.catalog";
export function buildDomainsRuntimeCatalog() {
    const bootstrap = registerDomainsBootstrap();
    return {
        phase9a: bootstrap.phases.find((phase) => phase.phase === "9a").baselines,
        phase9b: bootstrap.phases.find((phase) => phase.phase === "9b").baselines,
        phase9c: bootstrap.phases.find((phase) => phase.phase === "9c").baselines,
        phase9d: bootstrap.phases.find((phase) => phase.phase === "9d").baselines,
        phase9e: bootstrap.phases.find((phase) => phase.phase === "9e").baselines,
        phase9f: bootstrap.phases.find((phase) => phase.phase === "9f").baselines,
    };
}
export function registerDomainsRuntimeCatalog(registry = ServiceRegistry.getInstance()) {
    const bootstrap = registerDomainsBootstrap(registry);
    const phaseMap = new Map(bootstrap.phases.map((phase) => [phase.phase, phase.baselines]));
    registry.register(DOMAINS_RUNTIME_CATALOG_SERVICE_ID, {
        init: () => ({
            phase9a: phaseMap.get("9a") ?? [],
            phase9b: phaseMap.get("9b") ?? [],
            phase9c: phaseMap.get("9c") ?? [],
            phase9d: phaseMap.get("9d") ?? [],
            phase9e: phaseMap.get("9e") ?? [],
            phase9f: phaseMap.get("9f") ?? [],
        }),
        dependsOn: [DOMAINS_BOOTSTRAP_SERVICE_ID, ...Object.values(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS)],
    });
    return registry.get(DOMAINS_RUNTIME_CATALOG_SERVICE_ID);
}
//# sourceMappingURL=domains-runtime-catalog.js.map