import type { ApprovalRecord, EventRecord } from "../../../contracts/types/domain.js";
import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
import { AuthoritativeTaskStore } from "../authoritative-task-store.js";

const runtimeLifecycleRepositoryLogger = new StructuredLogger({ retentionLimit: 100 });

/**
 * Repository interface for runtime lifecycle operations.
 * Defines the contract for updating task, workflow, session, and execution state.
 */
export interface RuntimeLifecycleRepository {
  updateTaskStatus(
    taskId: string,
    status: string,
    updatedAt: string,
    errorCode?: string | null,
    completedAt?: string | null,
  ): void;
  // RT-01: Compare-and-swap variant. Returns number of rows updated (0 or 1).
  updateTaskStatusCas(
    taskId: string,
    expectedStatus: string,
    status: string,
    updatedAt: string,
    errorCode?: string | null,
    completedAt?: string | null,
  ): number;
  updateTaskOutput(taskId: string, outputJson: string, updatedAt: string): void;
  updateWorkflowState(
    taskId: string,
    status: string,
    currentStepIndex: number,
    outputsJson: string,
    updatedAt: string,
    resumableFromStep?: string | null,
  ): void;
  // CAS variant for workflow status with expected version check.
  updateWorkflowStateCas(
    taskId: string,
    expectedVersion: number,
    status: string,
    currentStepIndex: number,
    outputsJson: string,
    updatedAt: string,
    resumableFromStep?: string | null,
  ): number;
  updateSessionStatus(sessionId: string, status: string, updatedAt: string): void;
  updateSessionStatusCas(sessionId: string, expectedStatus: string, status: string, updatedAt: string): number;
  updateExecutionStatus(
    executionId: string,
    status: string,
    updatedAt: string,
    startedAt?: string | null,
    finishedAt?: string | null,
    lastErrorCode?: string | null,
  ): void;
  updateExecutionStatusCas(
    executionId: string,
    expectedStatus: string,
    status: string,
    updatedAt: string,
    startedAt?: string | null,
    finishedAt?: string | null,
    lastErrorCode?: string | null,
  ): number;
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
  insertEvent(
    event: Omit<EventRecord, "eventTier" | "sessionId"> & {
      eventTier?: EventRecord["eventTier"];
      sessionId?: string | null;
    },
  ): EventRecord;
}

/**
 * Direct implementation of RuntimeLifecycleRepository backed by AuthoritativeTaskStore.
 * This is the base implementation that other decorators wrap.
 */
export class AuthoritativeTaskStoreRuntimeLifecycleRepository implements RuntimeLifecycleRepository {
  public constructor(private readonly store: AuthoritativeTaskStore) {}

  public updateTaskStatus(
    taskId: string,
    status: string,
    updatedAt: string,
    errorCode: string | null = null,
    completedAt: string | null = null,
  ): void {
    this.store.task.updateTaskStatus(taskId, status, updatedAt, errorCode, completedAt);
  }

  public updateTaskStatusCas(
    taskId: string,
    expectedStatus: string,
    status: string,
    updatedAt: string,
    errorCode: string | null = null,
    completedAt: string | null = null,
  ): number {
    return this.store.task.updateTaskStatusCas(taskId, expectedStatus, status, updatedAt, errorCode, completedAt);
  }

  public updateTaskOutput(taskId: string, outputJson: string, updatedAt: string): void {
    this.store.task.updateTaskOutput(taskId, outputJson, updatedAt);
  }

  public updateWorkflowState(
    taskId: string,
    status: string,
    currentStepIndex: number,
    outputsJson: string,
    updatedAt: string,
    resumableFromStep: string | null = null,
  ): void {
    this.store.workflow.updateWorkflowState(taskId, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep);
  }

  public updateWorkflowStateCas(
    taskId: string,
    expectedVersion: number,
    status: string,
    currentStepIndex: number,
    outputsJson: string,
    updatedAt: string,
    resumableFromStep: string | null = null,
  ): number {
    return this.store.workflow.updateWorkflowStateCas(taskId, expectedVersion, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep);
  }

  public updateSessionStatus(sessionId: string, status: string, updatedAt: string): void {
    this.store.session.updateSessionStatus(sessionId, status, updatedAt);
  }

  public updateSessionStatusCas(sessionId: string, expectedStatus: string, status: string, updatedAt: string): number {
    return this.store.session.updateSessionStatusCas(sessionId, expectedStatus, status, updatedAt);
  }

  public updateExecutionStatus(
    executionId: string,
    status: string,
    updatedAt: string,
    startedAt: string | null = null,
    finishedAt: string | null = null,
    lastErrorCode: string | null = null,
  ): void {
    this.store.execution.updateExecutionStatus(executionId, status, updatedAt, startedAt, finishedAt, lastErrorCode);
  }

