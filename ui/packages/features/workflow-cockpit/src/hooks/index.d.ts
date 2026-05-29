import type { WorkflowDTO } from "@aa/shared-types";
export interface WorkflowCockpitVm {
    readonly workflows: readonly WorkflowDTO[];
    readonly listItems: readonly {
        id: string;
        title: string;
        subtitle: string;
    }[];
    readonly selectedId: string | null;
    readonly selectedWorkflow: WorkflowDTO | null;
    readonly activityItems: readonly {
        title: string;
        description: string;
    }[];
    readonly pendingOperations: number;
    selectWorkflow(id: string): void;
    cancelWorkflow(): Promise<void>;
    pauseWorkflow(): Promise<void>;
    resumeWorkflow(): Promise<void>;
    recoverWorkflow(): Promise<void>;
    releaseWorkflow(): Promise<void>;
}
export declare function mapWorkflowsToVm(workflows: readonly WorkflowDTO[]): Pick<WorkflowCockpitVm, "workflows" | "listItems">;
export declare function useWorkflowCockpitVm(): WorkflowCockpitVm;
