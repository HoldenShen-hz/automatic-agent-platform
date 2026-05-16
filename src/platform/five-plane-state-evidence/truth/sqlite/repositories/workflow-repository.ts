/**
 * WorkflowRepository - Data access for workflow state records.
 *
 * This repository handles all data access for:
 * - WorkflowStateRecord (workflow_state table)
 *
 * All SQL queries use proper column aliasing to match the camelCase domain types.
 */

import type { StepOutputRecord, WorkflowStateRecord } from "../sqlite-repository-contracts.js";
import type { SqliteConnection } from "../query-helper.js";
import { execute, queryOne, queryAll } from "../query-helper.js";
import { resolveTenantScope } from "../authoritative-task-store-types.js";

function normalizeWorkflowState(record: WorkflowStateRecord | null): WorkflowStateRecord | null {
  if (record == null) {
    return null;
  }
  return {
    ...record,
    resumableFromStep: normalizeResumableFromStep(record.resumableFromStep),
  };
}

function normalizeWorkflowStates(records: WorkflowStateRecord[]): WorkflowStateRecord[] {
  return records.map((record) => normalizeWorkflowState(record)!);
}

function normalizeResumableFromStep(value: unknown): WorkflowStateRecord["resumableFromStep"] {
  if (value == null) {
    return null;
  }
  return value as WorkflowStateRecord["resumableFromStep"];
}

export class WorkflowRepository {
  public constructor(private readonly conn: SqliteConnection) {}

  public insertWorkflow(workflow: {
    id?: string;
    taskId: string;
    divisionId?: string | null;
    workflowDefinitionId?: string;
    workflowId?: string;
    status: string;
    createdAt?: string;
    startedAt?: string;
    updatedAt: string;
    outputsJson?: string;
  }): void {
    this.insertWorkflowState({
      taskId: workflow.taskId,
      divisionId: workflow.divisionId ?? "general_ops",
      workflowId: workflow.id ?? workflow.workflowId ?? workflow.workflowDefinitionId ?? "workflow",
      currentStepIndex: 0,
      status: workflow.status as WorkflowStateRecord["status"],
      outputsJson: workflow.outputsJson ?? "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: workflow.startedAt ?? workflow.createdAt ?? workflow.updatedAt,
      updatedAt: workflow.updatedAt,
    });
  }

