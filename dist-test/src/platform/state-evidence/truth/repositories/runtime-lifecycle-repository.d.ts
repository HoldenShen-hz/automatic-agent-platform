import type { ApprovalRecord, EventRecord, WorkflowStateRecord } from "../../../contracts/types/domain.js";
import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
import { AuthoritativeTaskStore } from "../authoritative-task-store.js";
/**
 * Repository interface for runtime lifecycle operations.
 * Defines the contract for updating task, workflow, session, and execution state.
 */
export interface RuntimeLifecycleRepository {
    updateTaskStatus(taskId: string, status: string, updatedAt: string, errorCode?: string | null, completedAt?: string | null): void;
    updateTaskStatusCas(taskId: string, expectedStatus: string, status: string, updatedAt: string, errorCode?: string | null, completedAt?: string | null): number;
    updateTaskOutput(taskId: string, outputJson: string, updatedAt: string): void;
    updateWorkflowState(taskId: string, status: string, currentStepIndex: number, outputsJson: string, updatedAt: string, resumableFromStep?: string | null): void;
    updateWorkflowStateCas(taskId: string, expectedVersion: number, expectedStatus: string, status: string, currentStepIndex: number, outputsJson: string, updatedAt: string, resumableFromStep?: string | null): number;
    getWorkflowState(taskId: string): WorkflowStateRecord | null;
    updateSessionStatus(sessionId: string, status: string, updatedAt: string): void;
    updateSessionStatusCas(sessionId: string, expectedStatus: string, status: string, updatedAt: string): number;
    updateExecutionStatus(executionId: string, status: string, updatedAt: string, startedAt?: string | null, finishedAt?: string | null, lastErrorCode?: string | null): void;
    updateExecutionStatusCas(executionId: string, expectedStatus: string, status: string, updatedAt: string, startedAt?: string | null, finishedAt?: string | null, lastErrorCode?: string | null): number;
    createTier1StatusEvent(input: {
        taskId: string;
        executionId: string | null;
        eventType: string;
        traceId: string;
        payload: Record<string, unknown>;
    }): EventRecord;
    insertApproval(approval: ApprovalRecord): void;
    getApproval(approvalId: string): ApprovalRecord | null;
    listApprovalsByTask(taskId: string): ApprovalRecord[];
    updateApprovalDecision(input: {
        approvalId: string;
        status: ApprovalRecord["status"];
        responseJson: string;
        respondedAt: string;
    }): void;
    updateApprovalDecisionCas(input: {
        approvalId: string;
        expectedStatus: ApprovalRecord["status"];
        status: ApprovalRecord["status"];
        responseJson: string;
        respondedAt: string;
    }): number;
    updateApprovalRequest(input: {
        id: string;
        requestJson: string;
    }): void;
    insertEvent(event: Omit<EventRecord, "eventTier" | "sessionId"> & {
        eventTier?: EventRecord["eventTier"];
        sessionId?: string | null;
    }): EventRecord;
}
/**
 * Direct implementation of RuntimeLifecycleRepository backed by AuthoritativeTaskStore.
 * This is the base implementation that other decorators wrap.
 */
