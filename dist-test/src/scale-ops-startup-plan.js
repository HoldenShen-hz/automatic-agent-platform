import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import { SCALE_BOOTSTRAP_SERVICE_ID, buildScaleBootstrap, } from "./scale-ecosystem/scale-bootstrap.js";
import { OPS_MATURITY_BOOTSTRAP_SERVICE_ID, buildOpsMaturityBootstrap, } from "./ops-maturity/ops-maturity-bootstrap.js";
export const SCALE_OPS_STARTUP_PLAN_SERVICE_ID = "w4.runtime.startup-plan";
export function buildScaleOpsStartupPlan() {
    const steps = [
        {
            stepId: "scale-ecosystem",
            entryModule: "src/scale-ecosystem/index.ts",
            bootstrapServiceId: SCALE_BOOTSTRAP_SERVICE_ID,
            capabilityCount: buildScaleBootstrap().catalog.length,
            dependsOnStepIds: [],
        },
        {
            stepId: "ops-maturity",
            entryModule: "src/ops-maturity/index.ts",
            bootstrapServiceId: OPS_MATURITY_BOOTSTRAP_SERVICE_ID,
            capabilityCount: buildOpsMaturityBootstrap().catalog.length,
            dependsOnStepIds: ["scale-ecosystem"],
        },
    ];
    return {
        steps,
        totalCapabilityCount: steps.reduce((sum, step) => sum + step.capabilityCount, 0),
        startupOrder: steps.map((step) => step.stepId),
    };
}
export function registerScaleOpsStartupPlan(registry = ServiceRegistry.getInstance()) {
    registry.register(SCALE_OPS_STARTUP_PLAN_SERVICE_ID, {
        init: () => buildScaleOpsStartupPlan(),
        dependsOn: [SCALE_BOOTSTRAP_SERVICE_ID, OPS_MATURITY_BOOTSTRAP_SERVICE_ID],
    });
    return registry.get(SCALE_OPS_STARTUP_PLAN_SERVICE_ID);
}
//# sourceMappingURL=scale-ops-startup-plan.js.map