  public updateExecutionStatusCas(
    executionId: string,
    expectedStatus: string,
    status: string,
    updatedAt: string,
    startedAt: string | null = null,
    finishedAt: string | null = null,
    lastErrorCode: string | null = null,
  ): number {
    return this.store.execution.updateExecutionStatusCas(executionId, expectedStatus, status, updatedAt, startedAt, finishedAt, lastErrorCode);
  }

  public createTier1StatusEvent(input: {
    taskId: string;
    executionId: string | null;
    eventType: string;
    traceId: string;
    payload: Record<string, unknown>;
  }): EventRecord {
    return this.store.event.createTier1StatusEvent(input);
  }

  public insertApproval(approval: ApprovalRecord): void {
    this.store.approval.insertApproval(approval);
  }

  public getApproval(approvalId: string): ApprovalRecord | null {
    return this.store.approval.getApproval(approvalId);
  }

  public listApprovalsByTask(taskId: string): ApprovalRecord[] {
    return this.store.approval.listApprovalsByTask(taskId);
  }

  public updateApprovalDecision(input: {
    approvalId: string;
    status: ApprovalRecord["status"];
    responseJson: string;
    respondedAt: string;
  }): void {
    this.store.approval.updateApprovalDecision(input);
  }

  public updateApprovalDecisionCas(input: {
    approvalId: string;
    expectedStatus: ApprovalRecord["status"];
    status: ApprovalRecord["status"];
    responseJson: string;
    respondedAt: string;
  }): number {
    return this.store.approval.updateApprovalDecisionCas(input);
  }

  public updateApprovalRequest(input: { id: string; requestJson: string }): void {
    this.store.approval.updateApprovalRequest(input);
  }

  public insertEvent(
    event: Omit<EventRecord, "eventTier" | "sessionId"> & {
      eventTier?: EventRecord["eventTier"];
      sessionId?: string | null;
    },
  ): EventRecord {
    return this.store.event.insertEvent(event);
  }
}

/**
 * Detects if an error is a retryable SQLite BUSY error.
 * @param error - The error to check
 * @returns True if the error indicates a retryable busy condition
 */
function isRetryableSqliteBusyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code = typeof error === "object" && error != null && "code" in error ? String(error.code) : "";
  return message.includes("SQLITE_BUSY") || code.includes("SQLITE_BUSY");
}

/**
 * Retry decorator for RuntimeLifecycleRepository.
 * Automatically retries operations that fail with SQLite BUSY errors.
 */
export class RetryingRuntimeLifecycleRepository implements RuntimeLifecycleRepository {
  public constructor(
    private readonly inner: RuntimeLifecycleRepository,
    private readonly options: { maxAttempts?: number | undefined } = {},
  ) {}

