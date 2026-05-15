/**
 * Unit tests for Scheduler Module
 */

import assert from "node:assert/strict";
import test from "node:test";

import { LongRunningWorkflowService } from "../../../../../src/platform/five-plane-interface/scheduler/long-running-workflow-service.js";
import { toWorkflowSleepLease, toWorkflowResumeWindow } from "../../../../../src/platform/five-plane-interface/scheduler/workflow-sleep-contracts.js";

test("LongRunningWorkflowService can be instantiated with a store", () => {
  // Create a mock store that satisfies the minimum interface
  const mockStore = {
    getWorkflowState: () => null,
    updateWorkflowState: () => {},
    insertWorkflowState: () => {},
    insertTask: () => {},
    getTask: () => null,
    getExecution: () => null,
    listExecutions: () => [],
  } as any;

  const service = new LongRunningWorkflowService(mockStore);
  assert.ok(service instanceof LongRunningWorkflowService);
});

test("toWorkflowSleepLease converts wakeAt to sleep lease structure", () => {
  const wakeAt = new Date("2026-04-30T12:00:00.000Z");
  const lease = toWorkflowSleepLease("task-123", "exec-456", wakeAt);

  assert.equal(lease.taskId, "task-123");
  assert.equal(lease.executionId, "exec-456");
  assert.deepEqual(lease.wakeAt, wakeAt);
});

test("toWorkflowResumeWindow creates resume window from lease", () => {
  const lease = {
    taskId: "task-123",
    executionId: "exec-456",
    wakeAt: new Date("2026-04-30T12:00:00.000Z"),
  };

  const window = toWorkflowResumeWindow(lease, "channel-telegram");

  assert.equal(window.taskId, "task-123");
  assert.deepEqual(window.windowStart, lease.wakeAt);
  assert.equal(window.channel, "channel-telegram");
});

test("toWorkflowSleepLease preserves task and execution IDs", () => {
  const taskId = "task-special-123";
  const executionId = "exec-special-456";
  const wakeAt = new Date();

  const lease = toWorkflowSleepLease(taskId, executionId, wakeAt);

  assert.equal(lease.taskId, taskId);
  assert.equal(lease.executionId, executionId);
});

test("toWorkflowResumeWindow calculates window boundaries correctly", () => {
  const wakeAt = new Date("2026-04-30T12:00:00.000Z");
  const lease = {
    taskId: "task-123",
    executionId: "exec-456",
    wakeAt,
  };

  const window = toWorkflowResumeWindow(lease, "telegram");

  assert.deepEqual(window.windowStart, wakeAt);
  // Window end should be windowStart + default resume window (60 seconds)
  assert.ok(window.windowEnd.getTime() > wakeAt.getTime());
});
