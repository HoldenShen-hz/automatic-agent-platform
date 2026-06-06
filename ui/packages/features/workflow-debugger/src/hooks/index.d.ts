export interface WorkflowDebuggerVm {
    readonly loading: boolean;
    readonly selectedId: string | null;
    readonly selectedTask: import("@aa/shared-types").TaskDTO | null;
    readonly tasks: readonly import("@aa/shared-types").TaskDTO[];
    readonly listItems: readonly {
        id: string;
        title: string;
        subtitle: string;
    }[];
    readonly detailRows: readonly {
        key: string;
        value: string;
    }[];
    readonly metrics: readonly {
        label: string;
        value: string | number;
    }[];
    readonly activityItems: readonly {
        title: string;
        description: string;
    }[];
    readonly activePanel: "timeline" | "failure" | "export";
    readonly timelineItems: readonly {
        title: string;
        description: string;
    }[];
    readonly failureItems: readonly {
        title: string;
        description: string;
    }[];
    readonly exportSnapshot: string;
    readonly loadError: string | null;
    readonly pendingOperations: number;
    selectTask(taskId: string): void;
    replayTimeline(): Promise<void>;
    focusFailure(): Promise<void>;
    exportDebugSnapshot(): Promise<void>;
}
export declare function prioritizeDebuggerTasks(tasks: readonly import("@aa/shared-types").TaskDTO[]): readonly import("@aa/shared-types").TaskDTO[];
export declare function useWorkflowDebuggerVm(): WorkflowDebuggerVm;