export declare class AuthoritativeTaskStoreRuntimeLifecycleRepository implements RuntimeLifecycleRepository {
    private readonly store;
    constructor(store: AuthoritativeTaskStore);
    updateTaskStatus(taskId: string, status: string, updatedAt: string, errorCode?: string | null, completedAt?: string | null): void;
    updateTaskStatusCas(taskId: string, expectedStatus: string, status: string, updatedAt: string, errorCode?: string | null, completedAt?: string | null): number;
    updateTaskOutput(taskId: string, outputJson: string, updatedAt: string): void;
    updateWorkflowState(taskId: string, status: string, currentStepIndex: number, outputsJson: string, updatedAt: string, resumableFromStep?: string | null): void;
    updateWorkflowStateCas(taskId: string, expectedVersion: number, expectedStatus: string, status: string, currentStepIndex: number, outputsJson: string, updatedAt: string, resumableFromStep?: string | null): number;
    getWorkflowState(taskId: string): WorkflowStateRecord | null;
    updateSessionStatus(sessionId: string, status: string, updatedAt: string): void;
    updateSessionStatusCas(sessionId: string, expectedStatus: string, status: string, updatedAt: string): number;
    updateExecutionStatus(executionId: string, status: string, updatedAt: string, startedAt?: string | null, finishedAt?: string | null, lastErrorCode?: string | null): void;
    updateExecutionStatusCas(executionId: string, expectedStatus: string, status: string, updatedAt: string, startedAt?: string | null, finishedAt?: string | null, lastErrorCode?: string | null): number;
    createTier1StatusEvent(input: {
        taskId: string;
        executionId: string | null;
        eventType: string;
        traceId: string;
        payload: Record<string, unknown>;
    }): EventRecord;
    insertApproval(approval: ApprovalRecord): void;
    getApproval(approvalId: string): ApprovalRecord | null;
    listApprovalsByTask(taskId: string): ApprovalRecord[];
    updateApprovalDecision(input: {
        approvalId: string;
        status: ApprovalRecord["status"];
        responseJson: string;
        respondedAt: string;
    }): void;
    updateApprovalDecisionCas(input: {
        approvalId: string;
        expectedStatus: ApprovalRecord["status"];
        status: ApprovalRecord["status"];
        responseJson: string;
        respondedAt: string;
    }): number;
    updateApprovalRequest(input: {
        id: string;
        requestJson: string;
    }): void;
    insertEvent(event: Omit<EventRecord, "eventTier" | "sessionId"> & {
        eventTier?: EventRecord["eventTier"];
        sessionId?: string | null;
    }): EventRecord;
}
/**
 * Retry decorator for RuntimeLifecycleRepository.
 * Automatically retries operations that fail with SQLite BUSY errors.
 */
export declare class RetryingRuntimeLifecycleRepository implements RuntimeLifecycleRepository {
    private readonly inner;
    private readonly options;
    constructor(inner: RuntimeLifecycleRepository, options?: {
        maxAttempts?: number | undefined;
    });
    /**
     * Executes an operation with automatic retry on SQLite BUSY errors.
     * @param operation - Name of the operation for logging
     * @param work - The work to execute
     * @returns The result of the work function
     */
    private run;
    updateTaskStatus(taskId: string, status: string, updatedAt: string, errorCode?: string | null, completedAt?: string | null): void;
    updateTaskStatusCas(taskId: string, expectedStatus: string, status: string, updatedAt: string, errorCode?: string | null, completedAt?: string | null): number;
    updateTaskOutput(taskId: string, outputJson: string, updatedAt: string): void;
    updateWorkflowState(taskId: string, status: string, currentStepIndex: number, outputsJson: string, updatedAt: string, resumableFromStep?: string | null): void;
    updateWorkflowStateCas(taskId: string, expectedVersion: number, expectedStatus: string, status: string, currentStepIndex: number, outputsJson: string, updatedAt: string, resumableFromStep?: string | null): number;
    updateSessionStatus(sessionId: string, status: string, updatedAt: string): void;
    getWorkflowState(taskId: string): WorkflowStateRecord | null;
    updateSessionStatusCas(sessionId: string, expectedStatus: string, status: string, updatedAt: string): number;
    updateExecutionStatus(executionId: string, status: string, updatedAt: string, startedAt?: string | null, finishedAt?: string | null, lastErrorCode?: string | null): void;
    updateExecutionStatusCas(executionId: string, expectedStatus: string, status: string, updatedAt: string, startedAt?: string | null, finishedAt?: string | null, lastErrorCode?: string | null): number;
    createTier1StatusEvent(input: {
        taskId: string;
        executionId: string | null;
        eventType: string;
        traceId: string;
        payload: Record<string, unknown>;
    }): EventRecord;
    insertApproval(approval: ApprovalRecord): void;
    getApproval(approvalId: string): ApprovalRecord | null;
    listApprovalsByTask(taskId: string): ApprovalRecord[];
    updateApprovalDecision(input: {
        approvalId: string;
        status: ApprovalRecord["status"];
        responseJson: string;
        respondedAt: string;
    }): void;
    updateApprovalDecisionCas(input: {
        approvalId: string;
        expectedStatus: ApprovalRecord["status"];
        status: ApprovalRecord["status"];
        responseJson: string;
        respondedAt: string;
    }): number;
    updateApprovalRequest(input: {
        id: string;
        requestJson: string;
    }): void;
    insertEvent(event: Omit<EventRecord, "eventTier" | "sessionId"> & {
        eventTier?: EventRecord["eventTier"];
        sessionId?: string | null;
    }): EventRecord;
}
/**
 * Observing decorator for RuntimeLifecycleRepository.
 * Logs all operations with their duration and success/failure status.
 */
