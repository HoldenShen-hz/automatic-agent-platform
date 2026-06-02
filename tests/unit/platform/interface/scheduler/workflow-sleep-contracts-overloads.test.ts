/**
 * Unit tests for workflow-sleep-contracts.ts conversion function overloads
 * Tests src/platform/five-plane-interface/scheduler/workflow-sleep-contracts.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  toWorkflowSleepLease,
  toWorkflowResumeWindow,
  type WorkflowSleepLease,
  type WorkflowResumeWindow,
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
    suspensionId: "suspension_overload_1",
    taskId: "task_overload_1",
    executionId: "exec_overload_1",
    workflowId: "wf_overload_1",
    divisionId: "general-ops",
    reasonCode: "test_reason",
    waitKind: "timer",
    status: "active",
    suspendedAt: "2026-05-01T09:00:00.000Z",
    resumeAfter: "2026-05-01T10:00:00.000Z",
    expiresAt: "2026-05-01T12:00:00.000Z",
    checkpointArtifactId: "artifact_overload",
    resumableFromStep: "step_1",
    timeoutPolicy: "remain_pending",
    metadata: { key: "value" },
    ...overrides,
  };
}

// ============================================================
// Tests for toWorkflowSleepLease(taskId, executionId, wakeAt) overload
// ============================================================

test("toWorkflowSleepLease with taskId, executionId, and wakeAt creates minimal lease", () => {
  const taskId = "task_direct_1";
  const executionId = "exec_direct_1";
  const wakeAt = new Date("2026-05-15T14:30:00.000Z");

  const lease = toWorkflowSleepLease(taskId, executionId, wakeAt);

  assert.equal(lease.taskId, taskId);
  assert.equal(lease.executionId, executionId);
  assert.deepEqual(lease.wakeAt, wakeAt);
  assert.equal(lease.suspensionId, undefined);
  assert.equal(lease.workflowId, undefined);
  assert.equal(lease.divisionId, undefined);
  assert.equal(lease.waitKind, undefined);
  assert.equal(lease.status, undefined);
});

test("toWorkflowSleepLease with taskId and null executionId", () => {
  const taskId = "task_null_exec";
  const executionId = null;
  const wakeAt = new Date("2026-05-15T14:30:00.000Z");

  const lease = toWorkflowSleepLease(taskId, executionId, wakeAt);

  assert.equal(lease.taskId, taskId);
  assert.equal(lease.executionId, null);
  assert.deepEqual(lease.wakeAt, wakeAt);
});

test("toWorkflowSleepLease with taskId and no wakeAt defaults to current time", () => {
  const taskId = "task_no_wakeat";
  const executionId = "exec_no_wakeat";

  const before = new Date();
  const lease = toWorkflowSleepLease(taskId, executionId);
  const after = new Date();

  assert.equal(lease.taskId, taskId);
  assert.equal(lease.executionId, executionId);
  assert.ok(lease.wakeAt instanceof Date);
  assert.ok(lease.wakeAt!.getTime() >= before.getTime());
  assert.ok(lease.wakeAt!.getTime() <= after.getTime());
});

test("toWorkflowSleepLease with only taskId", () => {
  const taskId = "task_only";

  const lease = toWorkflowSleepLease(taskId);

  assert.equal(lease.taskId, taskId);
  assert.equal(lease.executionId, null);
  assert.ok(lease.wakeAt instanceof Date);
});

test("toWorkflowSleepLease overload preserves executionId as null", () => {
  const lease = toWorkflowSleepLease("task_null", null, new Date());
  assert.equal(lease.executionId, null);
});

test("toWorkflowSleepLease overload creates lease with wakeAt in future", () => {
  const futureDate = new Date(Date.now() + 3600_000);
  const lease = toWorkflowSleepLease("task_future", "exec_future", futureDate);

  assert.deepEqual(lease.wakeAt, futureDate);
  assert.ok(lease.wakeAt!.getTime() > Date.now());
});

test("toWorkflowSleepLease overload creates lease with wakeAt in past", () => {
  const pastDate = new Date(Date.now() - 3600_000);
  const lease = toWorkflowSleepLease("task_past", "exec_past", pastDate);

  assert.deepEqual(lease.wakeAt, pastDate);
  assert.ok(lease.wakeAt!.getTime() < Date.now());
});

// ============================================================
// Tests for toWorkflowResumeWindow(lease, channel) overload
// ============================================================

test("toWorkflowResumeWindow with lease and channel creates window with correct channel", () => {
  const record = makeRecord({
    resumeAfter: null,
    expiresAt: null,
  });
  const lease = toWorkflowSleepLease(record);
  const channel = "my_channel";

  const window = toWorkflowResumeWindow(lease, channel);

  assert.equal(window.taskId, record.taskId);
  assert.equal(window.channel, channel);
  assert.equal(window.due, false);
  assert.equal(window.expired, false);
  assert.equal(window.nextAction, "wait");
});

test("toWorkflowResumeWindow with lease that has wakeAt uses it for windowStart", () => {
  const wakeAt = new Date("2026-05-20T10:00:00.000Z");
  const lease = toWorkflowSleepLease("task_wakeat", "exec_wakeat", wakeAt);
  const channel = "timer_channel";

  const window = toWorkflowResumeWindow(lease, channel);

  assert.deepEqual(window.windowStart, wakeAt);
  assert.ok(window.windowEnd instanceof Date);
  assert.equal(window.windowEnd!.getTime(), wakeAt.getTime() + 60_000);
  assert.equal(window.channel, channel);
});

test("toWorkflowResumeWindow with lease uses windowStart plus 60 seconds for windowEnd", () => {
  const specificTime = new Date("2026-05-20T15:00:00.000Z");
  const lease = toWorkflowSleepLease("task_60sec", "exec_60sec", specificTime);

  const window = toWorkflowResumeWindow(lease, "test_channel");

  const expectedEnd = new Date(specificTime.getTime() + 60_000);
  assert.deepEqual(window.windowEnd, expectedEnd);
});

test("toWorkflowResumeWindow lease overload preserves taskId and workflowId", () => {
  const record = makeRecord({
    workflowId: "wf_lease_test",
  });
  const lease = toWorkflowSleepLease(record);

  const window = toWorkflowResumeWindow(lease, "preserve_channel");

  assert.equal(window.taskId, record.taskId);
  assert.equal(window.workflowId, record.workflowId);
  assert.equal(window.channel, "preserve_channel");
});

test("toWorkflowResumeWindow lease overload with suspensionId preserved", () => {
  const record = makeRecord({
    suspensionId: "susp_preserve_123",
  });
  const lease = toWorkflowSleepLease(record);

  const window = toWorkflowResumeWindow(lease, "susp_channel");

  assert.equal(window.suspensionId, "susp_preserve_123");
});

// ============================================================
// Tests comparing both overloads side by side
// ============================================================

test("toWorkflowSleepLease overloads produce consistent taskId and executionId", () => {
  const taskId = "task_consistent";
  const executionId = "exec_consistent";

  // From record
  const record = makeRecord({ taskId, executionId });
  const leaseFromRecord = toWorkflowSleepLease(record);

  // From primitives
  const leaseFromPrimitives = toWorkflowSleepLease(taskId, executionId, new Date());

  assert.equal(leaseFromRecord.taskId, leaseFromPrimitives.taskId);
  assert.equal(leaseFromRecord.executionId, leaseFromPrimitives.executionId);
});

test("toWorkflowResumeWindow overloads produce consistent taskId", () => {
  const taskId = "task_window_consistent";

  // From record
  const record = makeRecord({ taskId });
  const windowFromRecord = toWorkflowResumeWindow(record, "2026-05-01T12:00:00.000Z");

  // From lease (with wakeAt)
  const lease = toWorkflowSleepLease(taskId, "exec_1", new Date("2026-05-01T12:00:00.000Z"));
  const windowFromLease = toWorkflowResumeWindow(lease, "channel");

  assert.equal(windowFromRecord.taskId, windowFromLease.taskId);
});

test("toWorkflowResumeWindow lease overload nextAction is wait when no resumeAfter", () => {
  const record = makeRecord({
    resumeAfter: null,
    expiresAt: null,
  });
  const lease = toWorkflowSleepLease(record);

  const window = toWorkflowResumeWindow(lease, "wait_channel");

  assert.equal(window.nextAction, "wait");
});

test("toWorkflowResumeWindow lease overload channel can be any string", () => {
  const lease = toWorkflowSleepLease("task_any_channel", "exec_any", new Date());

  const channels = ["", "default", "queue:cron:1", "special.chars.here"];

  for (const channel of channels) {
    const window = toWorkflowResumeWindow(lease, channel);
    assert.equal(window.channel, channel);
  }
});

test("toWorkflowResumeWindow lease overload with null channel", () => {
  const lease = toWorkflowSleepLease("task_null_ch", "exec_null_ch", new Date());

  const window = toWorkflowResumeWindow(lease, "");

  assert.equal(window.channel, "");
});

test("toWorkflowSleepLease from record preserves all suspension fields", () => {
  const record = makeRecord({
    suspensionId: "susp_full_1",
    waitKind: "external_event",
    status: "resumable",
    timeoutPolicy: "fail_workflow",
  });

  const lease = toWorkflowSleepLease(record);

  assert.equal(lease.suspensionId, "susp_full_1");
  assert.equal(lease.waitKind, "external_event");
  assert.equal(lease.status, "resumable");
  assert.equal(lease.timeoutPolicy, "fail_workflow");
});

test("toWorkflowSleepLease from primitives does not have suspension fields", () => {
  const lease = toWorkflowSleepLease("task_no_susp", "exec_no_susp", new Date());

  assert.equal(lease.suspensionId, undefined);
  assert.equal(lease.waitKind, undefined);
  assert.equal(lease.status, undefined);
  assert.equal(lease.timeoutPolicy, undefined);
});

test("toWorkflowResumeWindow from record includes timeoutPolicy and resumableFromStep", () => {
  const record = makeRecord({
    timeoutPolicy: "fail_workflow",
    resumableFromStep: "checkpoint_3",
  });

  const window = toWorkflowResumeWindow(record, "2026-05-01T12:00:00.000Z");

  assert.equal(window.timeoutPolicy, "fail_workflow");
  assert.equal(window.resumableFromStep, "checkpoint_3");
});