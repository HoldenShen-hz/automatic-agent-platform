export interface WorkflowDebuggerVm {
    readonly items: readonly {
        title: string;
        description: string;
    }[];
}
export declare function useWorkflowDebuggerVm(): WorkflowDebuggerVm;
