import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import {
  DOMAINS_RUNTIME_CATALOG_SERVICE_ID,
  registerDomainsRuntimeCatalog,
} from "./domains-runtime-catalog.js";
import {
  DOMAINS_STARTUP_PLAN_SERVICE_ID,
  buildDomainsStartupPlan,
  registerDomainsStartupPlan,
  type DomainsStartupPlan,
  type DomainsStartupStep,
  type DomainsStartupStepId,
} from "./domains-startup-plan.js";
import {
  DOMAINS_BOOTSTRAP_SERVICE_ID,
  DOMAIN_RING_BOOTSTRAP_SERVICE_IDS,
  registerDomainsBootstrap,
} from "./domains/domains-bootstrap.js";
import { ValidationError } from "./platform/contracts/errors.js";

export const DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID = "w5.runtime.orchestrator";

export interface DomainsStartupExecutionStep {
  readonly stepId: DomainsStartupStepId;
  readonly bootstrapServiceId: string;
  readonly capabilityCount: number;
  readonly initialized: boolean;
  readonly initializedDependencyServiceIds: readonly string[];
}

export interface DomainsRuntimeStartupResult {
  readonly ready: boolean;
  readonly startupOrder: readonly DomainsStartupStepId[];
  readonly initializedServiceIds: readonly string[];
  readonly steps: readonly DomainsStartupExecutionStep[];
}

export interface DomainsReadinessSnapshot {
  readonly runtimeCatalogInitialized: boolean;
  readonly startupPlanInitialized: boolean;
  readonly orchestratorInitialized: boolean;
  readonly capabilityReadiness: readonly {
    readonly stepId: DomainsStartupStepId;
    readonly bootstrapServiceId: string;
    readonly initialized: boolean;
  }[];
}

function buildDependencyServiceIds(
  step: DomainsStartupStep,
  plan: DomainsStartupPlan,
): readonly string[] {
  return step.dependsOnStepIds.map((dependencyStepId) => {
    const dependencyStep = plan.steps.find((candidate) => candidate.stepId === dependencyStepId);
    if (dependencyStep == null) {
      throw new ValidationError(
        "w5_startup_plan.missing_dependency",
        `w5_startup_plan.missing_dependency:${dependencyStepId}`,
      );
    }
    return dependencyStep.bootstrapServiceId;
  });
}

export class DomainsRuntimeOrchestrator {
  private startupPlan: DomainsStartupPlan | undefined;
  private registered = false;

  public constructor(private readonly registry: ServiceRegistry = ServiceRegistry.createScoped()) {}

  public prepare(): DomainsStartupPlan {
    registerDomainsBootstrap(this.registry);
    registerDomainsRuntimeCatalog(this.registry);
    const startupPlan = registerDomainsStartupPlan(this.registry);
    this.startupPlan = startupPlan;
    return startupPlan;
  }

  public startup(): DomainsRuntimeStartupResult {
    const startupPlan = this.prepare();
    this.startupPlan = startupPlan;
    const steps = startupPlan.steps.map((step) => {
      const initializedDependencyServiceIds = buildDependencyServiceIds(step, startupPlan).filter((serviceId) =>
        this.registry.isInitialized(serviceId),
      );
      this.registry.get(step.bootstrapServiceId);
      return {
        stepId: step.stepId,
        bootstrapServiceId: step.bootstrapServiceId,
        capabilityCount: step.capabilityCount,
        initialized: this.registry.isInitialized(step.bootstrapServiceId),
        initializedDependencyServiceIds,
      };
    });

    const result: DomainsRuntimeStartupResult = {
      ready: steps.every((step) => step.initialized),
      startupOrder: startupPlan.startupOrder,
      initializedServiceIds: startupPlan.steps
        .map((step) => step.bootstrapServiceId)
        .filter((serviceId) => this.registry.isInitialized(serviceId)),
      steps,
    };
    this.registerOrchestrator();
    this.registry.get(DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID);

    return result;
  }

  public snapshotReadiness(): DomainsReadinessSnapshot {
    const startupPlan = this.startupPlan
      ?? (this.registry.isInitialized(DOMAINS_STARTUP_PLAN_SERVICE_ID)
        ? this.registry.get<DomainsStartupPlan>(DOMAINS_STARTUP_PLAN_SERVICE_ID)
        : this.prepare());
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

  private registerOrchestrator(): void {
    if (this.registered) {
      return;
    }
    this.registry.register<DomainsRuntimeOrchestrator>(DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID, {
      init: () => this,
      dependsOn: [
        DOMAINS_BOOTSTRAP_SERVICE_ID,
        ...Object.values(DOMAIN_RING_BOOTSTRAP_SERVICE_IDS),
        DOMAINS_RUNTIME_CATALOG_SERVICE_ID,
        DOMAINS_STARTUP_PLAN_SERVICE_ID,
      ],
    });
    this.registered = true;
  }
}

export function registerDomainsRuntimeOrchestrator(
  registry: ServiceRegistry = ServiceRegistry.createScoped(),
): DomainsRuntimeOrchestrator {
  registerDomainsBootstrap(registry);
  registerDomainsRuntimeCatalog(registry);
  registerDomainsStartupPlan(registry);
  registry.register<DomainsRuntimeOrchestrator>(DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID, {
    init: () => new DomainsRuntimeOrchestrator(registry),
    dependsOn: [
      DOMAINS_BOOTSTRAP_SERVICE_ID,
      ...Object.values(DOMAIN_RING_BOOTSTRAP_SERVICE_IDS),
      DOMAINS_RUNTIME_CATALOG_SERVICE_ID,
      DOMAINS_STARTUP_PLAN_SERVICE_ID,
    ],
  });
  return registry.get<DomainsRuntimeOrchestrator>(DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID);
}
