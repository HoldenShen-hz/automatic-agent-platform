import { topologicallySortTaskIds, type DependencyEdge } from "../dependency-graph/index.js";

export type TaskPriority = "critical" | "high" | "normal" | "low";

export interface PriorityEntry {
  readonly taskId: string;
  readonly priority: TaskPriority;
}

const PRIORITY_RANK: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

/**
 * Build execution batches per §40.2 - Priority-aware topological scheduling.
 *
 * Tasks are first topologically sorted, then grouped into batches where
 * priority determines ordering within each batch level. Critical tasks
 * are placed before high, which are placed before normal and low.
 *
 * @param taskIds - Array of task IDs
 * @param edges - Dependency edges for topological sorting
 * @param priorities - Optional map of taskId to priority for priority-aware batching
 */
export function buildExecutionBatches(
  taskIds: readonly string[],
  edges: readonly DependencyEdge[],
  priorities?: readonly PriorityEntry[],
): string[][] {
  const ordered = topologicallySortTaskIds(taskIds, edges);
  const prioritiesMap = new Map<string, TaskPriority>(
    priorities?.map((p) => [p.taskId, p.priority]) ?? [],
  );
  const batches: string[][] = [];
  const dependenciesByTask = new Map<string, Set<string>>();
  for (const taskId of taskIds) {
    dependenciesByTask.set(taskId, new Set<string>());
  }
  for (const edge of edges) {
    dependenciesByTask.get(edge.toTask)?.add(edge.fromTask);
  }

  // Group tasks by priority for priority-aware batching
  const priorityGroups = new Map<TaskPriority, string[]>();
  for (const taskId of ordered) {
    const priority = prioritiesMap.get(taskId) ?? "normal";
    const group = priorityGroups.get(priority) ?? [];
    group.push(taskId);
    priorityGroups.set(priority, group);
  }

  // Build task priority ranking function
  const taskPriority = (taskId: string): number => PRIORITY_RANK[prioritiesMap.get(taskId) ?? "normal"];

  // Process priority levels from highest to lowest, building batches
  for (const priorityLevel of (["critical", "high", "normal", "low"] as TaskPriority[])) {
    const tasksAtPriority = priorityGroups.get(priorityLevel) ?? [];
    for (const taskId of tasksAtPriority) {
      const deps = dependenciesByTask.get(taskId) ?? new Set<string>();

      // Find the earliest batch where all dependencies come BEFORE this task
      let targetBatchIndex = 0;
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]!;
        const hasDepInBatch = [...deps].some((dep) => batch.includes(dep));
        if (hasDepInBatch) {
          // Some dependency is in this batch, need to go to a later batch
          targetBatchIndex = i + 1;
        }
      }

      // Insert task into the target batch, maintaining priority order within batch
      while (batches.length <= targetBatchIndex) {
        batches.push([]);
      }
      const targetBatch = batches[targetBatchIndex]!;
      // Insert before any lower-priority tasks in the same batch
      const insertIndex = targetBatch.findIndex(
        (existingId) => taskPriority(existingId) > taskPriority(taskId),
      );
      if (insertIndex === -1) {
        targetBatch.push(taskId);
      } else {
        targetBatch.splice(insertIndex, 0, taskId);
      }
    }
  }

  return batches;
}