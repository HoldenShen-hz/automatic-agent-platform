import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import { INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID, registerInteractionGovernanceRuntimeCatalog, } from "./interaction-governance-runtime-catalog.js";
import { INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID, buildInteractionGovernanceStartupPlan, registerInteractionGovernanceStartupPlan, } from "./interaction-governance-startup-plan.js";
import { INTERACTION_BOOTSTRAP_SERVICE_ID, registerInteractionBootstrap, } from "./interaction/interaction-bootstrap.js";
import { GOVERNANCE_BOOTSTRAP_SERVICE_ID, registerGovernanceBootstrap, } from "./org-governance/governance-bootstrap.js";
export const INTERACTION_GOVERNANCE_RUNTIME_ORCHESTRATOR_SERVICE_ID = "w3.runtime.orchestrator";
function buildDependencyServiceIds(step, plan) {
    return step.dependsOnStepIds.map((dependencyStepId) => {
        const dependencyStep = plan.steps.find((candidate) => candidate.stepId === dependencyStepId);
        if (dependencyStep == null) {
            throw new Error(`w3_startup_plan.missing_dependency:${dependencyStepId}`);
        }
        return dependencyStep.bootstrapServiceId;
    });
}
export class InteractionGovernanceRuntimeOrchestrator {
    registry;
    constructor(registry = ServiceRegistry.getInstance()) {
        this.registry = registry;
    }
    prepare() {
        registerInteractionBootstrap(this.registry);
        registerGovernanceBootstrap(this.registry);
        registerInteractionGovernanceRuntimeCatalog(this.registry);
        return registerInteractionGovernanceStartupPlan(this.registry);
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
        const startupPlan = buildInteractionGovernanceStartupPlan();
        return {
            runtimeCatalogInitialized: this.registry.isInitialized(INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID),
            startupPlanInitialized: this.registry.isInitialized(INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID),
            orchestratorInitialized: this.registry.isInitialized(INTERACTION_GOVERNANCE_RUNTIME_ORCHESTRATOR_SERVICE_ID),
            capabilityReadiness: startupPlan.steps.map((step) => ({
                stepId: step.stepId,
                bootstrapServiceId: step.bootstrapServiceId,
                initialized: this.registry.isInitialized(step.bootstrapServiceId),
            })),
        };
    }
}
export function registerInteractionGovernanceRuntimeOrchestrator(registry = ServiceRegistry.getInstance()) {
    registerInteractionBootstrap(registry);
    registerGovernanceBootstrap(registry);
    registerInteractionGovernanceRuntimeCatalog(registry);
    registerInteractionGovernanceStartupPlan(registry);
    registry.register(INTERACTION_GOVERNANCE_RUNTIME_ORCHESTRATOR_SERVICE_ID, {
        init: () => new InteractionGovernanceRuntimeOrchestrator(registry),
        dependsOn: [
            INTERACTION_BOOTSTRAP_SERVICE_ID,
            GOVERNANCE_BOOTSTRAP_SERVICE_ID,
            INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID,
            INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID,
        ],
    });
    return registry.get(INTERACTION_GOVERNANCE_RUNTIME_ORCHESTRATOR_SERVICE_ID);
}
//# sourceMappingURL=interaction-governance-runtime-orchestrator.js.map