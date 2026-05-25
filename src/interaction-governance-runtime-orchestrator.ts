import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import {
  INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID,
  registerInteractionGovernanceRuntimeCatalog,
} from "./interaction-governance-runtime-catalog.js";
import {
  INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID,
  buildInteractionGovernanceStartupPlan,
  registerInteractionGovernanceStartupPlan,
  type InteractionGovernanceStartupPlan,
  type InteractionGovernanceStartupStepId,
} from "./interaction-governance-startup-plan.js";
import {
  INTERACTION_BOOTSTRAP_SERVICE_ID,
  registerInteractionBootstrap,
} from "./interaction/interaction-bootstrap.js";
import {
  GOVERNANCE_BOOTSTRAP_SERVICE_ID,
  registerGovernanceBootstrap,
} from "./org-governance/governance-bootstrap.js";
import {
  executeStartupPlan,
  snapshotStartupReadiness,
} from "./platform/shared/lifecycle/runtime-orchestrator-support.js";

export const INTERACTION_GOVERNANCE_RUNTIME_ORCHESTRATOR_SERVICE_ID = "w3.runtime.orchestrator";

export interface InteractionGovernanceStartupExecutionStep {
  readonly stepId: InteractionGovernanceStartupStepId;
  readonly bootstrapServiceId: string;
  readonly capabilityCount: number;
  readonly initialized: boolean;
  readonly initializedDependencyServiceIds: readonly string[];
}

export interface InteractionGovernanceRuntimeStartupResult {
  readonly ready: boolean;
  readonly startupOrder: readonly InteractionGovernanceStartupStepId[];
  readonly initializedServiceIds: readonly string[];
  readonly steps: readonly InteractionGovernanceStartupExecutionStep[];
}

export interface InteractionGovernanceReadinessSnapshot {
  readonly runtimeCatalogInitialized: boolean;
  readonly startupPlanInitialized: boolean;
  readonly orchestratorInitialized: boolean;
  readonly capabilityReadiness: readonly {
    readonly stepId: InteractionGovernanceStartupStepId;
    readonly bootstrapServiceId: string;
    readonly initialized: boolean;
  }[];
}

export class InteractionGovernanceRuntimeOrchestrator {
  private startupPlan: InteractionGovernanceStartupPlan | undefined;

  public constructor(private readonly registry: ServiceRegistry = ServiceRegistry.createScoped()) {}

  public prepare(): InteractionGovernanceStartupPlan {
    registerInteractionBootstrap(this.registry);
    registerGovernanceBootstrap(this.registry);
    registerInteractionGovernanceRuntimeCatalog(this.registry);
    const startupPlan = registerInteractionGovernanceStartupPlan(this.registry);
    this.startupPlan = startupPlan;
    return startupPlan;
  }

  public startup(): InteractionGovernanceRuntimeStartupResult {
    const startupPlan = this.prepare();
    this.startupPlan = startupPlan;
    const runtime = executeStartupPlan(this.registry, startupPlan, "w3_startup_plan.missing_dependency");

    return {
      ...runtime,
    };
  }

  public snapshotReadiness(): InteractionGovernanceReadinessSnapshot {
    const startupPlan = this.startupPlan
      ?? (this.registry.isInitialized(INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID)
        ? this.registry.get<InteractionGovernanceStartupPlan>(INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID)
        : buildInteractionGovernanceStartupPlan());
    return {
      runtimeCatalogInitialized: this.registry.isInitialized(INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID),
      startupPlanInitialized: this.registry.isInitialized(INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID),
      orchestratorInitialized: this.registry.isInitialized(INTERACTION_GOVERNANCE_RUNTIME_ORCHESTRATOR_SERVICE_ID),
      capabilityReadiness: snapshotStartupReadiness(this.registry, startupPlan),
    };
  }
}

export function registerInteractionGovernanceRuntimeOrchestrator(
  registry: ServiceRegistry = ServiceRegistry.createScoped(),
): InteractionGovernanceRuntimeOrchestrator {
  registerInteractionBootstrap(registry);
  registerGovernanceBootstrap(registry);
  registerInteractionGovernanceRuntimeCatalog(registry);
  registerInteractionGovernanceStartupPlan(registry);
  registry.register<InteractionGovernanceRuntimeOrchestrator>(INTERACTION_GOVERNANCE_RUNTIME_ORCHESTRATOR_SERVICE_ID, {
    init: () => new InteractionGovernanceRuntimeOrchestrator(registry),
    dependsOn: [
      INTERACTION_BOOTSTRAP_SERVICE_ID,
      GOVERNANCE_BOOTSTRAP_SERVICE_ID,
      INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID,
      INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID,
    ],
  });
  return registry.get<InteractionGovernanceRuntimeOrchestrator>(INTERACTION_GOVERNANCE_RUNTIME_ORCHESTRATOR_SERVICE_ID);
}
