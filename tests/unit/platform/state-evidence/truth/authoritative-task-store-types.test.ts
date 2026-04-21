import assert from "node:assert/strict";
import test from "node:test";

import {
  parseDispatchDecisionTrace,
  mapRuntimeRecoveryRecord,
  resolveTenantScope,
} from "../../../../../src/platform/state-evidence/truth/sqlite/authoritative-task-store-types.js";

test("parseDispatchDecisionTrace returns null for invalid input", () => {
  assert.equal(parseDispatchDecisionTrace("not json"), null);
  assert.equal(parseDispatchDecisionTrace(""), null);
  assert.equal(parseDispatchDecisionTrace("null"), null);
  assert.equal(parseDispatchDecisionTrace("[]"), null);
  assert.equal(parseDispatchDecisionTrace("{}"), null);
});

test("parseDispatchDecisionTrace returns null for missing required fields", () => {
  assert.equal(parseDispatchDecisionTrace('{"ticketId":"t1"}'), null);
  assert.equal(parseDispatchDecisionTrace('{"executionId":"e1"}'), null);
  assert.equal(parseDispatchDecisionTrace('{"ticketId":"t1","executionId":"e1"}'), null);
  assert.equal(parseDispatchDecisionTrace('{"ticketId":"t1","executionId":"e1","taskId":"task1"}'), null);
});

test("parseDispatchDecisionTrace returns null for wrong field types", () => {
  const invalid = JSON.stringify({
    ticketId: "t1",
    executionId: "e1",
    taskId: "task1",
    queueName: 123, // should be string or null
    requiredCapabilities: [],
    evaluations: [],
  });
  assert.equal(parseDispatchDecisionTrace(invalid), null);
});

test("parseDispatchDecisionTrace returns null when capabilities/evaluations are not arrays", () => {
  const invalid = JSON.stringify({
    ticketId: "t1",
    executionId: "e1",
    taskId: "task1",
    queueName: null,
    requiredCapabilities: "not array",
    evaluations: [],
  });
  assert.equal(parseDispatchDecisionTrace(invalid), null);
});

test("parseDispatchDecisionTrace parses valid trace", () => {
  const valid = JSON.stringify({
    ticketId: "ticket-1",
    executionId: "exec-1",
    taskId: "task-1",
    queueName: "default",
    preferredWorkerId: null,
    requiredCapabilities: ["code_edit"],
    evaluations: [{ rule: "always_on", result: true }],
  });
  const result = parseDispatchDecisionTrace(valid);
  assert.notEqual(result, null);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const trace = result!;
  assert.equal(trace.ticketId, "ticket-1");
  assert.equal(trace.executionId, "exec-1");
  assert.equal(trace.taskId, "task-1");
  assert.equal(trace.queueName, "default");
  assert.equal(trace.preferredWorkerId, null);
  assert.deepEqual(trace.requiredCapabilities, ["code_edit"]);
  assert.deepEqual(trace.evaluations, [{ rule: "always_on", result: true }]);
});

test("parseDispatchDecisionTrace handles optional fields as null", () => {
  const valid = JSON.stringify({
    ticketId: "ticket-1",
    executionId: "exec-1",
    taskId: "task-1",
    queueName: null,
    preferredWorkerId: null,
    requiredCapabilities: [],
    evaluations: [],
  });
  const result = parseDispatchDecisionTrace(valid);
  assert.notEqual(result, null);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const trace = result!;
  assert.equal(trace.queueName, null);
  assert.equal(trace.preferredWorkerId, null);
});

