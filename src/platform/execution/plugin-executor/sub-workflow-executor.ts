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

import { newId, nowIso } from "../../contracts/types/ids.js";
import { ValidationError } from "../../contracts/errors.js";

// ─────────────────────────────────────────────────────────────────────────────
// Public Types
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Execution State
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Workflow Executor
// ─────────────────────────────────────────────────────────────────────────────

export class SubWorkflowExecutor {
  private readonly defaultTimeout: number;
  private readonly maxNestedDepth: number;
  private readonly enableCheckpointing: boolean;
  private readonly executions = new Map<string, WorkflowExecution>();
  private readonly executionResults: SubWorkflowExecutionResult[] = [];

  public constructor(options: SubWorkflowExecutorOptions = {}) {
    this.defaultTimeout = options.defaultTimeout ?? 30000;
    this.maxNestedDepth = options.maxNestedDepth ?? 3;
    this.enableCheckpointing = options.enableCheckpointing ?? true;
  }

  // ── Workflow Management ───────────────────────────────────────────────────

  /**
   * Creates a new sub-workflow execution.
   *
   * @param definition - Sub-workflow definition
   * @param context - Execution context
   * @returns Execution ID
   */
  public createWorkflow(
    definition: SubWorkflowDefinition,
    context: SubWorkflowContext,
  ): string {
    if (context.parentExecutionId && context.parentExecutionId.split(":").length >= this.maxNestedDepth) {
      throw new ValidationError(
        "subworkflow_executor.max_depth_exceeded",
        `Maximum nested workflow depth (${this.maxNestedDepth}) exceeded`,
        { details: { nestedDepth: context.parentExecutionId.split(":").length } },
      );
    }

    const executionId = newId("swf");
    const steps = new Map<string, WorkflowStep>();
    const stepOrder: string[] = [];

    // Initialize steps from definition
    for (const stepDef of definition.steps) {
      const step: WorkflowStep = {
        stepId: stepDef.stepId,
        name: stepDef.name,
        action: stepDef.action,
        input: {},
        status: "pending",
        retryCount: 0,
        maxRetries: stepDef.maxRetries,
      };
      steps.set(stepDef.stepId, step);
      stepOrder.push(stepDef.stepId);
    }

    const execution: WorkflowExecution = {
      definition,
      context,
      status: "created",
      steps,
      stepOrder,
      startedAt: null,
      completedAt: null,
      rollbackHistory: [],
      checkpoints: [],
    };

    this.executions.set(executionId, execution);
    return executionId;
  }

  /**
   * Gets workflow execution information.
   *
   * @param executionId - Execution to query
   */
  public getWorkflow(executionId: string): WorkflowExecution | null {
    return this.executions.get(executionId) ?? null;
  }

  /**
   * Lists all workflow executions.
   */
  public listWorkflows(): string[] {
    return [...this.executions.keys()];
  }

  // ── Workflow Execution ─────────────────────────────────────────────────────