  public insertWorkflowState(workflow: WorkflowStateRecord): void {
    this.ensureTaskForLegacyWorkflow(workflow);
    this.conn
      .prepare(
        `INSERT INTO workflow_state (
          task_id, division_id, workflow_id, current_step_index, status, outputs_json,
          last_error_code, retry_count, resumable_from_step, started_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        workflow.taskId,
        workflow.divisionId ?? "general_ops",
        workflow.workflowId ?? workflow.taskId,
        workflow.currentStepIndex,
        workflow.status,
        workflow.outputsJson,
        workflow.lastErrorCode ?? null,
        workflow.retryCount ?? 0,
        workflow.resumableFromStep ?? null,
        workflow.startedAt ?? workflow.updatedAt,
        workflow.updatedAt,
      );
  }

  private ensureTaskForLegacyWorkflow(workflow: WorkflowStateRecord): void {
    const existing = queryOne<{ id: string }>(
      this.conn,
      "SELECT id FROM tasks WHERE id = ?",
      workflow.taskId,
    );
    if (existing) {
      return;
    }

    execute(
      this.conn,
      `INSERT INTO tasks (
        id, parent_id, root_id, division_id, title, status, source, priority,
        input_json, normalized_input_json, output_json, estimated_cost_usd,
        actual_cost_usd, error_code, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      workflow.taskId,
      null,
      workflow.taskId,
      workflow.divisionId,
      `Workflow ${workflow.workflowId}`,
      workflow.status === "completed" ? "done" : workflow.status === "failed" ? "failed" : "in_progress",
      "system",
      "normal",
      "{}",
      "{}",
      null,
      0,
      0,
      workflow.lastErrorCode,
      workflow.startedAt,
      workflow.updatedAt,
      workflow.status === "completed" || workflow.status === "failed" ? workflow.updatedAt : null,
    );
  }

  public insertStepOutput(stepOutput: StepOutputRecord | {
    id: string;
    workflowId: string;
    stepId: string;
    status: string;
    dataJson: string;
    createdAt: string;
    updatedAt?: string;
    roleId?: string;
    summary?: string | null;
    artifactsJson?: string | null;
    tokenCost?: number;
    durationMs?: number;
    validationJson?: string | null;
  }): void {
    if ("workflowId" in stepOutput && !("taskId" in stepOutput)) {
      this.insertStepOutputForWorkflow(stepOutput);
      return;
    }
    const canonical = stepOutput as StepOutputRecord;
    this.conn
      .prepare(
        `INSERT INTO workflow_step_outputs (
          id, task_id, step_id, role_id, status, data_json, summary, artifacts_json,
          token_cost, duration_ms, validation_json, produced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        canonical.id,
        canonical.taskId,
        canonical.stepId ?? null,
        canonical.roleId,
        canonical.status,
        canonical.dataJson,
        canonical.summary,
        canonical.artifactsJson,
        canonical.tokenCost,
        canonical.durationMs,
        canonical.validationJson,
        canonical.producedAt,
      );
  }

  public insertWorkflowStepOutput(stepOutput: StepOutputRecord): void {
    this.insertStepOutput(stepOutput);
  }

  public insertStepOutputForWorkflow(stepOutput: {
    id: string;
    workflowId: string;
    stepId: string;
    status: string;
    dataJson: string;
    createdAt: string;
    updatedAt?: string;
    roleId?: string;
    summary?: string | null;
    artifactsJson?: string | null;
    tokenCost?: number;
    durationMs?: number;
    validationJson?: string | null;
  }): void {
    const workflow = this.getWorkflow(stepOutput.workflowId);
    this.insertStepOutput({
      id: stepOutput.id,
      taskId: workflow?.taskId ?? stepOutput.workflowId,
      stepId: stepOutput.stepId,
      roleId: stepOutput.roleId ?? "general_executor",
      status: stepOutput.status,
      dataJson: stepOutput.dataJson,
      summary: stepOutput.summary ?? null,
      artifactsJson: stepOutput.artifactsJson ?? null,
      tokenCost: stepOutput.tokenCost ?? 0,
      durationMs: stepOutput.durationMs ?? 0,
      validationJson: stepOutput.validationJson ?? null,
      producedAt: stepOutput.updatedAt ?? stepOutput.createdAt,
    } as StepOutputRecord);
  }

  /**
   * Get workflow state for a task.
   */
  public getWorkflowState(taskId: string, tenantId?: string | null): WorkflowStateRecord | null {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return normalizeWorkflowState(queryOne<WorkflowStateRecord>(
        this.conn,
        `SELECT
          w.task_id AS taskId,
          w.division_id AS divisionId,
          w.workflow_id AS workflowId,
          w.current_step_index AS currentStepIndex,
          w.status,
          w.outputs_json AS outputsJson,
          w.last_error_code AS lastErrorCode,
          w.retry_count AS retryCount,
          w.resumable_from_step AS resumableFromStep,
          w.started_at AS startedAt,
          w.updated_at AS updatedAt
         FROM workflow_state w
         INNER JOIN tasks t ON t.id = w.task_id
         WHERE w.task_id = ?
           AND t.tenant_id = ?`,
        taskId,
        scopedTenantId,
      ) ?? null);
    }
    return normalizeWorkflowState(queryOne<WorkflowStateRecord>(
      this.conn,
      `SELECT
        task_id AS taskId,
        division_id AS divisionId,
        workflow_id AS workflowId,
        current_step_index AS currentStepIndex,
        status,
        outputs_json AS outputsJson,
        last_error_code AS lastErrorCode,
        retry_count AS retryCount,
        resumable_from_step AS resumableFromStep,
        started_at AS startedAt,
        updated_at AS updatedAt
       FROM workflow_state
       WHERE task_id = ?`,
      taskId,
    ) ?? null);
  }

  public getWorkflow(workflowId: string): WorkflowStateRecord | null {
    return normalizeWorkflowState(queryOne<WorkflowStateRecord>(
      this.conn,
      `SELECT
        task_id AS taskId,
        division_id AS divisionId,
        workflow_id AS workflowId,
        current_step_index AS currentStepIndex,
        status,
        outputs_json AS outputsJson,
        last_error_code AS lastErrorCode,
        retry_count AS retryCount,
        resumable_from_step AS resumableFromStep,
        started_at AS startedAt,
        updated_at AS updatedAt
       FROM workflow_state
       WHERE workflow_id = ?`,
      workflowId,
    ) ?? null);
  }

  public listStepOutputsByWorkflow(workflowId: string): StepOutputRecord[] {
    return queryAll<StepOutputRecord>(
      this.conn,
      `SELECT
        o.id,
        o.task_id AS taskId,
        o.step_id AS stepId,
        o.role_id AS roleId,
        o.status,
        o.data_json AS dataJson,
        o.summary,
        o.artifacts_json AS artifactsJson,
        o.token_cost AS tokenCost,
        o.duration_ms AS durationMs,
        o.validation_json AS validationJson,
        o.produced_at AS producedAt
       FROM workflow_step_outputs o
       INNER JOIN workflow_state w ON w.task_id = o.task_id
       WHERE w.workflow_id = ?
       ORDER BY o.produced_at ASC, o.id ASC`,
      workflowId,
    );
  }

  /**
   * List all workflow states.
   */
  public listWorkflowStates(tenantId?: string | null): WorkflowStateRecord[] {
    const scopedTenantId = resolveTenantScope(tenantId);
    return normalizeWorkflowStates(queryAll<WorkflowStateRecord>(
      this.conn,
      `SELECT
        task_id AS taskId,
        division_id AS divisionId,
        workflow_id AS workflowId,
        current_step_index AS currentStepIndex,
        status,
        outputs_json AS outputsJson,
        last_error_code AS lastErrorCode,
        retry_count AS retryCount,
        resumable_from_step AS resumableFromStep,
        started_at AS startedAt,
        updated_at AS updatedAt
       FROM workflow_state
       ${scopedTenantId !== undefined ? "WHERE task_id IN (SELECT id FROM tasks WHERE tenant_id = ?)" : ""}`,
      ...(scopedTenantId !== undefined ? [scopedTenantId] : []),
    ));
  }

  public updateWorkflowState(
    taskId: string,
    status: string,
    currentStepIndex: number,
    outputsJson: string,
    updatedAt: string,
    resumableFromStep: string | null = null,
  ): void {
    execute(
      this.conn,
      `UPDATE workflow_state
       SET status = ?, current_step_index = ?, outputs_json = ?, updated_at = ?, resumable_from_step = ?,
           last_error_code = CASE WHEN ? IN ('running', 'completed') THEN NULL ELSE last_error_code END
       WHERE task_id = ?`,
      status,
      currentStepIndex,
      outputsJson,
      updatedAt,
      resumableFromStep,
      status,
      taskId,
    );
  }

  public updateWorkflowStateCas(
    taskId: string,
    expectedVersion: number,
    expectedStatus: string,
    status: string,
    currentStepIndex: number,
    outputsJson: string,
    updatedAt: string,
    resumableFromStep: string | null = null,
  ): number {
    const result = this.conn.prepare(
      `UPDATE workflow_state
       SET status = ?, current_step_index = ?, outputs_json = ?, updated_at = ?, resumable_from_step = ?,
           last_error_code = CASE WHEN ? IN ('running', 'completed') THEN NULL ELSE last_error_code END
       WHERE task_id = ? AND current_step_index = ? AND status = ?`,
    ).run(status, currentStepIndex, outputsJson, updatedAt, resumableFromStep, status, taskId, expectedVersion, expectedStatus);
    return Number(result.changes);
  }

  public updateWorkflowRecoveryState(input: {
    taskId: string;
    status: string;
    currentStepIndex: number;
    outputsJson: string;
    updatedAt: string;
    resumableFromStep: string | null;
    retryCount: number;
    lastErrorCode: string | null;
  }): void {
    execute(
      this.conn,
      `UPDATE workflow_state
       SET status = ?, current_step_index = ?, outputs_json = ?, updated_at = ?,
           resumable_from_step = ?, retry_count = ?, last_error_code = ?
       WHERE task_id = ?`,
      input.status,
      input.currentStepIndex,
      input.outputsJson,
      input.updatedAt,
      input.resumableFromStep,
      input.retryCount,
      input.lastErrorCode,
      input.taskId,
    );
  }
}
