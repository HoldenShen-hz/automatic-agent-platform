import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
const runtimeLifecycleRepositoryLogger = new StructuredLogger({ retentionLimit: 100 });
/**
 * Direct implementation of RuntimeLifecycleRepository backed by AuthoritativeTaskStore.
 * This is the base implementation that other decorators wrap.
 */
export class AuthoritativeTaskStoreRuntimeLifecycleRepository {
    store;
    constructor(store) {
        this.store = store;
    }
    updateTaskStatus(taskId, status, updatedAt, errorCode = null, completedAt = null) {
        this.store.task.updateTaskStatus(taskId, status, updatedAt, errorCode, completedAt);
    }
    updateTaskStatusCas(taskId, expectedStatus, status, updatedAt, errorCode = null, completedAt = null) {
        return this.store.task.updateTaskStatusCas(taskId, expectedStatus, status, updatedAt, errorCode, completedAt);
    }
    updateTaskOutput(taskId, outputJson, updatedAt) {
        this.store.task.updateTaskOutput(taskId, outputJson, updatedAt);
    }
    updateWorkflowState(taskId, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep = null) {
        this.store.workflow.updateWorkflowState(taskId, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep);
    }
    updateWorkflowStateCas(taskId, expectedVersion, expectedStatus, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep = null) {
        return this.store.workflow.updateWorkflowStateCas(taskId, expectedVersion, expectedStatus, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep);
    }
    getWorkflowState(taskId) {
        return this.store.workflow.getWorkflowState(taskId);
    }
    updateSessionStatus(sessionId, status, updatedAt) {
        this.store.session.updateSessionStatus(sessionId, status, updatedAt);
    }
    updateSessionStatusCas(sessionId, expectedStatus, status, updatedAt) {
        return this.store.session.updateSessionStatusCas(sessionId, expectedStatus, status, updatedAt);
    }
    updateExecutionStatus(executionId, status, updatedAt, startedAt = null, finishedAt = null, lastErrorCode = null) {
        this.store.execution.updateExecutionStatus(executionId, status, updatedAt, startedAt, finishedAt, lastErrorCode);
    }
    updateExecutionStatusCas(executionId, expectedStatus, status, updatedAt, startedAt = null, finishedAt = null, lastErrorCode = null) {
        return this.store.execution.updateExecutionStatusCas(executionId, expectedStatus, status, updatedAt, startedAt, finishedAt, lastErrorCode);
    }
    createTier1StatusEvent(input) {
        return this.store.event.createTier1StatusEvent(input);
    }
    insertApproval(approval) {
        this.store.approval.insertApproval(approval);
    }
    getApproval(approvalId) {
        return this.store.approval.getApproval(approvalId);
    }
    listApprovalsByTask(taskId) {
        return this.store.approval.listApprovalsByTask(taskId);
    }
    updateApprovalDecision(input) {
        this.store.approval.updateApprovalDecision(input);
    }
    updateApprovalDecisionCas(input) {
        return this.store.approval.updateApprovalDecisionCas(input);
    }
    updateApprovalRequest(input) {
        this.store.approval.updateApprovalRequest(input);
    }
    insertEvent(event) {
        return this.store.event.insertEvent(event);
    }
}
/**
 * Detects if an error is a retryable SQLite BUSY error.
 * @param error - The error to check
 * @returns True if the error indicates a retryable busy condition
 */
function isRetryableSqliteBusyError(error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = typeof error === "object" && error != null && "code" in error ? String(error.code) : "";
    return message.includes("SQLITE_BUSY") || code.includes("SQLITE_BUSY");
}
/**
 * Retry decorator for RuntimeLifecycleRepository.
 * Automatically retries operations that fail with SQLite BUSY errors.
 */
