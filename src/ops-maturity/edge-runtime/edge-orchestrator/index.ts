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
