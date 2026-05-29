import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import {
  DOMAINS_RUNTIME_CATALOG_SERVICE_ID,
  registerDomainsRuntimeCatalog,
} from "./domains-runtime-catalog.js";
import {
  DOMAINS_STARTUP_PLAN_SERVICE_ID,
  registerDomainsStartupPlan,
  type DomainsStartupPlan,
  type DomainsStartupStepId,
} from "./domains-startup-plan.js";
import {
  DOMAINS_BOOTSTRAP_SERVICE_ID,
  DOMAIN_RING_BOOTSTRAP_SERVICE_IDS,
  registerDomainsBootstrap,
} from "./domains/domains-bootstrap.js";
import {
  executeStartupPlan,
  snapshotStartupReadiness,
} from "./platform/shared/lifecycle/runtime-orchestrator-support.js";

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

export class DomainsRuntimeOrchestrator {
  private startupPlan: DomainsStartupPlan | undefined;
  private registered = false;

  public constructor(private readonly registry: ServiceRegistry = ServiceRegistry.getInstance()) {}

  public prepare(): DomainsStartupPlan {
    registerDomainsBootstrap(this.registry);
    registerDomainsRuntimeCatalog(this.registry);
    const startupPlan = registerDomainsStartupPlan(this.registry);
    this.startupPlan = startupPlan;
    return startupPlan;
  }

  public startup(): DomainsRuntimeStartupResult {
    const startupPlan = this.prepare();
    const runtime = executeStartupPlan(this.registry, startupPlan, "w5_startup_plan.missing_dependency");
    this.ensureOrchestratorRegistered();
    return {
      ...runtime,
    };
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
      capabilityReadiness: snapshotStartupReadiness(this.registry, startupPlan),
    };
  }

  private ensureOrchestratorRegistered(): DomainsRuntimeOrchestrator {
    if (!this.registered) {
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
    return this.registry.get<DomainsRuntimeOrchestrator>(DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID);
  }
}

export function registerDomainsRuntimeOrchestrator(
  registry: ServiceRegistry = ServiceRegistry.getInstance(),
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