export class RetryingRuntimeLifecycleRepository {
    inner;
    options;
    constructor(inner, options = {}) {
        this.inner = inner;
        this.options = options;
    }
    /**
     * Executes an operation with automatic retry on SQLite BUSY errors.
     * @param operation - Name of the operation for logging
     * @param work - The work to execute
     * @returns The result of the work function
     */
    run(operation, work) {
        const maxAttempts = Math.max(1, Math.trunc(this.options.maxAttempts ?? 3));
        let attempt = 0;
        while (true) {
            attempt += 1;
            try {
                return work();
            }
            catch (error) {
                if (!isRetryableSqliteBusyError(error) || attempt >= maxAttempts) {
                    throw error;
                }
                runtimeLifecycleRepositoryLogger.warn("runtime_lifecycle_repository.retry", {
                    operation,
                    attempt,
                    maxAttempts,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }
    updateTaskStatus(taskId, status, updatedAt, errorCode = null, completedAt = null) {
        return this.run("updateTaskStatus", () => this.inner.updateTaskStatus(taskId, status, updatedAt, errorCode, completedAt));
    }
    updateTaskStatusCas(taskId, expectedStatus, status, updatedAt, errorCode = null, completedAt = null) {
        return this.run("updateTaskStatusCas", () => this.inner.updateTaskStatusCas(taskId, expectedStatus, status, updatedAt, errorCode, completedAt));
    }
    updateTaskOutput(taskId, outputJson, updatedAt) {
        return this.run("updateTaskOutput", () => this.inner.updateTaskOutput(taskId, outputJson, updatedAt));
    }
    updateWorkflowState(taskId, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep = null) {
        return this.run("updateWorkflowState", () => this.inner.updateWorkflowState(taskId, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep));
    }
    updateWorkflowStateCas(taskId, expectedVersion, expectedStatus, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep = null) {
        return this.run("updateWorkflowStateCas", () => this.inner.updateWorkflowStateCas(taskId, expectedVersion, expectedStatus, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep));
    }
    updateSessionStatus(sessionId, status, updatedAt) {
        return this.run("updateSessionStatus", () => this.inner.updateSessionStatus(sessionId, status, updatedAt));
    }
    getWorkflowState(taskId) {
        return this.run("getWorkflowState", () => this.inner.getWorkflowState(taskId));
    }
    updateSessionStatusCas(sessionId, expectedStatus, status, updatedAt) {
        return this.run("updateSessionStatusCas", () => this.inner.updateSessionStatusCas(sessionId, expectedStatus, status, updatedAt));
    }
    updateExecutionStatus(executionId, status, updatedAt, startedAt = null, finishedAt = null, lastErrorCode = null) {
        return this.run("updateExecutionStatus", () => this.inner.updateExecutionStatus(executionId, status, updatedAt, startedAt, finishedAt, lastErrorCode));
    }
    updateExecutionStatusCas(executionId, expectedStatus, status, updatedAt, startedAt = null, finishedAt = null, lastErrorCode = null) {
        return this.run("updateExecutionStatusCas", () => this.inner.updateExecutionStatusCas(executionId, expectedStatus, status, updatedAt, startedAt, finishedAt, lastErrorCode));
    }
    createTier1StatusEvent(input) {
        return this.run("createTier1StatusEvent", () => this.inner.createTier1StatusEvent(input));
    }
    insertApproval(approval) {
        return this.run("insertApproval", () => this.inner.insertApproval(approval));
    }
    getApproval(approvalId) {
        return this.run("getApproval", () => this.inner.getApproval(approvalId));
    }
    listApprovalsByTask(taskId) {
        return this.run("listApprovalsByTask", () => this.inner.listApprovalsByTask(taskId));
    }
    updateApprovalDecision(input) {
        return this.run("updateApprovalDecision", () => this.inner.updateApprovalDecision(input));
    }
    updateApprovalDecisionCas(input) {
        return this.run("updateApprovalDecisionCas", () => this.inner.updateApprovalDecisionCas(input));
    }
    updateApprovalRequest(input) {
        return this.run("updateApprovalRequest", () => this.inner.updateApprovalRequest(input));
    }
    insertEvent(event) {
        return this.run("insertEvent", () => this.inner.insertEvent(event));
    }
}
/**
 * Observing decorator for RuntimeLifecycleRepository.
 * Logs all operations with their duration and success/failure status.
 */
export class ObservedRuntimeLifecycleRepository {
    inner;
    logger;
    constructor(inner, logger = runtimeLifecycleRepositoryLogger) {
        this.inner = inner;
        this.logger = logger;
    }
    /**
     * Observes an operation, logging its execution time and result.
     * @param operation - Name of the operation for logging
     * @param work - The work to execute
     * @returns The result of the work function
     */
    observe(operation, work) {
        const startedAt = Date.now();
        try {
            const result = work();
            this.logger.debug("runtime_lifecycle_repository.operation", {
                operation,
                ok: true,
                durationMs: Date.now() - startedAt,
            });
            return result;
        }
        catch (error) {
            this.logger.warn("runtime_lifecycle_repository.operation_failed", {
                operation,
                ok: false,
                durationMs: Date.now() - startedAt,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    updateTaskStatus(taskId, status, updatedAt, errorCode = null, completedAt = null) {
        return this.observe("updateTaskStatus", () => this.inner.updateTaskStatus(taskId, status, updatedAt, errorCode, completedAt));
    }
    updateTaskStatusCas(taskId, expectedStatus, status, updatedAt, errorCode = null, completedAt = null) {
        return this.observe("updateTaskStatusCas", () => this.inner.updateTaskStatusCas(taskId, expectedStatus, status, updatedAt, errorCode, completedAt));
    }
    updateTaskOutput(taskId, outputJson, updatedAt) {
        return this.observe("updateTaskOutput", () => this.inner.updateTaskOutput(taskId, outputJson, updatedAt));
    }
    updateWorkflowState(taskId, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep = null) {
        return this.observe("updateWorkflowState", () => this.inner.updateWorkflowState(taskId, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep));
    }
    updateWorkflowStateCas(taskId, expectedVersion, expectedStatus, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep = null) {
        return this.observe("updateWorkflowStateCas", () => this.inner.updateWorkflowStateCas(taskId, expectedVersion, expectedStatus, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep));
    }
    updateSessionStatus(sessionId, status, updatedAt) {
        return this.observe("updateSessionStatus", () => this.inner.updateSessionStatus(sessionId, status, updatedAt));
    }
    getWorkflowState(taskId) {
        return this.observe("getWorkflowState", () => this.inner.getWorkflowState(taskId));
    }
    updateSessionStatusCas(sessionId, expectedStatus, status, updatedAt) {
        return this.observe("updateSessionStatusCas", () => this.inner.updateSessionStatusCas(sessionId, expectedStatus, status, updatedAt));
    }
    updateExecutionStatus(executionId, status, updatedAt, startedAt = null, finishedAt = null, lastErrorCode = null) {
        return this.observe("updateExecutionStatus", () => this.inner.updateExecutionStatus(executionId, status, updatedAt, startedAt, finishedAt, lastErrorCode));
    }
    updateExecutionStatusCas(executionId, expectedStatus, status, updatedAt, startedAt = null, finishedAt = null, lastErrorCode = null) {
        return this.observe("updateExecutionStatusCas", () => this.inner.updateExecutionStatusCas(executionId, expectedStatus, status, updatedAt, startedAt, finishedAt, lastErrorCode));
    }
    createTier1StatusEvent(input) {
        return this.observe("createTier1StatusEvent", () => this.inner.createTier1StatusEvent(input));
    }
    insertApproval(approval) {
        return this.observe("insertApproval", () => this.inner.insertApproval(approval));
    }
    getApproval(approvalId) {
        return this.observe("getApproval", () => this.inner.getApproval(approvalId));
    }
    listApprovalsByTask(taskId) {
        return this.observe("listApprovalsByTask", () => this.inner.listApprovalsByTask(taskId));
    }
    updateApprovalDecision(input) {
        return this.observe("updateApprovalDecision", () => this.inner.updateApprovalDecision(input));
    }
    updateApprovalDecisionCas(input) {
        return this.observe("updateApprovalDecisionCas", () => this.inner.updateApprovalDecisionCas(input));
    }
    updateApprovalRequest(input) {
        return this.observe("updateApprovalRequest", () => this.inner.updateApprovalRequest(input));
    }
    insertEvent(event) {
        return this.observe("insertEvent", () => this.inner.insertEvent(event));
    }
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
export function createRuntimeLifecycleRepository(store, options = {}) {
    const base = new AuthoritativeTaskStoreRuntimeLifecycleRepository(store);
    const retried = new RetryingRuntimeLifecycleRepository(base, {
        maxAttempts: options.maxRetryAttempts,
    });
    return new ObservedRuntimeLifecycleRepository(retried, options.logger ?? runtimeLifecycleRepositoryLogger);
}
//# sourceMappingURL=runtime-lifecycle-repository.js.map