test("mapRuntimeRecoveryRecord maps database row to RuntimeRecoveryRecord", () => {
  const row = {
    executionId: "exec-recovery-1",
    taskId: "task-recovery-1",
    divisionId: "div-ops",
    taskStatus: "in_progress",
    status: "executing",
    attempt: 3,
    traceId: "trace-recovery",
    workflowId: "wf-1",
    latestErrorCode: "agent.crash",
    updatedAt: "2026-04-20T12:00:00.000Z",
    lastHeartbeatAt: "2026-04-20T12:00:30.000Z",
    pendingApprovalId: "approval-1",
    precheckId: "precheck-1",
    precheckExecutionId: "exec-recovery-1",
    precheckAllowed: 1,
    precheckReasonCode: "ok",
    precheckResolvedBudgetUsd: 1.5,
    precheckResolvedTimeoutMs: 60000,
    precheckResolvedSandboxMode: "workspace_write",
    precheckResolvedToolsJson: '["browser"]',
    precheckResolvedPathsJson: '["/workspace"]',
    precheckCheckedAt: "2026-04-20T12:00:00.000Z",
  };

  const result = mapRuntimeRecoveryRecord(row);

  assert.equal(result.executionId, "exec-recovery-1");
  assert.equal(result.taskId, "task-recovery-1");
  assert.equal(result.divisionId, "div-ops");
  assert.equal(result.taskStatus, "in_progress");
  assert.equal(result.status, "executing");
  assert.equal(result.attempt, 3);
  assert.equal(result.traceId, "trace-recovery");
  assert.equal(result.workflowId, "wf-1");
  assert.equal(result.latestErrorCode, "agent.crash");
  assert.equal(result.lastHeartbeatAt, "2026-04-20T12:00:30.000Z");
  assert.equal(result.pendingApprovalId, "approval-1");
  assert.notEqual(result.latestPrecheck, null);
  assert.equal(result.latestPrecheck?.id, "precheck-1");
  assert.equal(result.latestPrecheck?.executionId, "exec-recovery-1");
  assert.equal(result.latestPrecheck?.allowed, 1);
});

test("mapRuntimeRecoveryRecord handles null precheck", () => {
  const row = {
    executionId: "exec-no-precheck",
    taskId: "task-no-precheck",
    divisionId: null,
    taskStatus: "queued",
    status: "created",
    attempt: 1,
    traceId: "trace-no-precheck",
    workflowId: null,
    latestErrorCode: null,
    updatedAt: "2026-04-20T12:00:00.000Z",
    lastHeartbeatAt: null,
    pendingApprovalId: null,
    precheckId: null,
    precheckExecutionId: null,
    precheckAllowed: null,
    precheckReasonCode: null,
    precheckResolvedBudgetUsd: null,
    precheckResolvedTimeoutMs: 0,
    precheckResolvedSandboxMode: null,
    precheckResolvedToolsJson: null,
    precheckResolvedPathsJson: null,
    precheckCheckedAt: null,
  };

  const result = mapRuntimeRecoveryRecord(row);

  assert.equal(result.executionId, "exec-no-precheck");
  assert.equal(result.latestPrecheck, null);
  assert.equal(result.divisionId, null);
  assert.equal(result.workflowId, null);
  assert.equal(result.lastHeartbeatAt, null);
});

test("mapRuntimeRecoveryRecord handles string number conversion for precheckResolvedBudgetUsd", () => {
  const row = {
    executionId: "exec-str-num",
    taskId: "task-str-num",
    divisionId: null,
    taskStatus: "in_progress",
    status: "executing",
    attempt: 1,
    traceId: "trace-str",
    workflowId: null,
    latestErrorCode: null,
    updatedAt: "2026-04-20T12:00:00.000Z",
    lastHeartbeatAt: null,
    pendingApprovalId: null,
    precheckId: "precheck-str",
    precheckExecutionId: "exec-str",
    precheckAllowed: 0,
    precheckReasonCode: "budget_exceeded",
    precheckResolvedBudgetUsd: "2.5", // string from database
    precheckResolvedTimeoutMs: 30000,
    precheckResolvedSandboxMode: "workspace_write",
    precheckResolvedToolsJson: null,
    precheckResolvedPathsJson: null,
    precheckCheckedAt: "2026-04-20T12:00:00.000Z",
  };

  const result = mapRuntimeRecoveryRecord(row);

  assert.equal(result.latestPrecheck?.resolvedBudgetUsd, 2.5);
});

test("resolveTenantScope returns undefined when no tenant context", () => {
  // Without tenant context, should return undefined
  const result = resolveTenantScope();
  assert.equal(result, undefined);
});

test("resolveTenantScope returns explicit null as undefined", () => {
  const result = resolveTenantScope(null);
  assert.equal(result, undefined);
});

test("resolveTenantScope returns explicit tenantId when provided", () => {
  const result = resolveTenantScope("tenant-explicit");
  assert.equal(result, "tenant-explicit");
});

test("resolveTenantScope returns explicit string tenantId when provided", () => {
  const result = resolveTenantScope("tenant-string");
  assert.equal(result, "tenant-string");
});
