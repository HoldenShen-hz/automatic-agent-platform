import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import { INTERACTION_BOOTSTRAP_SERVICE_ID, buildInteractionBootstrap, } from "./interaction/interaction-bootstrap.js";
import { GOVERNANCE_BOOTSTRAP_SERVICE_ID, buildGovernanceBootstrap, } from "./org-governance/governance-bootstrap.js";
export const INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID = "w3.runtime.startup-plan";
export function buildInteractionGovernanceStartupPlan() {
    const steps = [
        {
            stepId: "interaction",
            entryModule: "src/interaction/index.ts",
            bootstrapServiceId: INTERACTION_BOOTSTRAP_SERVICE_ID,
            capabilityCount: buildInteractionBootstrap().catalog.length,
            dependsOnStepIds: [],
        },
        {
            stepId: "org-governance",
            entryModule: "src/org-governance/index.ts",
            bootstrapServiceId: GOVERNANCE_BOOTSTRAP_SERVICE_ID,
            capabilityCount: buildGovernanceBootstrap().catalog.length,
            dependsOnStepIds: ["interaction"],
        },
    ];
    return {
        steps,
        totalCapabilityCount: steps.reduce((sum, step) => sum + step.capabilityCount, 0),
        startupOrder: steps.map((step) => step.stepId),
    };
}
export function registerInteractionGovernanceStartupPlan(registry = ServiceRegistry.getInstance()) {
    registry.register(INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID, {
        init: () => buildInteractionGovernanceStartupPlan(),
        dependsOn: [INTERACTION_BOOTSTRAP_SERVICE_ID, GOVERNANCE_BOOTSTRAP_SERVICE_ID],
    });
    return registry.get(INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID);
}
//# sourceMappingURL=interaction-governance-startup-plan.js.map