  /**
   * Starts or resumes a workflow execution.
   *
   * @param executionId - Execution to start/resume
   */
  public async executeWorkflow(executionId: string): Promise<SubWorkflowExecutionResult> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new ValidationError(
        "subworkflow_executor.not_found",
        `Workflow execution ${executionId} not found`,
        { details: { executionId } },
      );
    }

    if (execution.status === "completed" || execution.status === "cancelled") {
      throw new ValidationError(
        "subworkflow_executor.cannot_execute",
        `Workflow execution ${executionId} cannot be executed (status: ${execution.status})`,
        { details: { executionId, status: execution.status } },
      );
    }

    const startTime = Date.now();
    execution.status = "running";
    execution.startedAt = nowIso();

    try {
      // Execute steps in dependency order
      const completedSteps = await this.executeSteps(execution);

      // Mark workflow as completed
      execution.status = "completed";
      execution.completedAt = nowIso();

      // Create final checkpoint if enabled
      let checkpointRef: string | undefined;
      if (this.enableCheckpointing) {
        checkpointRef = this.createCheckpoint(execution);
      }

      return this.buildResult(execution, startTime, checkpointRef);
    } catch (error) {
      execution.status = "failed";
      execution.completedAt = nowIso();

      return this.buildResult(
        execution,
        startTime,
        undefined,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Pauses a running workflow.
   *
   * @param executionId - Execution to pause
   */
  public pauseWorkflow(executionId: string): void {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new ValidationError(
        "subworkflow_executor.not_found",
        `Workflow execution ${executionId} not found`,
        { details: { executionId } },
      );
    }

    if (execution.status !== "running") {
      throw new ValidationError(
        "subworkflow_executor.cannot_pause",
        `Workflow execution ${executionId} cannot be paused (status: ${execution.status})`,
        { details: { executionId, status: execution.status } },
      );
    }

    execution.status = "paused";
    this.createCheckpoint(execution);
  }

  /**
   * Cancels a workflow execution.
   *
   * @param executionId - Execution to cancel
   */
  public async cancelWorkflow(executionId: string): Promise<SubWorkflowExecutionResult> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new ValidationError(
        "subworkflow_executor.not_found",
        `Workflow execution ${executionId} not found`,
        { details: { executionId } },
      );
    }

    if (execution.status === "completed" || execution.status === "cancelled") {
      throw new ValidationError(
        "subworkflow_executor.cannot_cancel",
        `Workflow execution ${executionId} cannot be cancelled (status: ${execution.status})`,
        { details: { executionId, status: execution.status } },
      );
    }

    const startTime = Date.now();
    execution.status = "cancelled";
    execution.completedAt = nowIso();

    // Attempt rollback if automatic rollback is enabled
    if (execution.definition.rollbackPolicy === "automatic") {
      await this.performRollback(execution);
    }

    return this.buildResult(execution, startTime);
  }

  // ── Step Operations ───────────────────────────────────────────────────────

  /**
   * Gets a step by ID.
   *
   * @param executionId - Workflow execution
   * @param stepId - Step ID
   */
  public getStep(executionId: string, stepId: string): WorkflowStep | null {
    const execution = this.executions.get(executionId);
    return execution?.steps.get(stepId) ?? null;
  }

  /**
   * Gets all steps for a workflow execution.
   *
   * @param executionId - Workflow execution
   */
  public getSteps(executionId: string): WorkflowStep[] {
    const execution = this.executions.get(executionId);
    if (!execution) return [];

    return execution.stepOrder
      .map((stepId) => execution.steps.get(stepId)!)
      .filter((step) => step !== undefined);
  }

  /**
   * Skips a step in the workflow.
   *
   * @param executionId - Workflow execution
   * @param stepId - Step to skip
   * @param reason - Reason for skipping
   */
  public skipStep(executionId: string, stepId: string, reason: string): void {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new ValidationError(
        "subworkflow_executor.not_found",
        `Workflow execution ${executionId} not found`,
        { details: { executionId } },
      );
    }

    const step = execution.steps.get(stepId);
    if (!step) {
      throw new ValidationError(
        "subworkflow_executor.step_not_found",
        `Step ${stepId} not found in workflow ${executionId}`,
        { details: { stepId, executionId } },
      );
    }

    if (step.status !== "pending") {
      throw new ValidationError(
        "subworkflow_executor.cannot_skip",
        `Step ${stepId} cannot be skipped (status: ${step.status})`,
        { details: { stepId, status: step.status } },
      );
    }

    step.status = "skipped";
    step.output = { skipped: true, reason };
  }

  /**
   * Retries a failed step.
   *
   * @param executionId - Workflow execution
   * @param stepId - Step to retry
   */
  public async retryStep(executionId: string, stepId: string): Promise<WorkflowStep> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new ValidationError(
        "subworkflow_executor.not_found",
        `Workflow execution ${executionId} not found`,
        { details: { executionId } },
      );
    }

    const step = execution.steps.get(stepId);
    if (!step) {
      throw new ValidationError(
        "subworkflow_executor.step_not_found",
        `Step ${stepId} not found in workflow ${executionId}`,
        { details: { stepId, executionId } },
      );
    }

    if (step.status !== "failed") {
      throw new ValidationError(
        "subworkflow_executor.cannot_retry",
        `Step ${stepId} cannot be retried (status: ${step.status})`,
        { details: { stepId, status: step.status } },
      );
    }

    if (step.retryCount >= step.maxRetries) {
      throw new ValidationError(
        "subworkflow_executor.max_retries_exceeded",
        `Step ${stepId} has exceeded maximum retry count (${step.maxRetries})`,
        { details: { stepId, retryCount: step.retryCount, maxRetries: step.maxRetries } },
      );
    }

    step.retryCount++;
    step.status = "pending";
    delete step.error;

    // Re-execute the step
    await this.executeSingleStep(execution, step);

    return step;
  }

  // ── Checkpoint Operations ─────────────────────────────────────────────────

  /**
   * Creates a checkpoint of current workflow state.
   *
   * @param executionId - Workflow execution
   */
  public createCheckpointFromId(executionId: string): string | null {
    const execution = this.executions.get(executionId);
    if (!execution) return null;
    return this.createCheckpoint(execution);
  }

  /**
   * Gets checkpoints for a workflow execution.
   *
   * @param executionId - Workflow execution
   */
  public getCheckpoints(executionId: string): CheckpointRecord[] {
    const execution = this.executions.get(executionId);
    return execution?.checkpoints ?? [];
  }

  // ── Rollback Operations ───────────────────────────────────────────────────

  /**
   * Performs rollback for a failed workflow.
   *
   * @param executionId - Workflow execution
   */
  public async performRollbackFromId(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new ValidationError(
        "subworkflow_executor.not_found",
        `Workflow execution ${executionId} not found`,
        { details: { executionId } },
      );
    }

    if (execution.definition.rollbackPolicy === "none") {
      throw new ValidationError(
        "subworkflow_executor.rollback_not_allowed",
        "Rollback is not allowed for this workflow",
        { details: { executionId, rollbackPolicy: "none" } },
      );
    }

    await this.performRollback(execution);
  }

  // ── Execution Log ─────────────────────────────────────────────────────────

  /**
   * Gets the execution result log.
   */
  public getExecutionLog(): readonly SubWorkflowExecutionResult[] {
    return [...this.executionResults];
  }

  // ── Private Helpers ───────────────────────────────────────────────────────

  private async executeSteps(execution: WorkflowExecution): Promise<string[]> {
    const completedSteps: string[] = [];
    const stepDefinitions = execution.definition.steps;
    const stepDefMap = new Map(stepDefinitions.map((s) => [s.stepId, s]));

    for (const stepId of execution.stepOrder) {
      const step = execution.steps.get(stepId)!;
      const stepDef = stepDefMap.get(stepId);

      if (!stepDef) continue;

      // Check dependencies
      if (stepDef.dependsOn && stepDef.dependsOn.length > 0) {
        const depsMet = stepDef.dependsOn.every(
          (depId) => {
            const depStep = execution.steps.get(depId);
            return depStep?.status === "completed";
          },
        );
        if (!depsMet) {
          step.status = "skipped";
          step.output = { skipped: true, reason: "Dependencies not met" };
          continue;
        }
      }

      // Check conditional
      if (stepDef.conditional) {
        const condStep = execution.steps.get(stepDef.conditional.when);
        if (condStep?.output !== stepDef.conditional.equals) {
          step.status = "skipped";
          step.output = { skipped: true, reason: "Conditional not met" };
          continue;
        }
      }

      await this.executeSingleStep(execution, step);

      if (step.status === "completed") {
        completedSteps.push(stepId);

        // Create checkpoint at interval
        if (
          this.enableCheckpointing &&
          execution.definition.checkpointIntervalSteps &&
          completedSteps.length % execution.definition.checkpointIntervalSteps === 0
        ) {
          this.createCheckpoint(execution);
        }
      } else if (step.status === "failed") {
        // Stop execution on failure
        break;
      }
    }

    return completedSteps;
  }

  private async executeSingleStep(execution: WorkflowExecution, step: WorkflowStep): Promise<void> {
    step.status = "running";
    step.startedAt = nowIso();

    try {
      const timeout = this.getStepTimeout(step);
      await this.simulateStepExecution(step, timeout);

      step.status = "completed";
      step.output = { result: `Step ${step.name} completed successfully` };
      step.completedAt = nowIso();

      // Record for potential rollback
      execution.rollbackHistory.push({
        stepId: step.stepId,
        timestamp: nowIso(),
        action: step.action,
        input: step.input,
        output: step.output,
      });
    } catch (error) {
      step.status = "failed";
      step.error = error instanceof Error ? error.message : String(error);
      step.completedAt = nowIso();
    }
  }

  private getStepTimeout(step: WorkflowStep): number {
    const definition = this.findStepDefinition(step);
    return definition?.timeout ?? this.defaultTimeout;
  }

  private findStepDefinition(step: WorkflowStep): WorkflowStepDefinition | undefined {
    const execution = [...this.executions.values()].find((e) =>
      e.steps.has(step.stepId),
    );
    return execution?.definition.steps.find((s) => s.stepId === step.stepId);
  }

  private async simulateStepExecution(step: WorkflowStep, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve();
      }, Math.min(timeout, 50)); // Simulated
      setTimeout(() => clearTimeout(timer), timeout);
    });
  }

  private createCheckpoint(execution: WorkflowExecution): string {
    const checkpointId = newId("ckpt");
    const completedCount = execution.stepOrder.filter(
      (id) => execution.steps.get(id)?.status === "completed",
    ).length;

    const state: Record<string, unknown> = {
      status: execution.status,
      stepStatuses: Object.fromEntries(
        execution.stepOrder.map((id) => [id, execution.steps.get(id)?.status]),
      ),
      rollbackHistory: execution.rollbackHistory,
    };

    const record: CheckpointRecord = {
      checkpointId,
      stepIndex: completedCount,
      timestamp: nowIso(),
      state,
    };

    execution.checkpoints.push(record);
    return checkpointId;
  }

  private async performRollback(execution: WorkflowExecution): Promise<void> {
    const completedSteps = [...execution.rollbackHistory].reverse();

    for (const entry of completedSteps) {
      const step = execution.steps.get(entry.stepId);
      if (!step) continue;

      // Simulate rollback action
      await this.simulateRollback(entry);

      step.status = "rolled_back";
    }
  }

  private async simulateRollback(entry: RollbackHistoryEntry): Promise<void> {
    // Simulated rollback - in real implementation would call rollback handlers
    return new Promise((resolve) => setTimeout(resolve, 10));
  }

  private buildResult(
    execution: WorkflowExecution,
    startTime: number,
    checkpointRef?: string,
    error?: string,
  ): SubWorkflowExecutionResult {
    const result: SubWorkflowExecutionResult = {
      executionId: newId("swf_res"),
      workflowId: execution.definition.workflowId,
      status: execution.status,
      steps: this.getSteps(execution.context.executionId),
      durationMs: Date.now() - startTime,
      timestamp: nowIso(),
    };

    if (checkpointRef) {
      result.checkpointRef = checkpointRef;
    }

    if (error) {
      result.error = error;
    }

    // Aggregate output from completed steps
    const completedSteps = [...execution.steps.values()].filter((s) => s.status === "completed");
    if (completedSteps.length > 0) {
      result.output = {
        completedSteps: completedSteps.map((s) => ({
          stepId: s.stepId,
          name: s.name,
          output: s.output,
        })),
      };
    }

    this.executionResults.push(result);
    return result;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

export function createSubWorkflowExecutor(options?: SubWorkflowExecutorOptions): SubWorkflowExecutor {
  return new SubWorkflowExecutor(options);
}
