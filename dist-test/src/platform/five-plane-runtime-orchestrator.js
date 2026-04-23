import { ServiceRegistry } from "./shared/lifecycle/service-registry.js";
import { FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID, registerFivePlaneRuntimeCatalog, } from "./five-plane-runtime-bootstrap.js";
import { buildFivePlaneStartupPlan, FIVE_PLANE_STARTUP_PLAN_SERVICE_ID, registerFivePlaneStartupPlan, } from "./five-plane-startup-plan.js";
export const FIVE_PLANE_RUNTIME_ORCHESTRATOR_SERVICE_ID = "plane.runtime.orchestrator";
function buildDependencyServiceIds(step, plan) {
    return step.dependsOnStepIds.map((dependencyStepId) => {
        const dependencyStep = plan.steps.find((candidate) => candidate.stepId === dependencyStepId);
        if (dependencyStep == null) {
            throw new Error(`five_plane_startup_plan.missing_dependency:${dependencyStepId}`);
        }
        return dependencyStep.bootstrapServiceId;
    });
}
export class FivePlaneRuntimeOrchestrator {
    registry;
    constructor(registry = ServiceRegistry.getInstance()) {
        this.registry = registry;
    }
    prepare() {
        const runtimeCatalog = registerFivePlaneRuntimeCatalog(this.registry);
        const startupPlan = registerFivePlaneStartupPlan(this.registry);
        return { startupPlan, runtimeCatalog };
    }
    startup() {
        const { startupPlan, runtimeCatalog } = this.prepare();
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
            runtimeCatalog,
        };
    }
    snapshotReadiness() {
        const startupPlan = buildFivePlaneStartupPlan();
        return {
            runtimeCatalogInitialized: this.registry.isInitialized(FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID),
            startupPlanInitialized: this.registry.isInitialized(FIVE_PLANE_STARTUP_PLAN_SERVICE_ID),
            orchestratorInitialized: this.registry.isInitialized(FIVE_PLANE_RUNTIME_ORCHESTRATOR_SERVICE_ID),
            planeReadiness: startupPlan.steps.map((step) => ({
                stepId: step.stepId,
                bootstrapServiceId: step.bootstrapServiceId,
                initialized: this.registry.isInitialized(step.bootstrapServiceId),
            })),
        };
    }
}
export function registerFivePlaneRuntimeOrchestrator(registry = ServiceRegistry.getInstance()) {
    registerFivePlaneRuntimeCatalog(registry);
    registerFivePlaneStartupPlan(registry);
    registry.register(FIVE_PLANE_RUNTIME_ORCHESTRATOR_SERVICE_ID, {
        init: () => new FivePlaneRuntimeOrchestrator(registry),
        dependsOn: [FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID, FIVE_PLANE_STARTUP_PLAN_SERVICE_ID],
    });
    return registry.get(FIVE_PLANE_RUNTIME_ORCHESTRATOR_SERVICE_ID);
}
//# sourceMappingURL=five-plane-runtime-orchestrator.js.map