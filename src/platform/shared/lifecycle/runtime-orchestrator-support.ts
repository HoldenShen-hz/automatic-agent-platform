import { ValidationError } from "../../contracts/errors.js";
import { ServiceRegistry } from "./service-registry.js";

export interface RuntimeStartupPlanStep<StepId extends string> {
  readonly stepId: StepId;
  readonly bootstrapServiceId: string;
  readonly capabilityCount: number;
  readonly dependsOnStepIds: readonly StepId[];
}

export interface RuntimeStartupPlan<
  StepId extends string,
  Step extends RuntimeStartupPlanStep<StepId> = RuntimeStartupPlanStep<StepId>,
> {
  readonly startupOrder: readonly StepId[];
  readonly steps: readonly Step[];
}

export interface RuntimeStartupExecutionStep<StepId extends string> {
  readonly stepId: StepId;
  readonly bootstrapServiceId: string;
  readonly capabilityCount: number;
  readonly initialized: boolean;
  readonly initializedDependencyServiceIds: readonly string[];
}

export interface RuntimeReadinessEntry<StepId extends string> {
  readonly stepId: StepId;
  readonly bootstrapServiceId: string;
  readonly initialized: boolean;
}

export function buildDependencyServiceIds<
  StepId extends string,
  Step extends RuntimeStartupPlanStep<StepId>,
>(
  step: Step,
  plan: RuntimeStartupPlan<StepId, Step>,
  missingDependencyCode: string,
): readonly string[] {
  return step.dependsOnStepIds.map((dependencyStepId) => {
    const dependencyStep = plan.steps.find((candidate) => candidate.stepId === dependencyStepId);
    if (dependencyStep == null) {
      throw new ValidationError(
        missingDependencyCode,
        `${missingDependencyCode}:${dependencyStepId}`,
      );
    }
    return dependencyStep.bootstrapServiceId;
  });
}

export function executeStartupPlan<
  StepId extends string,
  Step extends RuntimeStartupPlanStep<StepId>,
>(
  registry: ServiceRegistry,
  plan: RuntimeStartupPlan<StepId, Step>,
  missingDependencyCode: string,
): {
  readonly ready: boolean;
  readonly startupOrder: readonly StepId[];
  readonly initializedServiceIds: readonly string[];
  readonly steps: readonly RuntimeStartupExecutionStep<StepId>[];
} {
  const steps = plan.steps.map((step) => {
    const initializedDependencyServiceIds = buildDependencyServiceIds(step, plan, missingDependencyCode).filter(
      (serviceId) => registry.isInitialized(serviceId),
    );
    registry.get(step.bootstrapServiceId);
    return {
      stepId: step.stepId,
      bootstrapServiceId: step.bootstrapServiceId,
      capabilityCount: step.capabilityCount,
      initialized: registry.isInitialized(step.bootstrapServiceId),
      initializedDependencyServiceIds,
    };
  });

  return {
    ready: steps.every((step) => step.initialized),
    startupOrder: plan.startupOrder,
    initializedServiceIds: plan.steps
      .map((step) => step.bootstrapServiceId)
      .filter((serviceId) => registry.isInitialized(serviceId)),
    steps,
  };
}

export function snapshotStartupReadiness<
  StepId extends string,
  Step extends RuntimeStartupPlanStep<StepId>,
>(
  registry: ServiceRegistry,
  plan: RuntimeStartupPlan<StepId, Step>,
): readonly RuntimeReadinessEntry<StepId>[] {
  return plan.steps.map((step) => ({
    stepId: step.stepId,
    bootstrapServiceId: step.bootstrapServiceId,
    initialized: registry.isInitialized(step.bootstrapServiceId),
  }));
}
