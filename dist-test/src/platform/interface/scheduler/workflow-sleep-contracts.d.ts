import type { WorkflowSuspensionRecord, WorkflowSuspensionStatus, WorkflowTimeoutPolicy, WorkflowWaitKind } from "./long-running-workflow-service.js";
export interface WorkflowSleepLease {
    readonly suspensionId: string;
    readonly taskId: string;
    readonly workflowId: string;
    readonly executionId: string | null;
    readonly divisionId: string;
    readonly waitKind: WorkflowWaitKind;
    readonly status: WorkflowSuspensionStatus;
    readonly suspendedAt: string;
    readonly resumeAfter: string | null;
    readonly expiresAt: string | null;
    readonly resumableFromStep: string;
    readonly checkpointArtifactId: string | null;
    readonly timeoutPolicy: WorkflowTimeoutPolicy;
    readonly metadata: Record<string, unknown>;
}
export interface WorkflowResumeWindow {
    readonly suspensionId: string;
    readonly taskId: string;
    readonly workflowId: string;
    readonly dueAt: string | null;
    readonly expiresAt: string | null;
    readonly due: boolean;
    readonly expired: boolean;
    readonly nextAction: "wait" | "resume" | "expire";
    readonly timeoutPolicy: WorkflowTimeoutPolicy;
    readonly resumableFromStep: string;
}
export declare function toWorkflowSleepLease(record: WorkflowSuspensionRecord): WorkflowSleepLease;
export declare function toWorkflowResumeWindow(record: WorkflowSuspensionRecord, now: string): WorkflowResumeWindow;
