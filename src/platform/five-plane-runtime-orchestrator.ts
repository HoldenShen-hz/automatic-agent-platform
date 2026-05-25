import { ServiceRegistry } from "./shared/lifecycle/service-registry.js";
import {
  FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID,
  X1_FABRIC_BOOTSTRAP_SERVICE_ID,
  registerFivePlaneRuntimeCatalog,
  type FivePlaneRuntimeCatalog,
} from "./five-plane-runtime-bootstrap.js";
import {
  buildFivePlaneStartupPlan,
  FIVE_PLANE_STARTUP_PLAN_SERVICE_ID,
  registerFivePlaneStartupPlan,
  type FivePlaneStartupPlan,
  type FivePlaneStartupStepId,
} from "./five-plane-startup-plan.js";
import {
  executeStartupPlan,
  snapshotStartupReadiness,
} from "./shared/lifecycle/runtime-orchestrator-support.js";

export const FIVE_PLANE_RUNTIME_ORCHESTRATOR_SERVICE_ID = "plane.runtime.orchestrator";

export interface FivePlaneStartupExecutionStep {
  readonly stepId: FivePlaneStartupStepId;
  readonly bootstrapServiceId: string;
  readonly capabilityCount: number;
  readonly initialized: boolean;
  readonly initializedDependencyServiceIds: readonly string[];
}

export interface FivePlaneRuntimeStartupResult {
  readonly ready: boolean;
  readonly startupOrder: readonly FivePlaneStartupStepId[];
  readonly initializedServiceIds: readonly string[];
  readonly steps: readonly FivePlaneStartupExecutionStep[];
  readonly runtimeCatalog: FivePlaneRuntimeCatalog;
}

export interface FivePlaneRuntimeReadinessSnapshot {
  readonly runtimeCatalogInitialized: boolean;
  readonly startupPlanInitialized: boolean;
  readonly orchestratorInitialized: boolean;
  readonly planeReadiness: readonly {
    readonly stepId: FivePlaneStartupStepId;
    readonly bootstrapServiceId: string;
    readonly initialized: boolean;
  }[];
}

export class FivePlaneRuntimeOrchestrator {
  public constructor(private readonly registry: ServiceRegistry = ServiceRegistry.createScoped()) {}

  public prepare(): { readonly startupPlan: FivePlaneStartupPlan; readonly runtimeCatalog: FivePlaneRuntimeCatalog } {
    const runtimeCatalog = registerFivePlaneRuntimeCatalog(this.registry);
    const startupPlan = registerFivePlaneStartupPlan(this.registry);
    return { startupPlan, runtimeCatalog };
  }

  public startup(): FivePlaneRuntimeStartupResult {
    const { startupPlan, runtimeCatalog } = this.prepare();
    const runtime = executeStartupPlan(this.registry, startupPlan, "five_plane_startup_plan.missing_dependency");

    return {
      ...runtime,
      runtimeCatalog,
    };
  }

  public snapshotReadiness(): FivePlaneRuntimeReadinessSnapshot {
    const startupPlan = buildFivePlaneStartupPlan();
    return {
      runtimeCatalogInitialized: this.registry.isInitialized(FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID),
      startupPlanInitialized: this.registry.isInitialized(FIVE_PLANE_STARTUP_PLAN_SERVICE_ID),
      orchestratorInitialized: this.registry.isInitialized(FIVE_PLANE_RUNTIME_ORCHESTRATOR_SERVICE_ID),
      planeReadiness: snapshotStartupReadiness(this.registry, startupPlan),
    };
  }
}

export function registerFivePlaneRuntimeOrchestrator(
  registry: ServiceRegistry = ServiceRegistry.createScoped(),
): FivePlaneRuntimeOrchestrator {
  registerFivePlaneRuntimeCatalog(registry);
  registerFivePlaneStartupPlan(registry);
  registry.register<FivePlaneRuntimeOrchestrator>(FIVE_PLANE_RUNTIME_ORCHESTRATOR_SERVICE_ID, {
    init: () => new FivePlaneRuntimeOrchestrator(registry),
    dependsOn: [
      FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID,
      X1_FABRIC_BOOTSTRAP_SERVICE_ID,
      FIVE_PLANE_STARTUP_PLAN_SERVICE_ID,
    ],
  });
  return registry.get<FivePlaneRuntimeOrchestrator>(FIVE_PLANE_RUNTIME_ORCHESTRATOR_SERVICE_ID);
}
