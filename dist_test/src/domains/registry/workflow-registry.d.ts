import type { WorkflowConfig } from "./domain-model.js";
export declare class WorkflowRegistry {
    private readonly workflows;
    registerAll(workflows: readonly WorkflowConfig[]): void;
    get(workflowId: string): WorkflowConfig | null;
    list(): WorkflowConfig[];
}
