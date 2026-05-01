/**
 * EdgePlanGraphBundle - Edge runtime execution plan with explicit graph structure.
 *
 * @deprecated Edge runtime should use PlanGraphBundle for DAG-based execution.
 * Linear orderedTaskIds is for simple single-task edge scenarios only.
 * For full DAG support, migrate to PlanGraphBundle per R6-22.
 */
export interface EdgePlanGraphBundle {
  readonly orderedTaskIds: readonly string[];
  readonly syncRequired: boolean;
  readonly priority: "low" | "normal" | "high";
}

/** @deprecated compatibility export; use EdgePlanGraphBundle */
export type EdgeExecutionPlan = EdgePlanGraphBundle;

export function buildEdgeExecutionPlan(
  taskIds: readonly string[],
  priority: EdgePlanGraphBundle["priority"] = "normal",
): EdgePlanGraphBundle {
  return {
    orderedTaskIds: [...taskIds],
    syncRequired: true,
    priority,
  };
}
