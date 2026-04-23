/**
 * WorkflowRepository - Data access for workflow state records.
 *
 * This repository handles all data access for:
 * - WorkflowStateRecord (workflow_state table)
 *
 * All SQL queries use proper column aliasing to match the camelCase domain types.
 */
import { execute, queryOne, queryAll } from "../query-helper.js";
import { resolveTenantScope } from "../authoritative-task-store-types.js";
export class WorkflowRepository {
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    insertWorkflowState(workflow) {
        this.conn
            .prepare(`INSERT INTO workflow_state (
          task_id, division_id, workflow_id, current_step_index, status, outputs_json,
          last_error_code, retry_count, resumable_from_step, started_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(workflow.taskId, workflow.divisionId, workflow.workflowId, workflow.currentStepIndex, workflow.status, workflow.outputsJson, workflow.lastErrorCode, workflow.retryCount, workflow.resumableFromStep, workflow.startedAt, workflow.updatedAt);
    }
    insertStepOutput(stepOutput) {
        this.conn
            .prepare(`INSERT INTO workflow_step_outputs (
          id, task_id, step_id, role_id, status, data_json, summary, artifacts_json,
          token_cost, duration_ms, validation_json, produced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(stepOutput.id, stepOutput.taskId, stepOutput.stepId, stepOutput.roleId, stepOutput.status, stepOutput.dataJson, stepOutput.summary, stepOutput.artifactsJson, stepOutput.tokenCost, stepOutput.durationMs, stepOutput.validationJson, stepOutput.producedAt);
    }
    /**
     * Get workflow state for a task.
     */
    getWorkflowState(taskId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            return queryOne(this.conn, `SELECT
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
           AND t.tenant_id = ?`, taskId, scopedTenantId) ?? null;
        }
        return queryOne(this.conn, `SELECT
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
       WHERE task_id = ?`, taskId) ?? null;
    }
    /**
     * List all workflow states.
     */
    listWorkflowStates(tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        return queryAll(this.conn, `SELECT
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
       ${scopedTenantId !== undefined ? "WHERE task_id IN (SELECT id FROM tasks WHERE tenant_id = ?)" : ""}`, ...(scopedTenantId !== undefined ? [scopedTenantId] : []));
    }
    updateWorkflowState(taskId, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep = null) {
        execute(this.conn, `UPDATE workflow_state
       SET status = ?, current_step_index = ?, outputs_json = ?, updated_at = ?, resumable_from_step = ?
       WHERE task_id = ?`, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep, taskId);
    }
    updateWorkflowStateCas(taskId, expectedVersion, expectedStatus, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep = null) {
        const result = this.conn.prepare(`UPDATE workflow_state
       SET status = ?, current_step_index = ?, outputs_json = ?, updated_at = ?, resumable_from_step = ?
       WHERE task_id = ? AND current_step_index = ? AND status = ?`).run(status, currentStepIndex, outputsJson, updatedAt, resumableFromStep, taskId, expectedVersion, expectedStatus);
        return Number(result.changes);
    }
    updateWorkflowRecoveryState(input) {
        execute(this.conn, `UPDATE workflow_state
       SET status = ?, current_step_index = ?, outputs_json = ?, updated_at = ?,
           resumable_from_step = ?, retry_count = ?, last_error_code = ?
       WHERE task_id = ?`, input.status, input.currentStepIndex, input.outputsJson, input.updatedAt, input.resumableFromStep, input.retryCount, input.lastErrorCode, input.taskId);
    }
}
//# sourceMappingURL=workflow-repository.js.map