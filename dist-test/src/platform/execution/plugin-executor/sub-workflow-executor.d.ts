/**
 * Sub-Workflow Executor
 *
 * Executes sub-workflows as part of a parent workflow execution.
 * Manages workflow state, step results, checkpointing, and rollback
 * within a nested execution context.
 *
 * Architecture: §14 Runtime Execution Plane
 * @see docs_zh/architecture/00-platform-architecture.md §14
 * @see ADR-030 Runtime Execution Plane
 */
export type WorkflowStepStatus = "pending" | "running" | "completed" | "failed" | "skipped" | "rolled_back";
export type WorkflowStatus = "created" | "running" | "paused" | "completed" | "failed" | "cancelled";
export type RollbackPolicy = "none" | "manual" | "automatic";
export interface WorkflowStep {
    stepId: string;
    name: string;
    action: string;
    input: Record<string, unknown>;
    status: WorkflowStepStatus;
    output?: unknown;
    error?: string;
    startedAt?: string;
    completedAt?: string;
    retryCount: number;
    maxRetries: number;
}
export interface SubWorkflowContext {
    executionId: string;
    taskId: string;
    tenantId: string | null;
    correlationId: string;
    parentExecutionId: string | null;
    sandboxTier: "none" | "process" | "container";
}
export interface SubWorkflowDefinition {
    workflowId: string;
    name: string;
    steps: WorkflowStepDefinition[];
    rollbackPolicy: RollbackPolicy;
    checkpointIntervalSteps?: number;
}
export interface WorkflowStepDefinition {
    stepId: string;
    name: string;
    action: string;
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
    maxRetries: number;
    timeout?: number;
    dependsOn?: readonly string[];
    conditional?: {
        when: string;
        equals: unknown;
    };
}
export interface SubWorkflowExecutionResult {
    executionId: string;
    workflowId: string;
    status: WorkflowStatus;
    steps: readonly WorkflowStep[];
    output?: unknown;
    durationMs: number;
    timestamp: string;
    error?: string;
    checkpointRef?: string;
}
export interface SubWorkflowExecutorOptions {
    defaultTimeout?: number;
    maxNestedDepth?: number;
    enableCheckpointing?: boolean;
}
interface WorkflowExecution {
    definition: SubWorkflowDefinition;
    context: SubWorkflowContext;
    status: WorkflowStatus;
    steps: Map<string, WorkflowStep>;
    stepOrder: string[];
    startedAt: string | null;
    completedAt: string | null;
    rollbackHistory: RollbackHistoryEntry[];
    checkpoints: CheckpointRecord[];
}
interface RollbackHistoryEntry {
    stepId: string;
    timestamp: string;
    action: string;
    input: Record<string, unknown>;
    output?: unknown;
}
interface CheckpointRecord {
    checkpointId: string;
    stepIndex: number;
    timestamp: string;
    state: Record<string, unknown>;
}
export declare class SubWorkflowExecutor {
    private readonly defaultTimeout;
    private readonly maxNestedDepth;
    private readonly enableCheckpointing;
    private readonly executions;
    private readonly executionResults;
    constructor(options?: SubWorkflowExecutorOptions);
    /**
     * Creates a new sub-workflow execution.
     *
     * @param definition - Sub-workflow definition
     * @param context - Execution context
     * @returns Execution ID
     */
    createWorkflow(definition: SubWorkflowDefinition, context: SubWorkflowContext): string;
    /**
     * Gets workflow execution information.
     *
     * @param executionId - Execution to query
     */
    getWorkflow(executionId: string): WorkflowExecution | null;
    /**
     * Lists all workflow executions.
     */
    listWorkflows(): string[];
    /**
     * Starts or resumes a workflow execution.
     *
     * @param executionId - Execution to start/resume
     */
    executeWorkflow(executionId: string): Promise<SubWorkflowExecutionResult>;
    /**
     * Pauses a running workflow.
     *
     * @param executionId - Execution to pause
     */
    pauseWorkflow(executionId: string): void;
    /**
     * Cancels a workflow execution.
     *
     * @param executionId - Execution to cancel
     */
    cancelWorkflow(executionId: string): Promise<SubWorkflowExecutionResult>;
    /**
     * Gets a step by ID.
     *
     * @param executionId - Workflow execution
     * @param stepId - Step ID
     */
    getStep(executionId: string, stepId: string): WorkflowStep | null;
    /**
     * Gets all steps for a workflow execution.
     *
     * @param executionId - Workflow execution
     */
    getSteps(executionId: string): WorkflowStep[];
    /**
     * Skips a step in the workflow.
     *
     * @param executionId - Workflow execution
     * @param stepId - Step to skip
     * @param reason - Reason for skipping
     */
    skipStep(executionId: string, stepId: string, reason: string): void;
    /**
     * Retries a failed step.
     *
     * @param executionId - Workflow execution
     * @param stepId - Step to retry
     */
    retryStep(executionId: string, stepId: string): Promise<WorkflowStep>;
    /**
     * Creates a checkpoint of current workflow state.
     *
     * @param executionId - Workflow execution
     */
    createCheckpointFromId(executionId: string): string | null;
    /**
     * Gets checkpoints for a workflow execution.
     *
     * @param executionId - Workflow execution
     */
    getCheckpoints(executionId: string): CheckpointRecord[];
    /**
     * Performs rollback for a failed workflow.
     *
     * @param executionId - Workflow execution
     */
    performRollbackFromId(executionId: string): Promise<void>;
    /**
     * Gets the execution result log.
     */
    getExecutionLog(): readonly SubWorkflowExecutionResult[];
    private executeSteps;
    private executeSingleStep;
    private getStepTimeout;
    private findStepDefinition;
    private simulateStepExecution;
    private createCheckpoint;
    private performRollback;
    private simulateRollback;
    private buildResult;
}
export declare function createSubWorkflowExecutor(options?: SubWorkflowExecutorOptions): SubWorkflowExecutor;
export {};
