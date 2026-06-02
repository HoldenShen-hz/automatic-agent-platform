import assert from "node:assert/strict";
import test from "node:test";

import {
  toWorkflowSleepLease,
  toWorkflowResumeWindow,
} from "../../../../../src/platform/five-plane-interface/scheduler/workflow-sleep-contracts.js";

interface WorkflowSuspensionRecord {
  suspensionId: string;
  taskId: string;
  executionId: string | null;
  workflowId: string;
  divisionId: string;
  reasonCode: string;
  waitKind: "timer" | "human_input" | "external_event" | "throttled" | "deployment_window";
  status: "active" | "resumable" | "expired" | "cancelled";
  suspendedAt: string;
  resumeAfter: string | null;
  expiresAt: string | null;
  checkpointArtifactId: string | null;
  resumableFromStep: string;
  timeoutPolicy: "fail_workflow" | "remain_pending";
  metadata: Record<string, unknown>;
}

function makeRecord(overrides: Partial<WorkflowSuspensionRecord> = {}): WorkflowSuspensionRecord {
  return {
    suspensionId: "suspension_test_1",
    taskId: "task_001",
    executionId: "exec_001",
    workflowId: "wf_001",
    divisionId: "general-ops",
    reasonCode: "waiting_approval",
    waitKind: "human_input",
    status: "active",
    suspendedAt: "2026-04-20T09:00:00.000Z",
    resumeAfter: "2026-04-20T10:00:00.000Z",
    expiresAt: "2026-04-20T12:00:00.000Z",
    checkpointArtifactId: "artifact_001",
    resumableFromStep: "approval_gate",
    timeoutPolicy: "remain_pending",
    metadata: { reason: "manual approval required" },
    ...overrides,
  };
}

test("toWorkflowSleepLease maps all fields", () => {
  const record = makeRecord();
  const lease = toWorkflowSleepLease(record);

  assert.equal(lease.suspensionId, "suspension_test_1");
  assert.equal(lease.taskId, "task_001");
  assert.equal(lease.workflowId, "wf_001");
  assert.equal(lease.executionId, "exec_001");
  assert.equal(lease.divisionId, "general-ops");
  assert.equal(lease.waitKind, "human_input");
  assert.equal(lease.status, "active");
  assert.equal(lease.suspendedAt, "2026-04-20T09:00:00.000Z");
  assert.equal(lease.resumeAfter, "2026-04-20T10:00:00.000Z");
  assert.equal(lease.expiresAt, "2026-04-20T12:00:00.000Z");
  assert.equal(lease.resumableFromStep, "approval_gate");
  assert.equal(lease.checkpointArtifactId, "artifact_001");
  assert.equal(lease.timeoutPolicy, "remain_pending");
  assert.deepEqual(lease.metadata, { reason: "manual approval required" });
});

test("toWorkflowSleepLease handles null optional fields", () => {
  const record = makeRecord({
    executionId: null,
    resumeAfter: null,
    expiresAt: null,
    checkpointArtifactId: null,
    metadata: {},
  });
  const lease = toWorkflowSleepLease(record);

  assert.equal(lease.executionId, null);
  assert.equal(lease.resumeAfter, null);
  assert.equal(lease.expiresAt, null);
  assert.equal(lease.checkpointArtifactId, null);
  assert.deepEqual(lease.metadata, {});
});

test("toWorkflowResumeWindow returns wait when neither due nor expired", () => {
  const record = makeRecord({
    resumeAfter: "2026-04-20T12:00:00.000Z",
    expiresAt: "2026-04-20T14:00:00.000Z",
  });
  const now = "2026-04-20T10:00:00.000Z";
  const window = toWorkflowResumeWindow(record, now);

  assert.equal(window.due, false);
  assert.equal(window.expired, false);
  assert.equal(window.nextAction, "wait");
  assert.equal(window.dueAt, "2026-04-20T12:00:00.000Z");
  assert.equal(window.expiresAt, "2026-04-20T14:00:00.000Z");
  assert.equal(window.resumableFromStep, "approval_gate");
  assert.equal(window.timeoutPolicy, "remain_pending");
});

test("toWorkflowResumeWindow returns resume when due but not expired", () => {
  const record = makeRecord({
    resumeAfter: "2026-04-20T10:00:00.000Z",
    expiresAt: "2026-04-20T14:00:00.000Z",
  });
  const now = "2026-04-20T11:00:00.000Z";
  const window = toWorkflowResumeWindow(record, now);

  assert.equal(window.due, true);
  assert.equal(window.expired, false);
  assert.equal(window.nextAction, "resume");
});

test("toWorkflowResumeWindow returns expire when expired", () => {
  const record = makeRecord({
    resumeAfter: "2026-04-20T10:00:00.000Z",
    expiresAt: "2026-04-20T12:00:00.000Z",
  });
  const now = "2026-04-20T13:00:00.000Z";
  const window = toWorkflowResumeWindow(record, now);

  assert.equal(window.due, false);
  assert.equal(window.expired, true);
  assert.equal(window.nextAction, "expire");
});

test("toWorkflowResumeWindow handles null resumeAfter (no timer set)", () => {
  const record = makeRecord({
    resumeAfter: null,
    expiresAt: null,
  });
  const now = "2026-04-20T11:00:00.000Z";
  const window = toWorkflowResumeWindow(record, now);

  assert.equal(window.due, false);
  assert.equal(window.expired, false);
  assert.equal(window.nextAction, "wait");
  assert.equal(window.dueAt, null);
  assert.equal(window.expiresAt, null);
});

test("toWorkflowResumeWindow handles null expiresAt", () => {
  const record = makeRecord({
    resumeAfter: "2026-04-20T10:00:00.000Z",
    expiresAt: null,
  });
  const now = "2026-04-20T11:00:00.000Z";
  const window = toWorkflowResumeWindow(record, now);

  assert.equal(window.due, true);
  assert.equal(window.expired, false);
  assert.equal(window.nextAction, "resume");
});

test("toWorkflowResumeWindow uses fail_workflow timeoutPolicy", () => {
  const record = makeRecord({
    resumeAfter: null,
    expiresAt: "2026-04-20T12:00:00.000Z",
    timeoutPolicy: "fail_workflow",
  });
  const now = "2026-04-20T13:00:00.000Z";
  const window = toWorkflowResumeWindow(record, now);

  assert.equal(window.expired, true);
  assert.equal(window.timeoutPolicy, "fail_workflow");
});

test("toWorkflowResumeWindow due exactly at resumeAfter boundary", () => {
  const record = makeRecord({
    resumeAfter: "2026-04-20T10:00:00.000Z",
    expiresAt: "2026-04-20T14:00:00.000Z",
  });
  // exactly at resumeAfter time
  const now = "2026-04-20T10:00:00.000Z";
  const window = toWorkflowResumeWindow(record, now);

  assert.equal(window.due, true);
  assert.equal(window.nextAction, "resume");
});
