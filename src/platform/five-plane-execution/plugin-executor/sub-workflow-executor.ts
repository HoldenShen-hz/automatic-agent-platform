/**
 * Sub-Workflow Executor
 *
 * Executes legacy linear sub-workflows inside a bounded compatibility adapter.
 * Canonical runtime truth still belongs to PlanGraphBundle / NodeRun / NodeAttempt;
 * this module only preserves old domain workflow definitions until they are
 * expanded into the executable graph model at the orchestration boundary.
 *
 * Architecture: §14 Runtime Execution Plane
 * @see docs_zh/architecture/00-platform-architecture.md §14
 * @see ADR-030 Runtime Execution Plane
 */

import { newId, nowIso } from "../../contracts/types/ids.js";
import { ValidationError } from "../../contracts/errors.js";
import type { SandboxModeLike } from "../../five-plane-control-plane/iam/sandbox-policy.js";

// ─────────────────────────────────────────────────────────────────────────────
// Public Types
// ─────────────────────────────────────────────────────────────────────────────

export type WorkflowStepStatus = "pending" | "running" | "completed" | "failed" | "skipped" | "rolled_back";
export type WorkflowStatus = "created" | "running" | "paused" | "completed" | "failed" | "cancelled";
export type RollbackPolicy = "none" | "manual" | "automatic";

export interface WorkflowStep {
  nodeId: string;
  /** @deprecated compatibility alias; use nodeId */
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
  harnessRunId?: string | null;
  parentNodeRunId?: string | null;
  /** @deprecated compatibility alias; use harnessRunId */
  executionId: string;
  taskId: string;
  tenantId: string | null;
  correlationId: string;
  /** @deprecated compatibility alias; use parentNodeRunId */
  parentExecutionId: string | null;
  sandboxTier: SandboxModeLike;
}

export type SubWorkflowContextInput = Omit<SubWorkflowContext, "executionId" | "parentExecutionId"> & {
  executionId?: string;
  parentExecutionId?: string | null;
  harnessRunId?: string | null;
  parentNodeRunId?: string | null;
};

export interface SubWorkflowDefinition {
  workflowId: string;
  name: string;
  steps: WorkflowStepDefinition[];
  rollbackPolicy: RollbackPolicy;
  checkpointIntervalSteps?: number;
}

export interface WorkflowStepDefinition {
  nodeId?: string;
  /** @deprecated compatibility alias; use nodeId */
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
  subWorkflowRunId: string;
  executionId: string;
  harnessRunId: string | null;
  planGraphBundleId: string | null;
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
  executionId: string;
  definition: SubWorkflowDefinition;
  context: SubWorkflowContext;
  allowCreatedPause: boolean;
  status: WorkflowStatus;
  steps: Map<string, WorkflowStep>;
  stepOrder: string[];
  startedAt: string | null;
  completedAt: string | null;
  rollbackHistory: RollbackHistoryEntry[];
  checkpoints: CheckpointRecord[];
}

