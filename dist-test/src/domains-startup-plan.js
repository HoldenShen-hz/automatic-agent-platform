import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import { DOMAINS_BOOTSTRAP_SERVICE_ID, DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS, buildDomainPhaseBootstrap, } from "./domains/domains-bootstrap.js";
export const DOMAINS_STARTUP_PLAN_SERVICE_ID = "w5.runtime.startup-plan";
const DOMAIN_PHASES = ["9a", "9b", "9c", "9d", "9e", "9f"];
export function buildDomainsStartupPlan() {
    const steps = DOMAIN_PHASES.map((phase, index) => ({
        stepId: phase,
        entryModule: "src/domains/index.ts",
        bootstrapServiceId: DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase],
        capabilityCount: buildDomainPhaseBootstrap(phase).baselines.length,
        dependsOnStepIds: index === 0 ? [] : [DOMAIN_PHASES[index - 1]],
    }));
    return {
        steps,
        totalCapabilityCount: steps.reduce((sum, step) => sum + step.capabilityCount, 0),
        startupOrder: steps.map((step) => step.stepId),
    };
}
export function registerDomainsStartupPlan(registry = ServiceRegistry.getInstance()) {
    registry.register(DOMAINS_STARTUP_PLAN_SERVICE_ID, {
        init: () => buildDomainsStartupPlan(),
        dependsOn: [DOMAINS_BOOTSTRAP_SERVICE_ID, ...Object.values(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS)],
    });
    return registry.get(DOMAINS_STARTUP_PLAN_SERVICE_ID);
}
//# sourceMappingURL=domains-startup-plan.js.map