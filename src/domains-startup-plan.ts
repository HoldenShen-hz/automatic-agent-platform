import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import {
  DOMAINS_BOOTSTRAP_SERVICE_ID,
  DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS,
  buildDomainPhaseBootstrap,
} from "./domains/domains-bootstrap.js";
import type { DomainReadinessRing } from "./domains-runtime-catalog.js";

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

const RING_PHASES: Readonly<Record<DomainsStartupStepId, readonly ("9a" | "9b" | "9c" | "9d" | "9e" | "9f")[]>> = {
  ring1: ["9a", "9b"],
  ring2: ["9c", "9d"],
  ring3: ["9e", "9f"],
};

const DOMAIN_RINGS = ["ring1", "ring2", "ring3"] as const satisfies readonly DomainsStartupStepId[];

export function buildDomainsStartupPlan(): DomainsStartupPlan {
  const steps = DOMAIN_RINGS.map((ringId, index) => ({
    stepId: ringId,
    entryModule: "src/domains/index.ts",
    bootstrapServiceId: `w5.domains.ring.${ringId}.bootstrap`,
    capabilityCount: RING_PHASES[ringId].reduce((sum, phase) => sum + buildDomainPhaseBootstrap(phase).baselines.length, 0),
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
      dependsOn: RING_PHASES[step.stepId].map((phase) => DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase]),
    });
  }
  registry.register<DomainsStartupPlan>(DOMAINS_STARTUP_PLAN_SERVICE_ID, {
    init: () => plan,
    dependsOn: [DOMAINS_BOOTSTRAP_SERVICE_ID, ...plan.steps.map((step) => step.bootstrapServiceId)],
  });
  return registry.get<DomainsStartupPlan>(DOMAINS_STARTUP_PLAN_SERVICE_ID);
}
