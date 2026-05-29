import type { TaskDTO, WorkflowRunStepDTO } from "@aa/shared-types";
type TimelineItem = {
    title: string;
    description: string;
};
type EvidenceItem = {
    id: string;
    type: string;
    description: string;
};
export interface TaskCockpitVm {
    readonly tasks: readonly TaskDTO[];
    readonly listItems: readonly {
        id: string;
        title: string;
        subtitle: string;
    }[];
    readonly selectedId: string | null;
    readonly selectedTask: (TaskDTO & {
        resourceUsage?: {
            cpuPercent?: number;
            memoryMb?: number;
            runtimeMinutes?: number;
        };
    }) | null;
    readonly timelineItems: readonly TimelineItem[];
    readonly drillDownSteps: readonly WorkflowRunStepDTO[];
    readonly pendingOperations: number;
    readonly stepViewer: {
        readonly steps: readonly WorkflowRunStepDTO[];
        readonly selectedStep: WorkflowRunStepDTO | null;
        readonly stepOutputs: readonly string[];
        selectStep(stepId: string): void;
    };
    readonly evidenceViewer: {
        readonly evidenceChain: readonly EvidenceItem[];
        readonly loading: boolean;
    };
    readonly timelineViewer: {
        readonly timelineEvents: readonly {
            id: string;
            title: string;
            description: string;
        }[];
        readonly expandedEventId: string | null;
        expandEvent(eventId: string): void;
    };
    selectTask(id: string): void;
    claimTask(operator?: string): Promise<void>;
    pauseTask(): Promise<void>;
    cancelTask(): Promise<void>;
    retryTask(): Promise<void>;
    resumeTask(mode: "normal" | "supervised"): Promise<void>;
    escalateTask(target?: string): Promise<void>;
    fetchTaskDrillDown(taskId: string): Promise<void>;
}
export declare function mapTasksToVm(tasks: readonly TaskDTO[]): readonly {
    id: string;
    title: string;
    subtitle: string;
}[];
export declare function useTaskCockpitVm(): TaskCockpitVm;
export {};