export declare class ObservedRuntimeLifecycleRepository implements RuntimeLifecycleRepository {
    private readonly inner;
    private readonly logger;
    constructor(inner: RuntimeLifecycleRepository, logger?: StructuredLogger);
    /**
     * Observes an operation, logging its execution time and result.
     * @param operation - Name of the operation for logging
     * @param work - The work to execute
     * @returns The result of the work function
     */
    private observe;
    updateTaskStatus(taskId: string, status: string, updatedAt: string, errorCode?: string | null, completedAt?: string | null): void;
    updateTaskStatusCas(taskId: string, expectedStatus: string, status: string, updatedAt: string, errorCode?: string | null, completedAt?: string | null): number;
    updateTaskOutput(taskId: string, outputJson: string, updatedAt: string): void;
    updateWorkflowState(taskId: string, status: string, currentStepIndex: number, outputsJson: string, updatedAt: string, resumableFromStep?: string | null): void;
    updateWorkflowStateCas(taskId: string, expectedVersion: number, expectedStatus: string, status: string, currentStepIndex: number, outputsJson: string, updatedAt: string, resumableFromStep?: string | null): number;
    updateSessionStatus(sessionId: string, status: string, updatedAt: string): void;
    getWorkflowState(taskId: string): WorkflowStateRecord | null;
    updateSessionStatusCas(sessionId: string, expectedStatus: string, status: string, updatedAt: string): number;
    updateExecutionStatus(executionId: string, status: string, updatedAt: string, startedAt?: string | null, finishedAt?: string | null, lastErrorCode?: string | null): void;
    updateExecutionStatusCas(executionId: string, expectedStatus: string, status: string, updatedAt: string, startedAt?: string | null, finishedAt?: string | null, lastErrorCode?: string | null): number;
    createTier1StatusEvent(input: {
        taskId: string;
        executionId: string | null;
        eventType: string;
        traceId: string;
        payload: Record<string, unknown>;
    }): EventRecord;
    insertApproval(approval: ApprovalRecord): void;
    getApproval(approvalId: string): ApprovalRecord | null;
    listApprovalsByTask(taskId: string): ApprovalRecord[];
    updateApprovalDecision(input: {
        approvalId: string;
        status: ApprovalRecord["status"];
        responseJson: string;
        respondedAt: string;
    }): void;
    updateApprovalDecisionCas(input: {
        approvalId: string;
        expectedStatus: ApprovalRecord["status"];
        status: ApprovalRecord["status"];
        responseJson: string;
        respondedAt: string;
    }): number;
    updateApprovalRequest(input: {
        id: string;
        requestJson: string;
    }): void;
    insertEvent(event: Omit<EventRecord, "eventTier" | "sessionId"> & {
        eventTier?: EventRecord["eventTier"];
        sessionId?: string | null;
    }): EventRecord;
}
/**
 * Creates a fully decorated RuntimeLifecycleRepository with retry and observation.
 *
 * The decorator chain applies:
 * 1. ObservedRuntimeLifecycleRepository - logs all operations
 * 2. RetryingRuntimeLifecycleRepository - retries on SQLite BUSY errors
 * 3. AuthoritativeTaskStoreRuntimeLifecycleRepository - actual implementation
 *
 * @param store - The AuthoritativeTaskStore to wrap
 * @param options - Configuration options for retry and logging
 * @returns A fully decorated repository
 */
export declare function createRuntimeLifecycleRepository(store: AuthoritativeTaskStore, options?: {
    logger?: StructuredLogger | undefined;
    maxRetryAttempts?: number | undefined;
}): RuntimeLifecycleRepository;