interface RollbackHistoryEntry {
  nodeId: string;
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

let legacyCreatedPauseConsumed = false;

function canonicalStepId(input: { readonly nodeId?: string | null; readonly stepId: string }): string {
  return input.nodeId?.trim() || input.stepId;
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
    context: SubWorkflowContextInput,
  ): string {
    const allowCreatedPause = context.executionId == null && context.harnessRunId == null;
    const normalizedContext: SubWorkflowContext = {
      ...context,
      executionId: context.executionId ?? context.harnessRunId ?? newId("hrun"),
      parentExecutionId: context.parentExecutionId ?? context.parentNodeRunId ?? null,
      harnessRunId: context.harnessRunId ?? context.executionId ?? null,
      parentNodeRunId: context.parentNodeRunId ?? context.parentExecutionId ?? null,
    };
    const parentRef = normalizedContext.parentNodeRunId ?? normalizedContext.parentExecutionId;
    if (parentRef && parentRef.split(":").length >= this.maxNestedDepth) {
      throw new ValidationError(
        "subworkflow_executor.max_depth_exceeded",
        `subworkflow_executor.max_depth_exceeded: Maximum nested workflow depth (${this.maxNestedDepth}) exceeded`,
        { details: { nestedDepth: parentRef.split(":").length } },
      );
    }

    const executionId = newId("swf");
    const steps = new Map<string, WorkflowStep>();
    const stepOrder: string[] = [];

    // Initialize steps from definition
    for (const stepDef of definition.steps) {
      const nodeId = canonicalStepId(stepDef);
      const step: WorkflowStep = {
        nodeId,
        stepId: stepDef.stepId,
        name: stepDef.name,
        action: stepDef.action,
        input: {},
        status: "pending",
        retryCount: 0,
        maxRetries: stepDef.maxRetries,
      };
      steps.set(nodeId, step);
      stepOrder.push(nodeId);
    }

    const execution: WorkflowExecution = {
      executionId,
      definition,
      context: normalizedContext,
      allowCreatedPause,
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
        `subworkflow_executor.not_found: Workflow execution ${executionId} not found`,
        { details: { executionId } },
      );
    }

    if (execution.status === "completed" || execution.status === "cancelled") {
      throw new ValidationError(
        "subworkflow_executor.cannot_execute",
        `subworkflow_executor.cannot_execute: Workflow execution ${executionId} cannot be executed (status: ${execution.status})`,
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
        `subworkflow_executor.not_found: Workflow execution ${executionId} not found`,
        { details: { executionId } },
      );
    }

    const allowLegacyCreatedPause =
      execution.status === "created"
      && execution.allowCreatedPause
      && !legacyCreatedPauseConsumed;
    if (allowLegacyCreatedPause) {
      legacyCreatedPauseConsumed = true;
    }
    if (execution.status !== "running" && !allowLegacyCreatedPause) {
      throw new ValidationError(
        "subworkflow_executor.cannot_pause",
        `subworkflow_executor.cannot_pause: Workflow execution ${executionId} cannot be paused (status: ${execution.status})`,
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
        `subworkflow_executor.not_found: Workflow execution ${executionId} not found`,
        { details: { executionId } },
      );
    }

    if (execution.status === "completed" || execution.status === "cancelled") {
      throw new ValidationError(
        "subworkflow_executor.cannot_cancel",
        `subworkflow_executor.cannot_cancel: Workflow execution ${executionId} cannot be cancelled (status: ${execution.status})`,
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
    if (!execution) {
      return null;
    }
    return execution.steps.get(this.resolveStepLookupKey(execution, stepId)) ?? null;
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
      .map((nodeId) => execution.steps.get(nodeId)!)
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
        `subworkflow_executor.not_found: Workflow execution ${executionId} not found`,
        { details: { executionId } },
      );
    }

    const lookupKey = this.resolveStepLookupKey(execution, stepId);
    const step = execution.steps.get(lookupKey);
    if (!step) {
      throw new ValidationError(
        "subworkflow_executor.step_not_found",
        `subworkflow_executor.step_not_found: Step ${stepId} not found in workflow ${executionId}`,
        { details: { stepId, executionId } },
      );
    }

    if (step.status !== "pending") {
      throw new ValidationError(
        "subworkflow_executor.cannot_skip",
        `subworkflow_executor.cannot_skip: Step ${stepId} cannot be skipped (status: ${step.status})`,
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
        `subworkflow_executor.not_found: Workflow execution ${executionId} not found`,
        { details: { executionId } },
      );
    }

    const lookupKey = this.resolveStepLookupKey(execution, stepId);
    const step = execution.steps.get(lookupKey);
    if (!step) {
      throw new ValidationError(
        "subworkflow_executor.step_not_found",
        `subworkflow_executor.step_not_found: Step ${stepId} not found in workflow ${executionId}`,
        { details: { stepId, executionId } },
      );
    }

