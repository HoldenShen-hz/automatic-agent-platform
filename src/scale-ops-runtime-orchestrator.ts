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
  type ScaleOpsStartupStep,
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

function buildDependencyServiceIds(
  step: ScaleOpsStartupStep,
  plan: ScaleOpsStartupPlan,
): readonly string[] {
  return step.dependsOnStepIds.map((dependencyStepId) => {
    const dependencyStep = plan.steps.find((candidate) => candidate.stepId === dependencyStepId);
    if (dependencyStep == null) {
      throw new Error(`w4_startup_plan.missing_dependency:${dependencyStepId}`);
    }
    return dependencyStep.bootstrapServiceId;
  });
}

export class ScaleOpsRuntimeOrchestrator {
  public constructor(private readonly registry: ServiceRegistry = ServiceRegistry.getInstance()) {}

  public prepare(): ScaleOpsStartupPlan {
    registerScaleBootstrap(this.registry);
    registerOpsMaturityBootstrap(this.registry);
    registerScaleOpsRuntimeCatalog(this.registry);
    return registerScaleOpsStartupPlan(this.registry);
  }

  public startup(): ScaleOpsRuntimeStartupResult {
    const startupPlan = this.prepare();
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

    return {
      ready: steps.every((step) => step.initialized),
      startupOrder: startupPlan.startupOrder,
      initializedServiceIds: startupPlan.steps
        .map((step) => step.bootstrapServiceId)
        .filter((serviceId) => this.registry.isInitialized(serviceId)),
      steps,
    };
  }

  public snapshotReadiness(): ScaleOpsReadinessSnapshot {
    const startupPlan = buildScaleOpsStartupPlan();
    return {
      runtimeCatalogInitialized: this.registry.isInitialized(SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID),
      startupPlanInitialized: this.registry.isInitialized(SCALE_OPS_STARTUP_PLAN_SERVICE_ID),
      orchestratorInitialized: this.registry.isInitialized(SCALE_OPS_RUNTIME_ORCHESTRATOR_SERVICE_ID),
      capabilityReadiness: startupPlan.steps.map((step) => ({
        stepId: step.stepId,
        bootstrapServiceId: step.bootstrapServiceId,
        initialized: this.registry.isInitialized(step.bootstrapServiceId),
      })),
    };
  }
}

export function registerScaleOpsRuntimeOrchestrator(
  registry: ServiceRegistry = ServiceRegistry.getInstance(),
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
