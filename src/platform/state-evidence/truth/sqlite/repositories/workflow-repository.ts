/**
 * WorkflowRepository - Data access for workflow state records.
 *
 * This repository handles all data access for:
 * - WorkflowStateRecord (workflow_state table)
 *
 * All SQL queries use proper column aliasing to match the camelCase domain types.
 */

import type { StepOutputRecord, WorkflowStateRecord } from "../../../../contracts/types/domain.js";
import type { SqliteConnection } from "../query-helper.js";
import { execute, queryOne, queryAll } from "../query-helper.js";
import { resolveTenantScope } from "../authoritative-task-store-types.js";

export class WorkflowRepository {
  public constructor(private readonly conn: SqliteConnection) {}

  public insertWorkflowState(workflow: WorkflowStateRecord): void {
    this.conn
      .prepare(
        `INSERT INTO workflow_state (
          task_id, division_id, workflow_id, current_step_index, status, outputs_json,
          last_error_code, retry_count, resumable_from_step, started_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        workflow.taskId,
        workflow.divisionId,
        workflow.workflowId,
        workflow.currentStepIndex,
        workflow.status,
        workflow.outputsJson,
        workflow.lastErrorCode,
        workflow.retryCount,
        workflow.resumableFromStep,
        workflow.startedAt,
        workflow.updatedAt,
      );
  }

  public insertStepOutput(stepOutput: StepOutputRecord): void {
    this.conn
      .prepare(
        `INSERT INTO workflow_step_outputs (
          id, task_id, step_id, role_id, status, data_json, summary, artifacts_json,
          token_cost, duration_ms, validation_json, produced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        stepOutput.id,
        stepOutput.taskId,
        stepOutput.stepId,
        stepOutput.roleId,
        stepOutput.status,
        stepOutput.dataJson,
        stepOutput.summary,
        stepOutput.artifactsJson,
        stepOutput.tokenCost,
        stepOutput.durationMs,
        stepOutput.validationJson,
        stepOutput.producedAt,
      );
  }

  /**
   * Get workflow state for a task.
   */
  public getWorkflowState(taskId: string, tenantId?: string | null): WorkflowStateRecord | null {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return queryOne<WorkflowStateRecord>(
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
      ) ?? null;
    }
    return queryOne<WorkflowStateRecord>(
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
    ) ?? null;
  }

  /**
   * List all workflow states.
   */
  public listWorkflowStates(tenantId?: string | null): WorkflowStateRecord[] {
    const scopedTenantId = resolveTenantScope(tenantId);
    return queryAll<WorkflowStateRecord>(
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
    );
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
       SET status = ?, current_step_index = ?, outputs_json = ?, updated_at = ?, resumable_from_step = ?
       WHERE task_id = ?`,
      status,
      currentStepIndex,
      outputsJson,
      updatedAt,
      resumableFromStep,
      taskId,
    );
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
