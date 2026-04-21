export interface ExecutionPlanStep {
    stepId: string;
    title: string;
    actionRef: string;
    dependsOn: string[];
    requiresApproval: boolean;
}
export interface ExecutionPlan {
    planId: string;
    taskId: string;
    tenantId: string | null;
    version: number;
    steps: ExecutionPlanStep[];
    createdAt: string;
}
export declare function createExecutionPlan(input: Omit<ExecutionPlan, "planId" | "createdAt"> & {
    planId?: string;
    createdAt?: string;
}): ExecutionPlan;
