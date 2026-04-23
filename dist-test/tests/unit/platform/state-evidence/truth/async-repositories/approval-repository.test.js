// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { AsyncApprovalRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/approval-repository.js";
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
function approvalRecord(overrides = {}) {
    return {
        id: "approval-1",
        taskId: "task-1",
        executionId: "exec-1",
        status: "pending",
        requestJson: '{"reason":"high_value_task"}',
        responseJson: null,
        timeoutPolicy: "30m",
        createdAt: now,
        respondedAt: null,
        ...overrides,
    };
}
function takeoverSessionRecord(overrides = {}) {
    return {
        id: "takeover-1",
        taskId: "task-1",
        executionId: "exec-1",
        operatorId: "operator-1",
        status: "active",
        reasonCode: "manual_intervention",
        startedAt: now,
        closedAt: null,
        ...overrides,
    };
}
function operatorActionRecord(overrides = {}) {
    return {
        id: "action-1",
        takeoverSessionId: "takeover-1",
        taskId: "task-1",
        executionId: "exec-1",
        operatorId: "operator-1",
        actionType: "resume",
        reasonCode: "user_requested",
        actionPayloadJson: "{}",
        beforeStateJson: '{"status":"paused"}',
        afterStateJson: '{"status":"running"}',
        createdAt: now,
        ...overrides,
    };
}
// === Approval Tests ===
test("AsyncApprovalRepository listApprovalsByTask returns approvals without tenant", async () => {
    const approval = approvalRecord();
    const { connection, calls } = createConnection({ queryRows: [[approval]] });
    const repo = new AsyncApprovalRepository(connection);
    const result = await repo.listApprovalsByTask("task-1");
    assert.deepEqual(result, [approval]);
    assert.match(calls[0].sql, /FROM approvals/);
    assert.match(calls[0].sql, /WHERE task_id = \$1/);
    assert.doesNotMatch(calls[0].sql, /INNER JOIN tasks/);
});
test("AsyncApprovalRepository listApprovalsByTask returns approvals with tenant", async () => {
    const approval = approvalRecord();
    const { connection, calls } = createConnection({ queryRows: [[approval]] });
    const repo = new AsyncApprovalRepository(connection);
    const result = await repo.listApprovalsByTask("task-1", "tenant-a");
    assert.deepEqual(result, [approval]);
    assert.match(calls[0].sql, /INNER JOIN tasks t ON t\.id = a\.task_id/);
    assert.match(calls[0].sql, /t\.tenant_id = \$2/);
});
test("AsyncApprovalRepository getApproval returns approval when found without tenant", async () => {
    const approval = approvalRecord();
    const { connection, calls } = createConnection({ queryOneRows: [approval] });
    const repo = new AsyncApprovalRepository(connection);
    const result = await repo.getApproval("approval-1");
    assert.deepEqual(result, approval);
    assert.match(calls[0].sql, /FROM approvals/);
    assert.match(calls[0].sql, /WHERE id = \$1/);
});
test("AsyncApprovalRepository getApproval returns approval when found with tenant", async () => {
    const approval = approvalRecord();
    const { connection, calls } = createConnection({ queryOneRows: [approval] });
    const repo = new AsyncApprovalRepository(connection);
    const result = await repo.getApproval("approval-1", "tenant-a");
    assert.deepEqual(result, approval);
    assert.match(calls[0].sql, /INNER JOIN tasks t/);
});
test("AsyncApprovalRepository getApproval returns null when not found", async () => {
    const { connection } = createConnection({ queryOneRows: [undefined] });
    const repo = new AsyncApprovalRepository(connection);
    const result = await repo.getApproval("approval-missing");
    assert.equal(result, null);
});
test("AsyncApprovalRepository insertApproval inserts approval record", async () => {
    const approval = approvalRecord();
    const { connection, calls } = createConnection({ executeResults: [1] });
    const repo = new AsyncApprovalRepository(connection);
    await repo.insertApproval(approval);
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /INSERT INTO approvals/);
});
test("AsyncApprovalRepository updateApprovalDecision updates decision", async () => {
    const { connection, calls } = createConnection({ executeResults: [1] });
    const repo = new AsyncApprovalRepository(connection);
    const result = await repo.updateApprovalDecision({
        approvalId: "approval-1",
        status: "approved",
        responseJson: '{"approved":true}',
        respondedAt: now,
    });
    assert.equal(result, 1);
    assert.match(calls[0].sql, /UPDATE approvals\s+SET status = \$1/);
    assert.match(calls[0].sql, /response_json = \$2/);
    assert.match(calls[0].sql, /responded_at = \$3/);
});
test("AsyncApprovalRepository listApprovalsByStatus returns approvals by status", async () => {
    const approval = approvalRecord();
    const { connection, calls } = createConnection({ queryRows: [[approval]] });
    const repo = new AsyncApprovalRepository(connection);
    const result = await repo.listApprovalsByStatus("pending");
    assert.deepEqual(result, [approval]);
    assert.match(calls[0].sql, /FROM approvals/);
    assert.match(calls[0].sql, /WHERE status = \$1/);
});
// === Takeover Session Tests ===
test("AsyncApprovalRepository listTakeoverSessionsByTask returns sessions without tenant", async () => {
    const session = takeoverSessionRecord();
    const { connection, calls } = createConnection({ queryRows: [[session]] });
    const repo = new AsyncApprovalRepository(connection);
    const result = await repo.listTakeoverSessionsByTask("task-1");
    assert.deepEqual(result, [session]);
    assert.match(calls[0].sql, /FROM takeover_sessions/);
    assert.match(calls[0].sql, /WHERE task_id = \$1/);
});
test("AsyncApprovalRepository listTakeoverSessionsByTask returns sessions with tenant", async () => {
    const session = takeoverSessionRecord();
    const { connection, calls } = createConnection({ queryRows: [[session]] });
    const repo = new AsyncApprovalRepository(connection);
    const result = await repo.listTakeoverSessionsByTask("task-1", "tenant-a");
    assert.deepEqual(result, [session]);
    assert.match(calls[0].sql, /INNER JOIN tasks t ON t\.id = x\.task_id/);
});
test("AsyncApprovalRepository insertTakeoverSession inserts session", async () => {
    const session = takeoverSessionRecord();
    const { connection, calls } = createConnection({ executeResults: [1] });
    const repo = new AsyncApprovalRepository(connection);
    await repo.insertTakeoverSession(session);
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /INSERT INTO takeover_sessions/);
});
test("AsyncApprovalRepository getTakeoverSession returns session when found", async () => {
    const session = takeoverSessionRecord();
    const { connection, calls } = createConnection({ queryOneRows: [session] });
    const repo = new AsyncApprovalRepository(connection);
    const result = await repo.getTakeoverSession("takeover-1");
    assert.deepEqual(result, session);
    assert.match(calls[0].sql, /FROM takeover_sessions/);
});
test("AsyncApprovalRepository getTakeoverSession returns null when not found", async () => {
    const { connection } = createConnection({ queryOneRows: [undefined] });
    const repo = new AsyncApprovalRepository(connection);
    const result = await repo.getTakeoverSession("takeover-missing");
    assert.equal(result, null);
});
test("AsyncApprovalRepository closeTakeoverSession closes session", async () => {
    const { connection, calls } = createConnection({ executeResults: [1] });
    const repo = new AsyncApprovalRepository(connection);
    const result = await repo.closeTakeoverSession("takeover-1", now);
    assert.equal(result, 1);
    assert.match(calls[0].sql, /UPDATE takeover_sessions SET status = 'closed'/);
    assert.deepEqual(calls[0].params, [now, "takeover-1"]);
});
// === Operator Action Tests ===
test("AsyncApprovalRepository insertOperatorAction inserts action", async () => {
    const action = operatorActionRecord();
    const { connection, calls } = createConnection({ executeResults: [1] });
    const repo = new AsyncApprovalRepository(connection);
    await repo.insertOperatorAction(action);
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /INSERT INTO operator_actions/);
});
test("AsyncApprovalRepository listOperatorActionsByTask returns actions without tenant", async () => {
    const action = operatorActionRecord();
    const { connection, calls } = createConnection({ queryRows: [[action]] });
    const repo = new AsyncApprovalRepository(connection);
    const result = await repo.listOperatorActionsByTask("task-1");
    assert.deepEqual(result, [action]);
    assert.match(calls[0].sql, /FROM operator_actions/);
    assert.match(calls[0].sql, /WHERE task_id = \$1/);
});
test("AsyncApprovalRepository listOperatorActionsByTask returns actions with tenant", async () => {
    const action = operatorActionRecord();
    const { connection, calls } = createConnection({ queryRows: [[action]] });
    const repo = new AsyncApprovalRepository(connection);
    const result = await repo.listOperatorActionsByTask("task-1", "tenant-a");
    assert.deepEqual(result, [action]);
    assert.match(calls[0].sql, /INNER JOIN tasks t ON t\.id = o\.task_id/);
});
//# sourceMappingURL=approval-repository.test.js.map