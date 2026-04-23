import assert from "node:assert/strict";
import test from "node:test";
test("SessionRecord structure is correct", () => {
    const record = {
        id: "sess_123",
        taskId: "task_456",
        channel: "cli",
        status: "open",
        externalSessionId: "ext_789",
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:30:00.000Z",
    };
    assert.equal(record.id, "sess_123");
    assert.equal(record.channel, "cli");
    assert.equal(record.status, "open");
});
test("SessionRecord allows null externalSessionId", () => {
    const record = {
        id: "sess_456",
        taskId: "task_123",
        channel: "api",
        status: "completed",
        externalSessionId: null,
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:30:00.000Z",
    };
    assert.equal(record.externalSessionId, null);
});
test("GatewayTargetRecord structure is correct", () => {
    const record = {
        targetId: "tgt_123",
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "telegram_user_456",
        displayName: "John Doe",
        aliasesJson: '["john","johndoe","jdoe"]',
        metadataJson: '{"timezone":"UTC"}',
        source: "directory",
        lastSeenAt: "2026-04-14T00:00:00.000Z",
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(record.targetKind, "user");
    assert.equal(record.displayName, "John Doe");
});
test("GatewayTargetRecord allows minimal definition", () => {
    const record = {
        targetId: "tgt_minimal",
        channel: "slack",
        targetKind: "group",
        externalTargetId: null,
        displayName: "Minimal Group",
        aliasesJson: "[]",
        metadataJson: null,
        source: "session_history",
        lastSeenAt: null,
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(record.metadataJson, null);
    assert.equal(record.lastSeenAt, null);
});
test("MessageRecord structure is correct", () => {
    const record = {
        id: "msg_123",
        sessionId: "sess_456",
        direction: "inbound",
        messageType: "text",
        content: "Hello, world!",
        partsJson: null,
        attachmentsJson: null,
        createdAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(record.direction, "inbound");
    assert.equal(record.content, "Hello, world!");
});
test("MessageRecord allows optional partsJson", () => {
    const record = {
        id: "msg_789",
        sessionId: "sess_456",
        direction: "outbound",
        messageType: "tool_call",
        content: "Tool result",
        partsJson: '{"tool":"read","args":{}}',
        attachmentsJson: null,
        createdAt: "2026-04-14T00:01:00.000Z",
    };
    assert.equal(record.partsJson, '{"tool":"read","args":{}}');
});
test("MessagePart structure is correct", () => {
    const part = {
        partId: "part_123",
        messageId: "msg_456",
        partType: "text",
        sequence: 0,
        contentJson: '{"text":"Hello"}',
        lineageJson: null,
        createdAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(part.partType, "text");
    assert.equal(part.sequence, 0);
});
test("MessagePart allows tool_use type", () => {
    const part = {
        partId: "part_789",
        messageId: "msg_456",
        partType: "tool_use",
        sequence: 1,
        contentJson: '{"name":"read","input":{"path":"/tmp/test.txt"}}',
        lineageJson: '{"parent":"part_123"}',
        createdAt: "2026-04-14T00:00:01.000Z",
    };
    assert.equal(part.partType, "tool_use");
    assert.equal(part.lineageJson, '{"parent":"part_123"}');
});
test("RemoteLogRecord structure is correct", () => {
    const record = {
        id: "rlog_123",
        taskId: "task_456",
        executionId: "exec_789",
        workerId: "worker_abc",
        runtimeInstanceId: "runtime_def",
        level: "info",
        message: "Task completed successfully",
        contextJson: '{"step":3,"durationMs":500}',
        createdAt: "2026-04-14T00:05:00.000Z",
    };
    assert.equal(record.level, "info");
    assert.equal(record.runtimeInstanceId, "runtime_def");
});
test("RemoteLogRecord allows null runtimeInstanceId and contextJson", () => {
    const record = {
        id: "rlog_minimal",
        taskId: "task_123",
        executionId: "exec_456",
        workerId: "worker_abc",
        runtimeInstanceId: null,
        level: "error",
        message: "Connection failed",
        contextJson: null,
        createdAt: "2026-04-14T00:05:00.000Z",
    };
    assert.equal(record.runtimeInstanceId, null);
    assert.equal(record.contextJson, null);
});
test("RemoteLogRecord level accepts all valid values", () => {
    const levels = ["debug", "info", "warn", "error"];
    assert.equal(levels.length, 4);
});
test("ApprovalRecord structure is correct", () => {
    const record = {
        id: "approval_123",
        taskId: "task_456",
        executionId: "exec_789",
        status: "requested",
        requestJson: '{"action":"delete","resource":"file.txt","risk":"high"}',
        responseJson: null,
        timeoutPolicy: "P30D",
        createdAt: "2026-04-14T00:00:00.000Z",
        respondedAt: null,
    };
    assert.equal(record.status, "requested");
    assert.equal(record.timeoutPolicy, "P30D");
});
test("ApprovalRecord allows approved status with response", () => {
    const record = {
        id: "approval_confirmed",
        taskId: "task_123",
        executionId: "exec_456",
        status: "approved",
        requestJson: '{"action":"approve"}',
        responseJson: '{"decision":"approved","comment":"Approved"}',
        timeoutPolicy: "P7D",
        createdAt: "2026-04-14T00:00:00.000Z",
        respondedAt: "2026-04-14T00:01:00.000Z",
    };
    assert.equal(record.status, "approved");
    assert.equal(record.respondedAt, "2026-04-14T00:01:00.000Z");
});
test("ApprovalRecord allows null executionId", () => {
    const record = {
        id: "approval_noexec",
        taskId: "task_123",
        executionId: null,
        status: "requested",
        requestJson: "{}",
        responseJson: null,
        timeoutPolicy: "PT1H",
        createdAt: "2026-04-14T00:00:00.000Z",
        respondedAt: null,
    };
    assert.equal(record.executionId, null);
});
test("TakeoverSessionRecord structure is correct", () => {
    const record = {
        id: "takeover_123",
        taskId: "task_456",
        executionId: "exec_789",
        operatorId: "operator_abc",
        status: "open",
        reasonCode: "debugging",
        startedAt: "2026-04-14T00:00:00.000Z",
        closedAt: null,
    };
    assert.equal(record.status, "open");
    assert.equal(record.operatorId, "operator_abc");
});
test("TakeoverSessionRecord allows closed status", () => {
    const record = {
        id: "takeover_closed",
        taskId: "task_123",
        executionId: "exec_456",
        operatorId: "operator_def",
        status: "closed",
        reasonCode: "completed",
        startedAt: "2026-04-14T00:00:00.000Z",
        closedAt: "2026-04-14T00:30:00.000Z",
    };
    assert.equal(record.status, "closed");
    assert.equal(record.closedAt, "2026-04-14T00:30:00.000Z");
});
test("TakeoverSessionRecord allows null executionId", () => {
    const record = {
        id: "takeover_noexec",
        taskId: "task_789",
        executionId: null,
        operatorId: "operator_ghi",
        status: "open",
        reasonCode: "review",
        startedAt: "2026-04-14T00:00:00.000Z",
        closedAt: null,
    };
    assert.equal(record.executionId, null);
});
test("OperatorActionRecord structure is correct", () => {
    const record = {
        id: "opaction_123",
        takeoverSessionId: "takeover_456",
        taskId: "task_789",
        executionId: "exec_abc",
        operatorId: "operator_def",
        actionType: "retry_execution",
        reasonCode: "previous_failed",
        actionPayloadJson: '{"force":true}',
        beforeStateJson: '{"status":"failed"}',
        afterStateJson: '{"status":"pending"}',
        createdAt: "2026-04-14T00:05:00.000Z",
    };
    assert.equal(record.actionType, "retry_execution");
    assert.equal(record.operatorId, "operator_def");
});
test("OperatorActionRecord allows all action types", () => {
    const actionTypes = [
        "take_over_task",
        "modify_input",
        "retry_execution",
        "skip_step",
        "set_current_step",
        "switch_worker",
        "write_step_output",
        "complete_task",
    ];
    assert.equal(actionTypes.length, 8);
});
test("OperatorActionRecord allows null executionId", () => {
    const record = {
        id: "opaction_minimal",
        takeoverSessionId: "takeover_123",
        taskId: "task_456",
        executionId: null,
        operatorId: "operator_abc",
        actionType: "complete_task",
        reasonCode: "done",
        actionPayloadJson: "{}",
        beforeStateJson: "{}",
        afterStateJson: "{}",
        createdAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(record.executionId, null);
});
//# sourceMappingURL=session-types.test.js.map