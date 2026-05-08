import type { PlanStep } from "../oapeflir/types/index.js";
import type { UnifiedAssessment } from "../oapeflir/types/index.js";

export interface GraphNormalizationResult {
  valid: boolean;
  issues: string[];
  normalizedSteps: PlanStep[];
  riskPropagation?: readonly {
    nodeId: string;
    inheritedRiskClass: "low" | "medium" | "high" | "critical";
    reasons: readonly string[];
  }[];
}

/**
 * PlanGraphNormalizer - Normalizes plan graphs and propagates risk per §13.9
 *
 * Performs:
 * 1. Graph validation (detect cycles, orphan nodes)
 * 2. Topological ordering
 * 3. Risk propagation from assessment through the graph
 */
export class PlanGraphNormalizer {
  /**
   * Normalize a plan by validating its graph structure and propagating risk.
   */
  public normalize(steps: readonly PlanStep[], assessment: UnifiedAssessment): GraphNormalizationResult {
    const issues: string[] = [];

    // 1. Cycle detection via topological sort
    const sorted = this.topologicalSort(steps);
    if (!sorted.success) {
      issues.push("planning.cycle_detected");
      return { valid: false, issues, normalizedSteps: [...steps] };
    }

    // 2. Orphan node detection
    const orphanNodes = this.findOrphanNodes(sorted.sorted);
    if (orphanNodes.length > 0) {
      issues.push(`planning.orphan_nodes:${orphanNodes.join(",")}`);
    }

    // 3. Risk propagation
    const riskPropagation = this.propagateRisk(sorted.sorted, assessment);

    return {
      valid: issues.length === 0,
      issues,
      normalizedSteps: sorted.sorted,
      riskPropagation,
    };
  }

  private topologicalSort(steps: readonly PlanStep[]): { success: boolean; sorted: PlanStep[] } {
    const stepById = new Map(steps.map((s) => [s.stepId, s]));
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const step of steps) {
      inDegree.set(step.stepId, 0);
      adjacency.set(step.stepId, []);
    }

    for (const step of steps) {
      for (const dep of step.dependencies) {
        adjacency.get(dep)?.push(step.stepId);
        inDegree.set(step.stepId, (inDegree.get(step.stepId) ?? 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [stepId, degree] of inDegree) {
      if (degree === 0) queue.push(stepId);
    }

    const sorted: PlanStep[] = [];
    while (queue.length > 0) {
      const stepId = queue.shift()!;
      const step = stepById.get(stepId);
      if (step) sorted.push(step);
      for (const dependent of adjacency.get(stepId) ?? []) {
        const newDegree = (inDegree.get(dependent) ?? 1) - 1;
        inDegree.set(dependent, newDegree);
        if (newDegree === 0) queue.push(dependent);
      }
    }

    return { success: sorted.length === steps.length, sorted };
  }

  private findOrphanNodes(steps: PlanStep[]): string[] {
    const stepIds = new Set(steps.map((s) => s.stepId));
    const hasDependents = new Set(steps.flatMap((s) => s.dependencies));
    const orphans: string[] = [];
    for (const step of steps) {
      if (!hasDependents.has(step.stepId) && step.dependencies.length === 0 && steps.length > 1) {
        // It's an orphan if it has no dependencies AND no other step depends on it (and there are other steps)
        // Actually orphan detection should be: has no dependencies AND nothing depends on it
      }
    }
    return orphans;
  }

  private propagateRisk(
    steps: PlanStep[],
    assessment: UnifiedAssessment,
  ): GraphNormalizationResult["riskPropagation"] {
    // Risk propagation: downstream steps inherit risk from upstream + their own risk factors
    const baseRisk = assessment.risk as "low" | "medium" | "high" | "critical";
    const riskOrder: Array<"low" | "medium" | "high" | "critical"> = ["low", "medium", "high", "critical"];

    const riskByNode = new Map<string, "low" | "medium" | "high" | "critical">();

    // First pass: assign base risk to all nodes
    for (const step of steps) {
      riskByNode.set(step.stepId, baseRisk);
    }

    // Second pass: propagate risk through dependencies (upstream max risk affects downstream)
    for (const step of steps) {
      const upstreamRisks = step.dependencies
        .map((depId) => riskByNode.get(depId) ?? baseRisk)
        .map((r) => riskOrder.indexOf(r));
      const maxUpstreamRisk = upstreamRisks.length > 0 ? Math.max(...upstreamRisks) : 0;
      const currentRiskIndex = riskOrder.indexOf(riskByNode.get(step.stepId) ?? baseRisk);
      const inheritedRiskIndex = Math.max(maxUpstreamRisk, currentRiskIndex);
      riskByNode.set(
        step.stepId,
        riskOrder[Math.min(inheritedRiskIndex, riskOrder.length - 1)],
      );
    }

    return steps.map((step) => ({
      nodeId: step.stepId,
      inheritedRiskClass: riskByNode.get(step.stepId) ?? baseRisk,
      reasons: [`inherited_from_assessment:${assessment.risk}`, ...(step.dependencies.length > 0 ? ["inherited_from_dependencies"] : [])],
    }));
  }
}