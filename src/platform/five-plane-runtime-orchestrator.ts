import { ServiceRegistry } from "./shared/lifecycle/service-registry.js";
import {
  FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID,
  registerFivePlaneRuntimeCatalog,
  type FivePlaneRuntimeCatalog,
} from "./five-plane-runtime-bootstrap.js";
import {
  buildFivePlaneStartupPlan,
  FIVE_PLANE_STARTUP_PLAN_SERVICE_ID,
  registerFivePlaneStartupPlan,
  type FivePlaneStartupPlan,
  type FivePlaneStartupStep,
  type FivePlaneStartupStepId,
} from "./five-plane-startup-plan.js";

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

function buildDependencyServiceIds(
  step: FivePlaneStartupStep,
  plan: FivePlaneStartupPlan,
): readonly string[] {
  return step.dependsOnStepIds.map((dependencyStepId) => {
    const dependencyStep = plan.steps.find((candidate) => candidate.stepId === dependencyStepId);
    if (dependencyStep == null) {
      throw new Error(`five_plane_startup_plan.missing_dependency:${dependencyStepId}`);
    }
    return dependencyStep.bootstrapServiceId;
  });
}

export class FivePlaneRuntimeOrchestrator {
  public constructor(private readonly registry: ServiceRegistry = ServiceRegistry.getInstance()) {}

  public prepare(): { readonly startupPlan: FivePlaneStartupPlan; readonly runtimeCatalog: FivePlaneRuntimeCatalog } {
    const runtimeCatalog = registerFivePlaneRuntimeCatalog(this.registry);
    const startupPlan = registerFivePlaneStartupPlan(this.registry);
    return { startupPlan, runtimeCatalog };
  }

  public startup(): FivePlaneRuntimeStartupResult {
    const { startupPlan, runtimeCatalog } = this.prepare();

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
      runtimeCatalog,
    };
  }

  public snapshotReadiness(): FivePlaneRuntimeReadinessSnapshot {
    const startupPlan = buildFivePlaneStartupPlan();
    return {
      runtimeCatalogInitialized: this.registry.isInitialized(FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID),
      startupPlanInitialized: this.registry.isInitialized(FIVE_PLANE_STARTUP_PLAN_SERVICE_ID),
      orchestratorInitialized: this.registry.isInitialized(FIVE_PLANE_RUNTIME_ORCHESTRATOR_SERVICE_ID),
      planeReadiness: startupPlan.steps.map((step) => ({
        stepId: step.stepId,
        bootstrapServiceId: step.bootstrapServiceId,
        initialized: this.registry.isInitialized(step.bootstrapServiceId),
      })),
    };
  }
}

export function registerFivePlaneRuntimeOrchestrator(
  registry: ServiceRegistry = ServiceRegistry.getInstance(),
): FivePlaneRuntimeOrchestrator {
  registerFivePlaneRuntimeCatalog(registry);
  registerFivePlaneStartupPlan(registry);
  registry.register<FivePlaneRuntimeOrchestrator>(FIVE_PLANE_RUNTIME_ORCHESTRATOR_SERVICE_ID, {
    init: () => new FivePlaneRuntimeOrchestrator(registry),
    dependsOn: [FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID, FIVE_PLANE_STARTUP_PLAN_SERVICE_ID],
  });
  return registry.get<FivePlaneRuntimeOrchestrator>(FIVE_PLANE_RUNTIME_ORCHESTRATOR_SERVICE_ID);
}
