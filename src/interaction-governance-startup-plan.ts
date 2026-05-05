import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import {
  INTERACTION_BOOTSTRAP_SERVICE_ID,
  buildInteractionBootstrap,
} from "./interaction/interaction-bootstrap.js";
import {
  GOVERNANCE_BOOTSTRAP_SERVICE_ID,
  buildGovernanceBootstrap,
} from "./org-governance/governance-bootstrap.js";

export const INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID = "w3.runtime.startup-plan";

export type InteractionGovernanceStartupStepId = "interaction" | "org-governance";

export interface InteractionGovernanceStartupStep {
  readonly stepId: InteractionGovernanceStartupStepId;
  readonly entryModule: string;
  readonly bootstrapServiceId: string;
  readonly capabilityCount: number;
  readonly dependsOnStepIds: readonly InteractionGovernanceStartupStepId[];
}

export interface InteractionGovernanceStartupPlan {
  readonly steps: readonly InteractionGovernanceStartupStep[];
  readonly totalCapabilityCount: number;
  readonly startupOrder: readonly InteractionGovernanceStartupStepId[];
}

export function buildInteractionGovernanceStartupPlan(): InteractionGovernanceStartupPlan {
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
  ] as const satisfies readonly InteractionGovernanceStartupStep[];

  return {
    steps,
    totalCapabilityCount: steps.reduce((sum, step) => sum + step.capabilityCount, 0),
    startupOrder: steps.map((step) => step.stepId),
  };
}

export function registerInteractionGovernanceStartupPlan(
  registry: ServiceRegistry = ServiceRegistry.createScoped(),
): InteractionGovernanceStartupPlan {
  registry.register<InteractionGovernanceStartupPlan>(INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID, {
    init: () => buildInteractionGovernanceStartupPlan(),
    dependsOn: [INTERACTION_BOOTSTRAP_SERVICE_ID, GOVERNANCE_BOOTSTRAP_SERVICE_ID],
  });
  return registry.get<InteractionGovernanceStartupPlan>(INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID);
}
