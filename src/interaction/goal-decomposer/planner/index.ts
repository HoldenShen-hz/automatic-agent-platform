import { topologicallySortTaskIds, type DependencyEdge } from "../dependency-graph/index.js";

export interface BuildExecutionBatchesOptions {
  readonly priorities?: Readonly<Record<string, number>>;
  readonly priorityLabels?: Readonly<Record<string, "low" | "normal" | "high" | "critical">>;
  /**
   * Task priority values from Goal.priority.
   * Used to boost critical/high priority tasks within the same dependency level.
   */
  readonly taskPriorities?: Readonly<Record<string, "low" | "normal" | "high" | "critical">>;
}

const PRIORITY_LABEL_WEIGHTS: Readonly<Record<NonNullable<BuildExecutionBatchesOptions["priorityLabels"]>[string], number>> = {
  low: 100,
  normal: 200,
  high: 300,
  critical: 400,
};

const PRIORITY_BOOST_FACTOR: Readonly<Record<string, number>> = {
  critical: 1.5,
  high: 1.2,
  normal: 1.0,
  low: 0.8,
};

function computeTaskScore(taskId: string, originalOrderIndex: number, options: BuildExecutionBatchesOptions): number {
  const priorities = options.priorities ?? {};
  const priorityLabels = options.priorityLabels ?? {};
  const taskPriorities = options.taskPriorities ?? {};

  // Base score from explicit priority value
  const explicitPriority = priorities[taskId] ?? 0;

  // Label-based priority weight
  const labelWeight = PRIORITY_LABEL_WEIGHTS[priorityLabels[taskId] ?? "normal"] ?? 200;

  // Goal.priority-based boost factor
  const taskPriorityLabel = taskPriorities[taskId] ?? "normal";
  const boostFactor = PRIORITY_BOOST_FACTOR[taskPriorityLabel] ?? 1.0;

  // Combine: higher priority tasks get boosted effective weight
  const effectivePriority = explicitPriority > 0
    ? explicitPriority * boostFactor
    : labelWeight * boostFactor;

  // Original topological order as tiebreaker
  return effectivePriority * 1000 + (1000 - originalOrderIndex);
}

export function buildExecutionBatches(
  taskIds: readonly string[],
  edges: readonly DependencyEdge[],
  options: BuildExecutionBatchesOptions = {},
): string[][] {
  if (taskIds.length === 0) {
    return [];
  }
  const order = topologicallySortTaskIds(taskIds, edges);
  const originalOrder = new Map(order.map((taskId, index) => [taskId, index]));
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const taskId of taskIds) {
    indegree.set(taskId, 0);
    adjacency.set(taskId, []);
  }
  for (const edge of edges) {
    indegree.set(edge.toTask, (indegree.get(edge.toTask) ?? 0) + 1);
    adjacency.set(edge.fromTask, [...(adjacency.get(edge.fromTask) ?? []), edge.toTask]);
  }

  const sortReady = (items: readonly string[]): string[] => [...items].sort((left, right) => {
    const leftScore = computeTaskScore(left, originalOrder.get(left) ?? 0, options);
    const rightScore = computeTaskScore(right, originalOrder.get(right) ?? 0, options);
    const scoreDelta = rightScore - leftScore;
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    return (originalOrder.get(left) ?? 0) - (originalOrder.get(right) ?? 0);
  });

  let ready = sortReady(taskIds.filter((taskId) => (indegree.get(taskId) ?? 0) === 0));
  const batches: string[][] = [];

  while (ready.length > 0) {
    const batch = ready;
    batches.push(batch);
    const nextReady: string[] = [];
    for (const taskId of batch) {
      for (const downstream of adjacency.get(taskId) ?? []) {
        const nextInDegree = (indegree.get(downstream) ?? 0) - 1;
        indegree.set(downstream, nextInDegree);
        if (nextInDegree === 0) {
          nextReady.push(downstream);
        }
      }
    }
    ready = sortReady(nextReady);
  }
  return batches;
}
