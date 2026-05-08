import { topologicallySortTaskIds, type DependencyEdge } from "../dependency-graph/index.js";

export interface BuildExecutionBatchesOptions {
  readonly priorities?: Readonly<Record<string, number>>;
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
  const priorities = options.priorities ?? {};
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
    const priorityDelta = (priorities[right] ?? 0) - (priorities[left] ?? 0);
    if (priorityDelta !== 0) {
      return priorityDelta;
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
