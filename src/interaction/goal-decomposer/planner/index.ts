import { topologicallySortTaskIds, type DependencyEdge } from "../dependency-graph/index.js";

export function buildExecutionBatches(taskIds: readonly string[], edges: readonly DependencyEdge[]): string[][] {
  const ordered = topologicallySortTaskIds(taskIds, edges);
  const batches: string[][] = [];
  const dependenciesByTask = new Map<string, Set<string>>();
  for (const taskId of taskIds) {
    dependenciesByTask.set(taskId, new Set());
  }
  for (const edge of edges) {
    dependenciesByTask.get(edge.toTask)?.add(edge.fromTask);
  }
  const completed = new Set<string>();
  for (const taskId of ordered) {
    const deps = dependenciesByTask.get(taskId) ?? new Set<string>();
    const batch = batches.find((candidate) => candidate.every((item) => !deps.has(item)) && [...deps].every((dep) => completed.has(dep)));
    if (batch != null) {
      batch.push(taskId);
    } else {
      batches.push([taskId]);
    }
    completed.add(taskId);
  }
  return batches;
}
