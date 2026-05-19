/**
 * Inspect CLI Tests
 *
 * Tests for inspect CLI module which inspects tasks, executions, and approvals.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadInspectCliEnv } from "../../../../src/platform/control-plane/config-center/remaining-cli-env-loaders.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
test("loadInspectCliEnv parses task kind", () => {
    const config = loadInspectCliEnv({
        AA_INSPECT_KIND: "task",
        AA_TASK_ID: "task_123",
    });
    assert.equal(config.kind, "task");
    assert.equal(config.taskId, "task_123");
});
test("loadInspectCliEnv parses execution kind", () => {
    const config = loadInspectCliEnv({
        AA_INSPECT_KIND: "execution",
        AA_EXECUTION_ID: "exec_456",
    });
    assert.equal(config.kind, "execution");
    assert.equal(config.executionId, "exec_456");
});
test("loadInspectCliEnv parses approval kind", () => {
    const config = loadInspectCliEnv({
        AA_INSPECT_KIND: "approval",
        AA_APPROVAL_ID: "approval_789",
    });
    assert.equal(config.kind, "approval");
    assert.equal(config.approvalId, "approval_789");
});
test("loadInspectCliEnv parses tasks kind", () => {
    const config = loadInspectCliEnv({
        AA_INSPECT_KIND: "tasks",
        AA_INSPECT_LIMIT: "50",
        AA_TASK_STATUS: "running",
        AA_WORKFLOW_STATUS: "active",
    });
    assert.equal(config.kind, "tasks");
    assert.equal(config.limit, 50);
    assert.equal(config.taskStatus, "running");
    assert.equal(config.workflowStatus, "active");
});
test("loadInspectCliEnv parses workflows kind", () => {
    const config = loadInspectCliEnv({
        AA_INSPECT_KIND: "workflows",
        AA_INSPECT_LIMIT: "25",
        AA_WORKFLOW_ID: "wf_123",
    });
    assert.equal(config.kind, "workflows");
    assert.equal(config.limit, 25);
    assert.equal(config.workflowId, "wf_123");
});
test("loadInspectCliEnv parses decisions kind", () => {
    const config = loadInspectCliEnv({
        AA_INSPECT_KIND: "decisions",
        AA_INSPECT_LIMIT: "10",
        AA_DECISION_TYPE: "approval_decision",
        AA_DECISION_STATUS: "pending",
    });
    assert.equal(config.kind, "decisions");
    assert.equal(config.limit, 10);
    assert.equal(config.decisionType, "approval_decision");
    assert.equal(config.decisionStatus, "pending");
});
test("loadInspectCliEnv parses workers kind", () => {
    const config = loadInspectCliEnv({
        AA_INSPECT_KIND: "workers",
        AA_INSPECT_LIMIT: "100",
        AA_WORKER_STATUS: "active",
        AA_WORKER_PLACEMENT: "dedicated",
        AA_QUEUE_AFFINITY: "high-priority",
    });
    assert.equal(config.kind, "workers");
    assert.equal(config.limit, 100);
    assert.equal(config.workerStatus, "active");
    assert.equal(config.placement, "dedicated");
    assert.equal(config.queueAffinity, "high-priority");
});
test("loadInspectCliEnv parses optional fields - divisionId and hasPendingApproval", () => {
    const config = loadInspectCliEnv({
        AA_INSPECT_KIND: "tasks",
        AA_DIVISION_ID: "div_abc",
        AA_HAS_PENDING_APPROVAL: "true",
    });
    assert.equal(config.divisionId, "div_abc");
    assert.equal(config.hasPendingApproval, true);
});
test("loadInspectCliEnv parses hasPendingApproval as false", () => {
    const config = loadInspectCliEnv({
        AA_INSPECT_KIND: "tasks",
        AA_HAS_PENDING_APPROVAL: "false",
    });
    assert.equal(config.hasPendingApproval, false);
});
test("loadInspectCliEnv parses dbPath from AA_DB_PATH", () => {
    const config = loadInspectCliEnv({
        AA_INSPECT_KIND: "task",
        AA_TASK_ID: "task_123",
        AA_DB_PATH: "/custom/db/path.db",
    });
    assert.equal(config.dbPath, "/custom/db/path.db");
});
test("loadInspectCliEnv throws for missing AA_INSPECT_KIND", () => {
    assert.throws(() => loadInspectCliEnv({}), (e) => e instanceof ValidationError && e.code.includes("missing_env"));
});
test("loadInspectCliEnv throws for invalid AA_INSPECT_KIND", () => {
    assert.throws(() => loadInspectCliEnv({
        AA_INSPECT_KIND: "invalid_kind",
    }), (e) => e instanceof ValidationError && e.code.includes("invalid_env"));
});
test("inspect main function branch - task inspection requires taskId", () => {
    const config = loadInspectCliEnv({
        AA_INSPECT_KIND: "task",
    });
    // For task kind, taskId should be provided via env
    // When not provided, the main function throws ValidationError
    assert.equal(config.taskId, undefined);
});
test("inspect main function branch - tasks kind with limit", () => {
    const config = loadInspectCliEnv({
        AA_INSPECT_KIND: "tasks",
        AA_INSPECT_LIMIT: "50",
    });
    assert.equal(config.kind, "tasks");
    assert.equal(config.limit, 50);
});
test("inspect main function branch - workflows kind with workflowId filter", () => {
    const config = loadInspectCliEnv({
        AA_INSPECT_KIND: "workflows",
        AA_WORKFLOW_ID: "wf_test_123",
    });
    assert.equal(config.kind, "workflows");
    assert.equal(config.workflowId, "wf_test_123");
});
test("inspect main function branch - decisions kind with executionId filter", () => {
    const config = loadInspectCliEnv({
        AA_INSPECT_KIND: "decisions",
        AA_EXECUTION_ID: "exec_def_456",
    });
    assert.equal(config.kind, "decisions");
    assert.equal(config.executionId, "exec_def_456");
});
test("inspect main function branch - workers kind with remoteSessionStatus", () => {
    const config = loadInspectCliEnv({
        AA_INSPECT_KIND: "workers",
        AA_REMOTE_SESSION_STATUS: "connected",
    });
    assert.equal(config.kind, "workers");
    assert.equal(config.remoteSessionStatus, "connected");
});
test("inspect main function branch - unknown kind throws", () => {
    // loadInspectCliEnv throws ValidationError for invalid AA_INSPECT_KIND
    assert.throws(() => loadInspectCliEnv({
        AA_INSPECT_KIND: "unknown",
    }), ValidationError);
});
//# sourceMappingURL=inspect.test.js.map