  /**
   * Executes an operation with automatic retry on SQLite BUSY errors.
   * @param operation - Name of the operation for logging
   * @param work - The work to execute
   * @returns The result of the work function
   */
  private run<T>(operation: string, work: () => T): T {
    const maxAttempts = Math.max(1, Math.trunc(this.options.maxAttempts ?? 3));
    let attempt = 0;
    while (true) {
      attempt += 1;
      try {
        return work();
      } catch (error) {
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

  public updateTaskStatus(taskId: string, status: string, updatedAt: string, errorCode: string | null = null, completedAt: string | null = null): void {
    return this.run("updateTaskStatus", () => this.inner.updateTaskStatus(taskId, status, updatedAt, errorCode, completedAt));
  }

  public updateTaskStatusCas(taskId: string, expectedStatus: string, status: string, updatedAt: string, errorCode: string | null = null, completedAt: string | null = null): number {
    return this.run("updateTaskStatusCas", () => this.inner.updateTaskStatusCas(taskId, expectedStatus, status, updatedAt, errorCode, completedAt));
  }

  public updateTaskOutput(taskId: string, outputJson: string, updatedAt: string): void {
    return this.run("updateTaskOutput", () => this.inner.updateTaskOutput(taskId, outputJson, updatedAt));
  }

  public updateWorkflowState(taskId: string, status: string, currentStepIndex: number, outputsJson: string, updatedAt: string, resumableFromStep: string | null = null): void {
    return this.run("updateWorkflowState", () => this.inner.updateWorkflowState(
      taskId,
      status,
      currentStepIndex,
      outputsJson,
      updatedAt,
      resumableFromStep,
    ));
  }

  public updateWorkflowStateCas(
    taskId: string,
    expectedVersion: number,
    status: string,
    currentStepIndex: number,
    outputsJson: string,
    updatedAt: string,
    resumableFromStep: string | null = null,
  ): number {
    return this.run("updateWorkflowStateCas", () => this.inner.updateWorkflowStateCas(
      taskId, expectedVersion, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep,
    ));
  }

  public updateSessionStatus(sessionId: string, status: string, updatedAt: string): void {
    return this.run("updateSessionStatus", () => this.inner.updateSessionStatus(sessionId, status, updatedAt));
  }

  public updateSessionStatusCas(sessionId: string, expectedStatus: string, status: string, updatedAt: string): number {
    return this.run("updateSessionStatusCas", () => this.inner.updateSessionStatusCas(sessionId, expectedStatus, status, updatedAt));
  }

  public updateExecutionStatus(executionId: string, status: string, updatedAt: string, startedAt: string | null = null, finishedAt: string | null = null, lastErrorCode: string | null = null): void {
    return this.run("updateExecutionStatus", () => this.inner.updateExecutionStatus(
      executionId,
      status,
      updatedAt,
      startedAt,
      finishedAt,
      lastErrorCode,
    ));
  }

  public updateExecutionStatusCas(executionId: string, expectedStatus: string, status: string, updatedAt: string, startedAt: string | null = null, finishedAt: string | null = null, lastErrorCode: string | null = null): number {
    return this.run("updateExecutionStatusCas", () => this.inner.updateExecutionStatusCas(
      executionId, expectedStatus, status, updatedAt, startedAt, finishedAt, lastErrorCode,
    ));
  }

  public createTier1StatusEvent(input: {
    taskId: string;
    executionId: string | null;
    eventType: string;
    traceId: string;
    payload: Record<string, unknown>;
  }): EventRecord {
    return this.run("createTier1StatusEvent", () => this.inner.createTier1StatusEvent(input));
  }

  public insertApproval(approval: ApprovalRecord): void {
    return this.run("insertApproval", () => this.inner.insertApproval(approval));
  }

  public getApproval(approvalId: string): ApprovalRecord | null {
    return this.run("getApproval", () => this.inner.getApproval(approvalId));
  }

  public listApprovalsByTask(taskId: string): ApprovalRecord[] {
    return this.run("listApprovalsByTask", () => this.inner.listApprovalsByTask(taskId));
  }

  public updateApprovalDecision(input: {
    approvalId: string;
    status: ApprovalRecord["status"];
    responseJson: string;
    respondedAt: string;
  }): void {
    return this.run("updateApprovalDecision", () => this.inner.updateApprovalDecision(input));
  }

  public updateApprovalDecisionCas(input: {
    approvalId: string;
    expectedStatus: ApprovalRecord["status"];
    status: ApprovalRecord["status"];
    responseJson: string;
    respondedAt: string;
  }): number {
    return this.run("updateApprovalDecisionCas", () => this.inner.updateApprovalDecisionCas(input));
  }

  public updateApprovalRequest(input: { id: string; requestJson: string }): void {
    return this.run("updateApprovalRequest", () => this.inner.updateApprovalRequest(input));
  }

  public insertEvent(
    event: Omit<EventRecord, "eventTier" | "sessionId"> & {
      eventTier?: EventRecord["eventTier"];
      sessionId?: string | null;
    },
  ): EventRecord {
    return this.run("insertEvent", () => this.inner.insertEvent(event));
  }
}

/**
 * Observing decorator for RuntimeLifecycleRepository.
 * Logs all operations with their duration and success/failure status.
 */
export class ObservedRuntimeLifecycleRepository implements RuntimeLifecycleRepository {
  public constructor(
    private readonly inner: RuntimeLifecycleRepository,
    private readonly logger: StructuredLogger = runtimeLifecycleRepositoryLogger,
  ) {}

  /**
   * Observes an operation, logging its execution time and result.
   * @param operation - Name of the operation for logging
   * @param work - The work to execute
   * @returns The result of the work function
   */
  private observe<T>(operation: string, work: () => T): T {
    const startedAt = Date.now();
    try {
      const result = work();
      this.logger.debug("runtime_lifecycle_repository.operation", {
        operation,
        ok: true,
        durationMs: Date.now() - startedAt,
      });
      return result;
    } catch (error) {
      this.logger.warn("runtime_lifecycle_repository.operation_failed", {
        operation,
        ok: false,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  public updateTaskStatus(taskId: string, status: string, updatedAt: string, errorCode: string | null = null, completedAt: string | null = null): void {
    return this.observe("updateTaskStatus", () => this.inner.updateTaskStatus(taskId, status, updatedAt, errorCode, completedAt));
  }

  public updateTaskStatusCas(taskId: string, expectedStatus: string, status: string, updatedAt: string, errorCode: string | null = null, completedAt: string | null = null): number {
    return this.observe("updateTaskStatusCas", () => this.inner.updateTaskStatusCas(taskId, expectedStatus, status, updatedAt, errorCode, completedAt));
  }

  public updateTaskOutput(taskId: string, outputJson: string, updatedAt: string): void {
    return this.observe("updateTaskOutput", () => this.inner.updateTaskOutput(taskId, outputJson, updatedAt));
  }

  public updateWorkflowState(taskId: string, status: string, currentStepIndex: number, outputsJson: string, updatedAt: string, resumableFromStep: string | null = null): void {
    return this.observe("updateWorkflowState", () => this.inner.updateWorkflowState(
      taskId,
      status,
      currentStepIndex,
      outputsJson,
      updatedAt,
      resumableFromStep,
    ));
  }

  public updateWorkflowStateCas(
    taskId: string,
    expectedVersion: number,
    status: string,
    currentStepIndex: number,
    outputsJson: string,
    updatedAt: string,
    resumableFromStep: string | null = null,
  ): number {
    return this.observe("updateWorkflowStateCas", () => this.inner.updateWorkflowStateCas(
      taskId, expectedVersion, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep,
    ));
  }

  public updateSessionStatus(sessionId: string, status: string, updatedAt: string): void {
    return this.observe("updateSessionStatus", () => this.inner.updateSessionStatus(sessionId, status, updatedAt));
  }

  public updateSessionStatusCas(sessionId: string, expectedStatus: string, status: string, updatedAt: string): number {
    return this.observe("updateSessionStatusCas", () => this.inner.updateSessionStatusCas(sessionId, expectedStatus, status, updatedAt));
  }

  public updateExecutionStatus(executionId: string, status: string, updatedAt: string, startedAt: string | null = null, finishedAt: string | null = null, lastErrorCode: string | null = null): void {
    return this.observe("updateExecutionStatus", () => this.inner.updateExecutionStatus(
      executionId,
      status,
      updatedAt,
      startedAt,
      finishedAt,
      lastErrorCode,
    ));
  }

  public updateExecutionStatusCas(executionId: string, expectedStatus: string, status: string, updatedAt: string, startedAt: string | null = null, finishedAt: string | null = null, lastErrorCode: string | null = null): number {
    return this.observe("updateExecutionStatusCas", () => this.inner.updateExecutionStatusCas(
      executionId, expectedStatus, status, updatedAt, startedAt, finishedAt, lastErrorCode,
    ));
  }

  public createTier1StatusEvent(input: {
    taskId: string;
    executionId: string | null;
    eventType: string;
    traceId: string;
    payload: Record<string, unknown>;
  }): EventRecord {
    return this.observe("createTier1StatusEvent", () => this.inner.createTier1StatusEvent(input));
  }

  public insertApproval(approval: ApprovalRecord): void {
    return this.observe("insertApproval", () => this.inner.insertApproval(approval));
  }

  public getApproval(approvalId: string): ApprovalRecord | null {
    return this.observe("getApproval", () => this.inner.getApproval(approvalId));
  }

  public listApprovalsByTask(taskId: string): ApprovalRecord[] {
    return this.observe("listApprovalsByTask", () => this.inner.listApprovalsByTask(taskId));
  }

  public updateApprovalDecision(input: {
    approvalId: string;
    status: ApprovalRecord["status"];
    responseJson: string;
    respondedAt: string;
  }): void {
    return this.observe("updateApprovalDecision", () => this.inner.updateApprovalDecision(input));
  }

  public updateApprovalDecisionCas(input: {
    approvalId: string;
    expectedStatus: ApprovalRecord["status"];
    status: ApprovalRecord["status"];
    responseJson: string;
    respondedAt: string;
  }): number {
    return this.observe("updateApprovalDecisionCas", () => this.inner.updateApprovalDecisionCas(input));
  }

  public updateApprovalRequest(input: { id: string; requestJson: string }): void {
    return this.observe("updateApprovalRequest", () => this.inner.updateApprovalRequest(input));
  }

  public insertEvent(
    event: Omit<EventRecord, "eventTier" | "sessionId"> & {
      eventTier?: EventRecord["eventTier"];
      sessionId?: string | null;
    },
  ): EventRecord {
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
export function createRuntimeLifecycleRepository(
  store: AuthoritativeTaskStore,
  options: { logger?: StructuredLogger | undefined; maxRetryAttempts?: number | undefined } = {},
): RuntimeLifecycleRepository {
  const base = new AuthoritativeTaskStoreRuntimeLifecycleRepository(store);
  const retried = new RetryingRuntimeLifecycleRepository(base, {
    maxAttempts: options.maxRetryAttempts,
  });
  return new ObservedRuntimeLifecycleRepository(retried, options.logger ?? runtimeLifecycleRepositoryLogger);
}
