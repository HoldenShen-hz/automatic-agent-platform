import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import {
  DOMAINS_BOOTSTRAP_SERVICE_ID,
  DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS,
  buildDomainPhaseBootstrap,
  type VerticalDomainPhase,
} from "./domains/domains-bootstrap.js";

export const DOMAINS_STARTUP_PLAN_SERVICE_ID = "w5.runtime.startup-plan";

export type DomainsStartupStepId = VerticalDomainPhase;

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

const DOMAIN_PHASES = ["9a", "9b", "9c", "9d", "9e", "9f"] as const satisfies readonly VerticalDomainPhase[];

export function buildDomainsStartupPlan(): DomainsStartupPlan {
  const steps = DOMAIN_PHASES.map((phase, index) => ({
    stepId: phase,
    entryModule: "src/domains/index.ts",
    bootstrapServiceId: DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase],
    capabilityCount: buildDomainPhaseBootstrap(phase).baselines.length,
    dependsOnStepIds: index === 0 ? [] : [DOMAIN_PHASES[index - 1]!],
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
  registry.register<DomainsStartupPlan>(DOMAINS_STARTUP_PLAN_SERVICE_ID, {
    init: () => buildDomainsStartupPlan(),
    dependsOn: [DOMAINS_BOOTSTRAP_SERVICE_ID, ...Object.values(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS)],
  });
  return registry.get<DomainsStartupPlan>(DOMAINS_STARTUP_PLAN_SERVICE_ID);
}
