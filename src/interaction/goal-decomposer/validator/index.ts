import type { GoalDecomposition } from "../index.js";
import { detectDependencyCycle } from "../dependency-graph/index.js";

export function validateGoalDecomposition(input: GoalDecomposition): string[] {
  const findings: string[] = [];
  if (input.tasks.length === 0) {
    findings.push("goal_decomposition.empty_tasks");
  }
  if (input.decompositionConfidence < 0 || input.decompositionConfidence > 1) {
    findings.push("goal_decomposition.invalid_confidence");
  }
  const taskIds = input.tasks.map((item) => item.taskId);
  const edges = input.dependencyGraph.map((item) => ({ fromTask: item.fromTask, toTask: item.toTask }));
  if (detectDependencyCycle(taskIds, edges)) {
    findings.push("goal_decomposition.cycle_detected");
  }
  return findings;
}
