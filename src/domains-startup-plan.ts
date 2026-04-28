import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import {
  DOMAINS_BOOTSTRAP_SERVICE_ID,
  DOMAIN_RING_BOOTSTRAP_SERVICE_IDS,
  buildDomainRingBootstrap,
  type DomainReadinessRing,
} from "./domains/domains-bootstrap.js";

export const DOMAINS_STARTUP_PLAN_SERVICE_ID = "w5.runtime.startup-plan";

export type DomainsStartupStepId = DomainReadinessRing;

export interface DomainsStartupStep {
  readonly stepId: DomainsStartupStepId;
  readonly entryModule: string;
  readonly bootstrapServiceId: string;
  readonly capabilityCount: number;
  readonly dependsOnStepIds: readonly DomainsStartupStepId[];
}

export interface DomainsStartupPlan {
  readonly steps: readonly DomainsStartupStep[];
  readonly totalCapabilityCount: number;
  readonly startupOrder: readonly DomainsStartupStepId[];
}

const DOMAIN_RINGS = ["ring1", "ring2", "ring3"] as const satisfies readonly DomainsStartupStepId[];

export function buildDomainsStartupPlan(): DomainsStartupPlan {
  const steps = DOMAIN_RINGS.map((ringId, index) => ({
    stepId: ringId,
    entryModule: "src/domains/index.ts",
    bootstrapServiceId: DOMAIN_RING_BOOTSTRAP_SERVICE_IDS[ringId],
    capabilityCount: buildDomainRingBootstrap(ringId).baselines.length,
    dependsOnStepIds: index === 0 ? [] : [DOMAIN_RINGS[index - 1]!],
  })) as readonly DomainsStartupStep[];

  return {
    steps,
    totalCapabilityCount: steps.reduce((sum, step) => sum + step.capabilityCount, 0),
    startupOrder: steps.map((step) => step.stepId),
  };
}

export function registerDomainsStartupPlan(
  registry: ServiceRegistry = ServiceRegistry.getInstance(),
): DomainsStartupPlan {
  const plan = buildDomainsStartupPlan();
  for (const step of plan.steps) {
    registry.register<DomainsStartupStep>(step.bootstrapServiceId, {
      init: () => step,
      dependsOn: [DOMAIN_RING_BOOTSTRAP_SERVICE_IDS[step.stepId]],
    });
  }
  registry.register<DomainsStartupPlan>(DOMAINS_STARTUP_PLAN_SERVICE_ID, {
    init: () => plan,
    dependsOn: [DOMAINS_BOOTSTRAP_SERVICE_ID, ...plan.steps.map((step) => step.bootstrapServiceId)],
  });
  return registry.get<DomainsStartupPlan>(DOMAINS_STARTUP_PLAN_SERVICE_ID);
}
