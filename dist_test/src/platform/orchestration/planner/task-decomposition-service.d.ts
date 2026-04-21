import type { PlannedWorkflow } from "../routing/workflow-planner.js";
export interface TaskDecomposition {
    title: string;
    dependsOn: string[];
    ownerRoleId: string;
    toolNames: string[];
}
export declare class TaskDecompositionService {
    decompose(workflow: PlannedWorkflow): TaskDecomposition[];
}