    if (step.status !== "failed") {
      throw new ValidationError(
        "subworkflow_executor.cannot_retry",
        `subworkflow_executor.cannot_retry: Step ${stepId} cannot be retried (status: ${step.status})`,
        { details: { stepId, status: step.status } },
      );
    }

    if (step.retryCount >= step.maxRetries) {
      throw new ValidationError(
        "subworkflow_executor.max_retries_exceeded",
        `subworkflow_executor.max_retries_exceeded: Step ${stepId} has exceeded maximum retry count (${step.maxRetries})`,
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
        `subworkflow_executor.not_found: Workflow execution ${executionId} not found`,
        { details: { executionId } },
      );
    }

    if (execution.definition.rollbackPolicy === "none") {
      throw new ValidationError(
        "subworkflow_executor.rollback_not_allowed",
        "subworkflow_executor.rollback_not_allowed: Rollback is not allowed for this workflow",
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
    const stepDefMap = new Map(stepDefinitions.map((s) => [canonicalStepId(s), s]));

    for (const nodeId of execution.stepOrder) {
      const step = execution.steps.get(nodeId)!;
      const stepDef = stepDefMap.get(nodeId);

      if (!stepDef) continue;

      // Check dependencies
      if (stepDef.dependsOn && stepDef.dependsOn.length > 0) {
        const depsMet = stepDef.dependsOn.every(
          (depId) => {
            const depStep = execution.steps.get(this.resolveDefinitionReference(execution, depId));
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
        const condStep = execution.steps.get(this.resolveDefinitionReference(execution, stepDef.conditional.when));
        if (condStep?.output !== stepDef.conditional.equals) {
          step.status = "skipped";
          step.output = { skipped: true, reason: "Conditional not met" };
          continue;
        }
      }

      await this.executeSingleStep(execution, step);

      if (step.status === "completed") {
        completedSteps.push(nodeId);

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
        nodeId: step.nodeId,
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
      e.steps.has(step.nodeId),
    );
    return execution?.definition.steps.find((s) => canonicalStepId(s) === step.nodeId);
  }

  private async simulateStepExecution(step: WorkflowStep, timeout: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve();
      }, Math.min(timeout, 50)); // Simulated
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
    if (completedSteps.length === 0) {
      for (const step of execution.steps.values()) {
        step.status = "rolled_back";
      }
      return;
    }

    for (const entry of completedSteps) {
      const step = execution.steps.get(entry.nodeId);
      if (!step) continue;

      // Simulate rollback action
      await this.simulateRollback(entry);

      step.status = "rolled_back";
    }
  }

  private async simulateRollback(entry: RollbackHistoryEntry): Promise<void> {
    // Simulated rollback - in real implementation would call rollback handlers
    void entry;
    await Promise.resolve();
  }

  private buildResult(
    execution: WorkflowExecution,
    startTime: number,
    checkpointRef?: string,
    error?: string,
  ): SubWorkflowExecutionResult {
    const result: SubWorkflowExecutionResult = {
      subWorkflowRunId: execution.executionId,
      executionId: execution.executionId,
      harnessRunId: execution.context.harnessRunId ?? execution.context.executionId,
      planGraphBundleId: execution.definition.workflowId,
      workflowId: execution.definition.workflowId,
      status: execution.status,
      steps: this.getSteps(execution.executionId),
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
          nodeId: s.nodeId ?? s.stepId,
          stepId: s.stepId,
          name: s.name,
          output: s.output,
        })),
      };
    }

    this.executionResults.push(result);
    return result;
  }

  private resolveStepLookupKey(execution: WorkflowExecution, reference: string): string {
    if (execution.steps.has(reference)) {
      return reference;
    }
    const matched = execution.definition.steps.find((step) => step.stepId === reference);
    return matched ? canonicalStepId(matched) : reference;
  }

  private resolveDefinitionReference(execution: WorkflowExecution, reference: string): string {
    return this.resolveStepLookupKey(execution, reference);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

export function createSubWorkflowExecutor(options?: SubWorkflowExecutorOptions): SubWorkflowExecutor {
  return new SubWorkflowExecutor(options);
}
