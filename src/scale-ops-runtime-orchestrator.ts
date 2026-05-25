import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import {
  SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID,
  registerScaleOpsRuntimeCatalog,
} from "./scale-ops-runtime-catalog.js";
import {
  SCALE_OPS_STARTUP_PLAN_SERVICE_ID,
  buildScaleOpsStartupPlan,
  registerScaleOpsStartupPlan,
  type ScaleOpsStartupPlan,
  type ScaleOpsStartupStepId,
} from "./scale-ops-startup-plan.js";
import {
  SCALE_BOOTSTRAP_SERVICE_ID,
  registerScaleBootstrap,
} from "./scale-ecosystem/scale-bootstrap.js";
import {
  OPS_MATURITY_BOOTSTRAP_SERVICE_ID,
  registerOpsMaturityBootstrap,
} from "./ops-maturity/ops-maturity-bootstrap.js";
import {
  executeStartupPlan,
  snapshotStartupReadiness,
} from "./platform/shared/lifecycle/runtime-orchestrator-support.js";

export const SCALE_OPS_RUNTIME_ORCHESTRATOR_SERVICE_ID = "w4.runtime.orchestrator";

export interface ScaleOpsStartupExecutionStep {
  readonly stepId: ScaleOpsStartupStepId;
  readonly bootstrapServiceId: string;
  readonly capabilityCount: number;
  readonly initialized: boolean;
  readonly initializedDependencyServiceIds: readonly string[];
}

export interface ScaleOpsRuntimeStartupResult {
  readonly ready: boolean;
  readonly startupOrder: readonly ScaleOpsStartupStepId[];
  readonly initializedServiceIds: readonly string[];
  readonly steps: readonly ScaleOpsStartupExecutionStep[];
}

export interface ScaleOpsReadinessSnapshot {
  readonly runtimeCatalogInitialized: boolean;
  readonly startupPlanInitialized: boolean;
  readonly orchestratorInitialized: boolean;
  readonly capabilityReadiness: readonly {
    readonly stepId: ScaleOpsStartupStepId;
    readonly bootstrapServiceId: string;
    readonly initialized: boolean;
  }[];
}

export class ScaleOpsRuntimeOrchestrator {
  public constructor(private readonly registry: ServiceRegistry = ServiceRegistry.createScoped()) {}

  public prepare(): ScaleOpsStartupPlan {
    registerScaleBootstrap(this.registry);
    registerOpsMaturityBootstrap(this.registry);
    registerScaleOpsRuntimeCatalog(this.registry);
    return registerScaleOpsStartupPlan(this.registry);
  }

  public startup(): ScaleOpsRuntimeStartupResult {
    const startupPlan = this.prepare();
    const runtime = executeStartupPlan(this.registry, startupPlan, "w4_startup_plan.missing_dependency");

    return {
      ...runtime,
    };
  }

  public snapshotReadiness(): ScaleOpsReadinessSnapshot {
    const startupPlan = buildScaleOpsStartupPlan();
    return {
      runtimeCatalogInitialized: this.registry.isInitialized(SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID),
      startupPlanInitialized: this.registry.isInitialized(SCALE_OPS_STARTUP_PLAN_SERVICE_ID),
      orchestratorInitialized: this.registry.isInitialized(SCALE_OPS_RUNTIME_ORCHESTRATOR_SERVICE_ID),
      capabilityReadiness: snapshotStartupReadiness(this.registry, startupPlan),
    };
  }
}

export function registerScaleOpsRuntimeOrchestrator(
  registry: ServiceRegistry = ServiceRegistry.createScoped(),
): ScaleOpsRuntimeOrchestrator {
  registerScaleBootstrap(registry);
  registerOpsMaturityBootstrap(registry);
  registerScaleOpsRuntimeCatalog(registry);
  registerScaleOpsStartupPlan(registry);
  registry.register<ScaleOpsRuntimeOrchestrator>(SCALE_OPS_RUNTIME_ORCHESTRATOR_SERVICE_ID, {
    init: () => new ScaleOpsRuntimeOrchestrator(registry),
    dependsOn: [
      SCALE_BOOTSTRAP_SERVICE_ID,
      OPS_MATURITY_BOOTSTRAP_SERVICE_ID,
      SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID,
      SCALE_OPS_STARTUP_PLAN_SERVICE_ID,
    ],
  });
  return registry.get<ScaleOpsRuntimeOrchestrator>(SCALE_OPS_RUNTIME_ORCHESTRATOR_SERVICE_ID);
}
