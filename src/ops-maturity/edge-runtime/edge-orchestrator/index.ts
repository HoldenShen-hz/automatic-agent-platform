export interface EdgeExecutionPlan {
  readonly orderedTaskIds: readonly string[];
  readonly syncRequired: boolean;
  readonly priority: "low" | "normal" | "high";
}

export function buildEdgeExecutionPlan(taskIds: readonly string[], priority: EdgeExecutionPlan["priority"] = "normal"): EdgeExecutionPlan {
  return {
    orderedTaskIds: [...taskIds],
    syncRequired: true,
    priority,
  };
}
