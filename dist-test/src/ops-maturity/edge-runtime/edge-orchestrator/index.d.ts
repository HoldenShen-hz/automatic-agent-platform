export interface EdgeExecutionPlan {
    readonly orderedTaskIds: readonly string[];
    readonly syncRequired: boolean;
    readonly priority: "low" | "normal" | "high";
}
export declare function buildEdgeExecutionPlan(taskIds: readonly string[], priority?: EdgeExecutionPlan["priority"]): EdgeExecutionPlan;
