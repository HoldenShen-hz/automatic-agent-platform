import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import { DOMAINS_RUNTIME_CATALOG_SERVICE_ID, registerDomainsRuntimeCatalog, } from "./domains-runtime-catalog.js";
import { DOMAINS_STARTUP_PLAN_SERVICE_ID, buildDomainsStartupPlan, registerDomainsStartupPlan, } from "./domains-startup-plan.js";
import { DOMAINS_BOOTSTRAP_SERVICE_ID, DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS, registerDomainsBootstrap, } from "./domains/domains-bootstrap.js";
export const DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID = "w5.runtime.orchestrator";
function buildDependencyServiceIds(step, plan) {
    return step.dependsOnStepIds.map((dependencyStepId) => {
        const dependencyStep = plan.steps.find((candidate) => candidate.stepId === dependencyStepId);
        if (dependencyStep == null) {
            throw new Error(`w5_startup_plan.missing_dependency:${dependencyStepId}`);
        }
        return dependencyStep.bootstrapServiceId;
    });
}
export class DomainsRuntimeOrchestrator {
    registry;
    constructor(registry = ServiceRegistry.getInstance()) {
        this.registry = registry;
    }
    prepare() {
        registerDomainsBootstrap(this.registry);
        registerDomainsRuntimeCatalog(this.registry);
        return registerDomainsStartupPlan(this.registry);
    }
    startup() {
        const startupPlan = this.prepare();
        const steps = startupPlan.steps.map((step) => {
            const initializedDependencyServiceIds = buildDependencyServiceIds(step, startupPlan).filter((serviceId) => this.registry.isInitialized(serviceId));
            this.registry.get(step.bootstrapServiceId);
            return {
                stepId: step.stepId,
                bootstrapServiceId: step.bootstrapServiceId,
                capabilityCount: step.capabilityCount,
                initialized: this.registry.isInitialized(step.bootstrapServiceId),
                initializedDependencyServiceIds,
            };
        });
        return {
            ready: steps.every((step) => step.initialized),
            startupOrder: startupPlan.startupOrder,
            initializedServiceIds: startupPlan.steps
                .map((step) => step.bootstrapServiceId)
                .filter((serviceId) => this.registry.isInitialized(serviceId)),
            steps,
        };
    }
    snapshotReadiness() {
        const startupPlan = buildDomainsStartupPlan();
        return {
            runtimeCatalogInitialized: this.registry.isInitialized(DOMAINS_RUNTIME_CATALOG_SERVICE_ID),
            startupPlanInitialized: this.registry.isInitialized(DOMAINS_STARTUP_PLAN_SERVICE_ID),
            orchestratorInitialized: this.registry.isInitialized(DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID),
            capabilityReadiness: startupPlan.steps.map((step) => ({
                stepId: step.stepId,
                bootstrapServiceId: step.bootstrapServiceId,
                initialized: this.registry.isInitialized(step.bootstrapServiceId),
            })),
        };
    }
}
export function registerDomainsRuntimeOrchestrator(registry = ServiceRegistry.getInstance()) {
    registerDomainsBootstrap(registry);
    registerDomainsRuntimeCatalog(registry);
    registerDomainsStartupPlan(registry);
    registry.register(DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID, {
        init: () => new DomainsRuntimeOrchestrator(registry),
        dependsOn: [
            DOMAINS_BOOTSTRAP_SERVICE_ID,
            ...Object.values(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS),
            DOMAINS_RUNTIME_CATALOG_SERVICE_ID,
            DOMAINS_STARTUP_PLAN_SERVICE_ID,
        ],
    });
    return registry.get(DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID);
}
//# sourceMappingURL=domains-runtime-orchestrator.js.map