import type { PlanStep } from "../oapeflir/types/index.js";

export interface PlanDagValidationResult {
  valid: boolean;
  issues: string[];
  orderedSteps: PlanStep[];
}

export class PlanDagValidator {
  public validate(steps: readonly PlanStep[]): PlanDagValidationResult {
    const stepById = new Map(steps.map((step) => [step.stepId, step]));
    const issues: string[] = [];
    const incomingCounts = new Map<string, number>();
    const outgoing = new Map<string, string[]>();

    for (const step of steps) {
      incomingCounts.set(step.stepId, 0);
      outgoing.set(step.stepId, []);
    }

    for (const step of steps) {
      for (const dependencyId of step.dependencies) {
        if (dependencyId === step.stepId) {
          issues.push(`planning.self_dependency:${step.stepId}`);
          continue;
        }
        if (!stepById.has(dependencyId)) {
          issues.push(`planning.missing_dependency:${step.stepId}:${dependencyId}`);
          continue;
        }
        incomingCounts.set(step.stepId, (incomingCounts.get(step.stepId) ?? 0) + 1);
        outgoing.get(dependencyId)?.push(step.stepId);
      }
    }

    const readyQueue = steps
      .filter((step) => (incomingCounts.get(step.stepId) ?? 0) === 0)
      .map((step) => step.stepId);
    const orderedSteps: PlanStep[] = [];

    while (readyQueue.length > 0) {
      const nextStepId = readyQueue.shift()!;
      const nextStep = stepById.get(nextStepId);
      if (!nextStep) {
        continue;
      }
      orderedSteps.push(nextStep);
      for (const dependentId of outgoing.get(nextStepId) ?? []) {
        const nextIncoming = (incomingCounts.get(dependentId) ?? 0) - 1;
        incomingCounts.set(dependentId, nextIncoming);
        if (nextIncoming === 0) {
          readyQueue.push(dependentId);
        }
      }
    }

    if (orderedSteps.length !== steps.length) {
      issues.push("planning.cycle_detected");
    }

    return {
      valid: issues.length === 0,
      issues,
      orderedSteps: orderedSteps.length === steps.length ? orderedSteps : [...steps],
    };
  }
}
