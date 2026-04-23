import type { WorkflowStatus } from "../../contracts/types/status.js";
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import { type WorkflowResumeWindow, type WorkflowSleepLease } from "./workflow-sleep-contracts.js";
export type WorkflowWaitKind = "timer" | "human_input" | "external_event" | "throttled" | "deployment_window";
export type WorkflowSuspensionStatus = "active" | "resumable" | "expired" | "cancelled";
export type WorkflowTimeoutPolicy = "fail_workflow" | "remain_pending";
export interface WorkflowSuspensionRequest {
    readonly taskId: string;
    readonly executionId?: string | null;
    readonly reasonCode: string;
    readonly waitKind: WorkflowWaitKind;
    readonly resumableFromStep: string;
    readonly resumeAfter?: string | null;
    readonly expiresAt?: string | null;
    readonly checkpointArtifactId?: string | null;
    readonly timeoutPolicy: WorkflowTimeoutPolicy;
    readonly metadata?: Record<string, unknown>;
}
export interface WorkflowSuspensionRecord {
    readonly suspensionId: string;
    readonly taskId: string;
    readonly executionId: string | null;
    readonly workflowId: string;
    readonly divisionId: string;
    readonly reasonCode: string;
    readonly waitKind: WorkflowWaitKind;
    readonly status: WorkflowSuspensionStatus;
    readonly suspendedAt: string;
    readonly resumeAfter: string | null;
    readonly expiresAt: string | null;
    readonly checkpointArtifactId: string | null;
    readonly resumableFromStep: string;
    readonly timeoutPolicy: WorkflowTimeoutPolicy;
    readonly metadata: Record<string, unknown>;
}
export interface WorkflowResumeDecision {
    readonly suspensionId: string;
    readonly taskId: string;
    readonly workflowId: string;
    readonly allowed: boolean;
    readonly reasonCode: string;
    readonly nextWorkflowStatus: WorkflowStatus | null;
    readonly resumableFromStep: string;
}
export declare class LongRunningWorkflowService {
    private readonly store;
    private readonly suspensions;
    constructor(store: AuthoritativeTaskStore);
    suspend(request: WorkflowSuspensionRequest): WorkflowSuspensionRecord;
    markDue(now?: string): WorkflowSuspensionRecord[];
    resume(suspensionId: string, now?: string): WorkflowResumeDecision;
    sweepExpired(now?: string): WorkflowResumeDecision[];
    getSuspension(suspensionId: string): WorkflowSuspensionRecord | null;
    listSuspensions(): WorkflowSuspensionRecord[];
    buildSleepLease(suspensionId: string): WorkflowSleepLease;
    buildResumeWindow(suspensionId: string, now?: string): WorkflowResumeWindow;
    listResumeWindows(now?: string): WorkflowResumeWindow[];
    private expire;
    private writeWorkflowStatus;
    private requireWorkflow;
    private requireSuspension;
    private emitWorkflowEvent;
}
