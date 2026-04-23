/**
 * AsyncWorkflowRepository - Async data access for workflow state records.
 */
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";
import { resolveTenantScope } from "../sqlite/authoritative-task-store-types.js";
export class AsyncWorkflowRepository {
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    async insertWorkflowState(workflow) {
        await asyncExecute(this.conn, `INSERT INTO workflow_state (
        task_id, division_id, workflow_id, current_step_index, status, outputs_json,
        last_error_code, retry_count, resumable_from_step, started_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, workflow.taskId, workflow.divisionId, workflow.workflowId, workflow.currentStepIndex, workflow.status, workflow.outputsJson, workflow.lastErrorCode, workflow.retryCount, workflow.resumableFromStep, workflow.startedAt, workflow.updatedAt);
    }
    async insertStepOutput(stepOutput) {
        await asyncExecute(this.conn, `INSERT INTO workflow_step_outputs (
        id, task_id, step_id, role_id, status, data_json, summary, artifacts_json,
        token_cost, duration_ms, validation_json, produced_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, stepOutput.id, stepOutput.taskId, stepOutput.stepId, stepOutput.roleId, stepOutput.status, stepOutput.dataJson, stepOutput.summary, stepOutput.artifactsJson, stepOutput.tokenCost, stepOutput.durationMs, stepOutput.validationJson, stepOutput.producedAt);
    }
    async getWorkflowState(taskId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            const result = await asyncQueryOne(this.conn, `SELECT w.task_id AS "taskId", w.division_id AS "divisionId", w.workflow_id AS "workflowId",
          w.current_step_index AS "currentStepIndex", w.status, w.outputs_json AS "outputsJson",
          w.last_error_code AS "lastErrorCode", w.retry_count AS "retryCount",
          w.resumable_from_step AS "resumableFromStep", w.started_at AS "startedAt", w.updated_at AS "updatedAt"
         FROM workflow_state w INNER JOIN tasks t ON t.id = w.task_id WHERE w.task_id = $1 AND t.tenant_id = $2`, taskId, scopedTenantId);
            return result ?? null;
        }
        const result = await asyncQueryOne(this.conn, `SELECT task_id AS "taskId", division_id AS "divisionId", workflow_id AS "workflowId",
        current_step_index AS "currentStepIndex", status, outputs_json AS "outputsJson",
        last_error_code AS "lastErrorCode", retry_count AS "retryCount",
        resumable_from_step AS "resumableFromStep", started_at AS "startedAt", updated_at AS "updatedAt"
       FROM workflow_state WHERE task_id = $1`, taskId);
        return result ?? null;
    }
    async listWorkflowStates(tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            return asyncQueryAll(this.conn, `SELECT w.task_id AS "taskId", w.division_id AS "divisionId", w.workflow_id AS "workflowId",
          w.current_step_index AS "currentStepIndex", w.status, w.outputs_json AS "outputsJson",
          w.last_error_code AS "lastErrorCode", w.retry_count AS "retryCount",
          w.resumable_from_step AS "resumableFromStep", w.started_at AS "startedAt", w.updated_at AS "updatedAt"
         FROM workflow_state w WHERE w.task_id IN (SELECT id FROM tasks WHERE tenant_id = $1)`, scopedTenantId);
        }
        return asyncQueryAll(this.conn, `SELECT task_id AS "taskId", division_id AS "divisionId", workflow_id AS "workflowId",
        current_step_index AS "currentStepIndex", status, outputs_json AS "outputsJson",
        last_error_code AS "lastErrorCode", retry_count AS "retryCount",
        resumable_from_step AS "resumableFromStep", started_at AS "startedAt", updated_at AS "updatedAt"
       FROM workflow_state`);
    }
    async updateWorkflowState(taskId, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep = null) {
        await asyncExecute(this.conn, `UPDATE workflow_state SET status = $1, current_step_index = $2, outputs_json = $3, updated_at = $4, resumable_from_step = $5 WHERE task_id = $6`, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep, taskId);
    }
    async updateWorkflowRecoveryState(input) {
        await asyncExecute(this.conn, `UPDATE workflow_state SET status = $1, current_step_index = $2, outputs_json = $3, updated_at = $4,
        resumable_from_step = $5, retry_count = $6, last_error_code = $7 WHERE task_id = $8`, input.status, input.currentStepIndex, input.outputsJson, input.updatedAt, input.resumableFromStep, input.retryCount, input.lastErrorCode, input.taskId);
    }
    async updateWorkflowStateCas(taskId, expectedVersion, expectedStatus, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep = null) {
        return asyncExecute(this.conn, `UPDATE workflow_state SET status = $1, current_step_index = $2, outputs_json = $3, updated_at = $4, resumable_from_step = $5 WHERE task_id = $6 AND current_step_index = $7 AND status = $8`, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep, taskId, expectedVersion, expectedStatus);
    }
}
//# sourceMappingURL=workflow-repository.js.map