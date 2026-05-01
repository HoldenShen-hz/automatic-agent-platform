import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  toWorkflowSleepLease,
  toWorkflowResumeWindow,
  type WorkflowSleepLease,
  type WorkflowResumeWindow,
} from "../../../../src/platform/five-plane-interface/scheduler/workflow-sleep-contracts.js";
import type { WorkflowSuspensionRecord } from "../../../../src/platform/five-plane-interface/scheduler/long-running-workflow-service.js";

function createMockSuspensionRecord(overrides?: Partial<WorkflowSuspensionRecord>): WorkflowSuspensionRecord {
  return {
    suspensionId: "ws_123",
    taskId: "task_456",
    workflowId: "wf_789",
    executionId: "exec_101",
    divisionId: "div_202",
    reasonCode: "timer",
    waitKind: "timer",
    status: "active",
    suspendedAt: "2026-05-01T00:00:00.000Z",
    resumeAfter: "2026-05-01T01:00:00.000Z",
    expiresAt: "2026-05-01T12:00:00.000Z",
    checkpointArtifactId: "art_303",
    resumableFromStep: "step_3",
    timeoutPolicy: "fail_workflow",
    metadata: { key: "value" },
    ...overrides,
  };
}

test("toWorkflowSleepLease maps all fields correctly", () => {
  const record = createMockSuspensionRecord();
  const lease = toWorkflowSleepLease(record);

  assert.equal(lease.suspensionId, record.suspensionId);
  assert.equal(lease.taskId, record.taskId);
  assert.equal(lease.workflowId, record.workflowId);
  assert.equal(lease.executionId, record.executionId);
  assert.equal(lease.divisionId, record.divisionId);
  assert.equal(lease.waitKind, record.waitKind);
  assert.equal(lease.status, record.status);
  assert.equal(lease.suspendedAt, record.suspendedAt);
  assert.equal(lease.resumeAfter, record.resumeAfter);
  assert.equal(lease.expiresAt, record.expiresAt);
  assert.equal(lease.resumableFromStep, record.resumableFromStep);
  assert.equal(lease.checkpointArtifactId, record.checkpointArtifactId);
  assert.equal(lease.timeoutPolicy, record.timeoutPolicy);
  assert.deepEqual(lease.metadata, record.metadata);
});

test("toWorkflowSleepLease preserves readonly fields", () => {
  const record = createMockSuspensionRecord();
  const lease = toWorkflowSleepLease(record);

  assert.equal(typeof lease.suspensionId, "string");
  assert.equal(typeof lease.taskId, "string");
  assert.equal(typeof lease.workflowId, "string");
  assert.equal(typeof lease.executionId, "string");
});

test("toWorkflowResumeWindow marks due when resumeAfter has passed", () => {
  const record = createMockSuspensionRecord({
    resumeAfter: "2026-05-01T00:00:00.000Z",
    expiresAt: "2026-05-01T12:00:00.000Z",
  });
  const now = "2026-05-01T00:30:00.000Z";
  const window = toWorkflowResumeWindow(record, now);

  assert.ok(window.due);
  assert.ok(!window.expired);
  assert.equal(window.nextAction, "resume");
  assert.equal(window.dueAt, record.resumeAfter);
});

test("toWorkflowResumeWindow marks not due when resumeAfter is in future", () => {
  const record = createMockSuspensionRecord({
    resumeAfter: "2026-05-01T02:00:00.000Z",
    expiresAt: "2026-05-01T12:00:00.000Z",
  });
  const now = "2026-05-01T00:30:00.000Z";
  const window = toWorkflowResumeWindow(record, now);

  assert.ok(!window.due);
  assert.ok(!window.expired);
  assert.equal(window.nextAction, "wait");
});

test("toWorkflowResumeWindow marks expired when expiresAt has passed", () => {
  const record = createMockSuspensionRecord({
    resumeAfter: "2026-05-01T01:00:00.000Z",
    expiresAt: "2026-05-01T00:00:00.000Z",
  });
  const now = "2026-05-01T00:30:00.000Z";
  const window = toWorkflowResumeWindow(record, now);

  assert.ok(!window.due);
  assert.ok(window.expired);
  assert.equal(window.nextAction, "expire");
  assert.equal(window.expiresAt, record.expiresAt);
});

test("toWorkflowResumeWindow with null resumeAfter is not due", () => {
  const record = createMockSuspensionRecord({
    resumeAfter: null,
    expiresAt: "2026-05-01T12:00:00.000Z",
  });
  const now = "2026-05-01T00:30:00.000Z";
  const window = toWorkflowResumeWindow(record, now);

  assert.ok(!window.due);
  assert.ok(!window.expired);
  assert.equal(window.nextAction, "wait");
  assert.equal(window.dueAt, null);
});

test("toWorkflowResumeWindow with null expiresAt is not expired", () => {
  const record = createMockSuspensionRecord({
    resumeAfter: null,
    expiresAt: null,
  });
  const now = "2026-05-01T00:30:00.000Z";
  const window = toWorkflowResumeWindow(record, now);

  assert.ok(!window.due);
  assert.ok(!window.expired);
  assert.equal(window.nextAction, "wait");
});

test("toWorkflowResumeWindow maps resumableFromStep correctly", () => {
  const record = createMockSuspensionRecord({
    resumableFromStep: "step_5",
  });
  const now = "2026-05-01T00:30:00.000Z";
  const window = toWorkflowResumeWindow(record, now);

  assert.equal(window.resumableFromStep, "step_5");
  assert.equal(window.timeoutPolicy, record.timeoutPolicy);
});

test("toWorkflowResumeWindow nextAction is resume when exactly at resumeAfter", () => {
  const record = createMockSuspensionRecord({
    resumeAfter: "2026-05-01T00:00:00.000Z",
    expiresAt: "2026-05-01T12:00:00.000Z",
  });
  const now = "2026-05-01T00:00:00.000Z";
  const window = toWorkflowResumeWindow(record, now);

  assert.ok(window.due);
  assert.equal(window.nextAction, "resume");
});
