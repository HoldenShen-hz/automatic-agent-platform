// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { AsyncWorkflowRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/workflow-repository.js";
function createConnection(options = {}) {
    const calls = [];
    let queryIndex = 0;
    let queryOneIndex = 0;
    let executeIndex = 0;
    const connection = {
        async query(sql, ...params) {
            calls.push({ method: "query", sql, params });
            const rows = (options.queryRows?.[queryIndex++] ?? []);
            return { rows, rowCount: rows.length, changes: rows.length };
        },
        async queryOne(sql, ...params) {
            calls.push({ method: "queryOne", sql, params });
            return options.queryOneRows?.[queryOneIndex++];
        },
        async execute(sql, ...params) {
            calls.push({ method: "execute", sql, params });
            return options.executeResults?.[executeIndex++] ?? 1;
        },
    };
    return { connection, calls };
}
const now = "2026-04-23T10:00:00.000Z";
function workflowStateRecord(overrides = {}) {
    return {
        taskId: "task-1",
        divisionId: "div-1",
        workflowId: "wf-1",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "[]",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
        ...overrides,
    };
}
function stepOutputRecord(overrides = {}) {
    return {
        id: "step-out-1",
        taskId: "task-1",
        stepId: "step-1",
        roleId: "role-1",
        status: "completed",
        dataJson: '{"result":"ok"}',
        summary: "Step completed",
        artifactsJson: "[]",
        tokenCost: 100,
        durationMs: 500,
        validationJson: null,
        producedAt: now,
        ...overrides,
    };
}
test("AsyncWorkflowRepository insertWorkflowState inserts workflow state", async () => {
    const workflow = workflowStateRecord();
    const { connection, calls } = createConnection({ executeResults: [1] });
    const repo = new AsyncWorkflowRepository(connection);
    await repo.insertWorkflowState(workflow);
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /INSERT INTO workflow_state/);
    assert.match(calls[0].sql, /task_id, division_id, workflow_id/);
});
test("AsyncWorkflowRepository insertStepOutput inserts step output", async () => {
    const stepOutput = stepOutputRecord();
    const { connection, calls } = createConnection({ executeResults: [1] });
    const repo = new AsyncWorkflowRepository(connection);
    await repo.insertStepOutput(stepOutput);
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /INSERT INTO workflow_step_outputs/);
});
test("AsyncWorkflowRepository getWorkflowState returns workflow when found without tenant", async () => {
    const workflow = workflowStateRecord();
    const { connection, calls } = createConnection({ queryOneRows: [workflow] });
    const repo = new AsyncWorkflowRepository(connection);
    const result = await repo.getWorkflowState("task-1");
    assert.deepEqual(result, workflow);
    assert.match(calls[0].sql, /FROM workflow_state WHERE task_id = \$1/);
    assert.doesNotMatch(calls[0].sql, /INNER JOIN tasks/);
});
test("AsyncWorkflowRepository getWorkflowState returns workflow when found with tenant", async () => {
    const workflow = workflowStateRecord();
    const { connection, calls } = createConnection({ queryOneRows: [workflow] });
    const repo = new AsyncWorkflowRepository(connection);
    const result = await repo.getWorkflowState("task-1", "tenant-a");
    assert.deepEqual(result, workflow);
    assert.match(calls[0].sql, /INNER JOIN tasks t ON t\.id = w\.task_id/);
    assert.match(calls[0].sql, /t\.tenant_id = \$2/);
});
test("AsyncWorkflowRepository getWorkflowState returns null when not found", async () => {
    const { connection } = createConnection({ queryOneRows: [undefined] });
    const repo = new AsyncWorkflowRepository(connection);
    const result = await repo.getWorkflowState("task-missing");
    assert.equal(result, null);
});
test("AsyncWorkflowRepository listWorkflowStates returns workflows without tenant", async () => {
    const workflow = workflowStateRecord();
    const { connection, calls } = createConnection({ queryRows: [[workflow]] });
    const repo = new AsyncWorkflowRepository(connection);
    const result = await repo.listWorkflowStates();
    assert.deepEqual(result, [workflow]);
    assert.match(calls[0].sql, /FROM workflow_state/);
    assert.doesNotMatch(calls[0].sql, /WHERE w\.task_id IN/);
});
test("AsyncWorkflowRepository listWorkflowStates returns workflows with tenant", async () => {
    const workflow = workflowStateRecord();
    const { connection, calls } = createConnection({ queryRows: [[workflow]] });
    const repo = new AsyncWorkflowRepository(connection);
    const result = await repo.listWorkflowStates("tenant-a");
    assert.deepEqual(result, [workflow]);
    assert.match(calls[0].sql, /WHERE w\.task_id IN \(SELECT id FROM tasks WHERE tenant_id = \$1\)/);
    assert.deepEqual(calls[0].params, ["tenant-a"]);
});
test("AsyncWorkflowRepository updateWorkflowState updates workflow state", async () => {
    const { connection, calls } = createConnection({ executeResults: [1] });
    const repo = new AsyncWorkflowRepository(connection);
    await repo.updateWorkflowState("task-1", "running", 2, "[]", now, null);
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /UPDATE workflow_state SET status = \$1/);
    assert.match(calls[0].sql, /current_step_index = \$2/);
    assert.match(calls[0].sql, /outputs_json = \$3/);
    assert.match(calls[0].sql, /resumable_from_step = \$5/);
});
test("AsyncWorkflowRepository updateWorkflowRecoveryState updates recovery fields", async () => {
    const { connection, calls } = createConnection({ executeResults: [1] });
    const repo = new AsyncWorkflowRepository(connection);
    await repo.updateWorkflowRecoveryState({
        taskId: "task-1",
        status: "failed",
        currentStepIndex: 2,
        outputsJson: '{"error":"failed"}',
        updatedAt: now,
        resumableFromStep: "1",
        retryCount: 3,
        lastErrorCode: "ERR_STEP_FAILED",
    });
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /UPDATE workflow_state SET status = \$1/);
    assert.match(calls[0].sql, /retry_count = \$6/);
    assert.match(calls[0].sql, /last_error_code = \$7/);
});
test("AsyncWorkflowRepository updateWorkflowStateCas returns affected row count", async () => {
    const { connection, calls } = createConnection({ executeResults: [1] });
    const repo = new AsyncWorkflowRepository(connection);
    const result = await repo.updateWorkflowStateCas("task-1", 1, "running", "completed", 3, '{"result":"done"}', now, null);
    assert.equal(result, 1);
    assert.match(calls[0].sql, /WHERE task_id = \$6 AND current_step_index = \$7 AND status = \$8/);
});
//# sourceMappingURL=workflow-repository.test.js.map