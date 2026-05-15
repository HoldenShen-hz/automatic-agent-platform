import type { PlanStep } from "../oapeflir/types/index.js";

export interface PlanDagValidationResult {
  valid: boolean;
  issues: string[];
  orderedSteps: PlanStep[];
}

export interface WorstPathAnalysis {
  pathNodeIds: string[];
  estimatedCost: number;
  estimatedTimeoutMs: number;
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
      if (step.title != null && (typeof step.title !== "string" || step.title.trim().length === 0)) {
        issues.push(`planning.missing_title:${step.stepId}`);
      }
      if (!Number.isFinite(step.timeout) || step.timeout <= 0) {
        issues.push(`planning.invalid_timeout:${step.stepId}`);
      }
      if (!Number.isInteger(step.retryPolicy.maxRetries) || step.retryPolicy.maxRetries < 0) {
        issues.push(`planning.invalid_retry_max:${step.stepId}`);
      }
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

    // R8-13 FIX: Check entry node existence (nodes with no incoming edges)
    // A valid DAG must have at least one node with in-degree 0 (entry point)
    const entryNodes: string[] = [];
    incomingCounts.forEach((inCount, nodeId) => {
      if (inCount === 0) entryNodes.push(nodeId);
    });
    if (entryNodes.length === 0 && steps.length > 0) {
      issues.push("planning.no_entry_node");
    }

    // R8-13 FIX: Check terminal node existence (nodes with no outgoing edges)
    // A valid DAG must have at least one node with out-degree 0 (exit point)
    const terminalNodes: string[] = [];
    outgoing.forEach((outEdges, nodeId) => {
      if (outEdges.length === 0) terminalNodes.push(nodeId);
    });
    if (terminalNodes.length === 0 && steps.length > 0) {
      issues.push("planning.no_terminal_node");
    }

    return {
      valid: issues.length === 0,
      issues,
      orderedSteps: orderedSteps.length === steps.length ? orderedSteps : [...steps],
    };
  }

  public analyzeWorstPath(steps: readonly PlanStep[]): WorstPathAnalysis | null {
    if (steps.length === 0) {
      return null;
    }

    const validation = this.validate(steps);
    const orderedSteps = validation.orderedSteps;
    const stepById = new Map(orderedSteps.map((step) => [step.stepId, step]));
    const bestCost = new Map<string, number>();
    const predecessor = new Map<string, string | null>();

    for (const step of orderedSteps) {
      const intrinsicCost = this.estimateStepCost(step);
      if (step.dependencies.length === 0) {
        bestCost.set(step.stepId, intrinsicCost);
        predecessor.set(step.stepId, null);
        continue;
      }

      let bestParentId: string | null = null;
      let bestParentCost = -1;
      for (const dependencyId of step.dependencies) {
        const parentCost = bestCost.get(dependencyId) ?? this.estimateStepCost(stepById.get(dependencyId) ?? step);
        if (parentCost > bestParentCost) {
          bestParentCost = parentCost;
          bestParentId = dependencyId;
        }
      }
      bestCost.set(step.stepId, intrinsicCost + Math.max(0, bestParentCost));
      predecessor.set(step.stepId, bestParentId);
    }

    const tail = [...bestCost.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? orderedSteps[0]?.stepId;
    if (tail == null) {
      return null;
    }

    const pathNodeIds: string[] = [];
    let cursor: string | null = tail;
    while (cursor != null) {
      pathNodeIds.unshift(cursor);
      cursor = predecessor.get(cursor) ?? null;
    }

    const estimatedTimeoutMs = pathNodeIds.reduce((sum, stepId) => sum + (stepById.get(stepId)?.timeout ?? 0), 0);
    return {
      pathNodeIds,
      estimatedCost: estimatedTimeoutMs,
      estimatedTimeoutMs,
    };
  }

  private estimateStepCost(step: PlanStep): number {
    return Math.max(0, step.timeout);
  }
}
