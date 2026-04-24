import assert from "node:assert/strict";
import test from "node:test";

import * as schedulerIndex from "../../../../../src/platform/interface/scheduler/index.js";
import type {
  WorkflowResumeDecision,
  WorkflowSleepLease,
  WorkflowResumeWindow,
  WorkflowSuspensionRequest,
  WorkflowSuspensionRecord,
  WorkflowSuspensionStatus,
  WorkflowTimeoutPolicy,
  WorkflowWaitKind,
} from "../../../../../src/platform/interface/scheduler/index.js";

test("scheduler index exports WorkflowSleepLease and related types", () => {
  const lease = null as unknown as WorkflowSleepLease;
  const window = null as unknown as WorkflowResumeWindow;
  assert.equal(typeof lease, "object");
  assert.equal(typeof window, "object");
});

test("scheduler index exports WorkflowSuspensionRequest and related types", () => {
  const request = null as unknown as WorkflowSuspensionRequest;
  const record = null as unknown as WorkflowSuspensionRecord;
  assert.equal(typeof request, "object");
  assert.equal(typeof record, "object");
});

test("scheduler index exports WorkflowWaitKind and WorkflowTimeoutPolicy", () => {
  const waitKind: WorkflowWaitKind = "timer";
  const timeoutPolicy: WorkflowTimeoutPolicy = "fail_workflow";
  assert.equal(waitKind, "timer");
  assert.equal(timeoutPolicy, "fail_workflow");
});

test("scheduler index exports WorkflowResumeDecision", () => {
  const decision: WorkflowResumeDecision = {
    suspensionId: "suspension-1",
    taskId: "task-1",
    workflowId: "workflow-1",
    allowed: true,
    reasonCode: "workflow_sleep.resume_allowed",
    nextWorkflowStatus: "resuming",
    resumableFromStep: "step-1",
  };
  assert.equal(decision.allowed, true);
});

test("scheduler index exports LongRunningWorkflowService", () => {
  assert.ok("LongRunningWorkflowService" in schedulerIndex);
  assert.equal(typeof schedulerIndex.LongRunningWorkflowService, "function");
});

test("scheduler index exports conversion functions", () => {
  assert.ok("toWorkflowSleepLease" in schedulerIndex);
  assert.ok("toWorkflowResumeWindow" in schedulerIndex);
  assert.equal(typeof schedulerIndex.toWorkflowSleepLease, "function");
  assert.equal(typeof schedulerIndex.toWorkflowResumeWindow, "function");
});

test("scheduler index exports all WorkflowWaitKind variants", () => {
  const variants: WorkflowWaitKind[] = [
    "timer",
    "human_input",
    "external_event",
    "throttled",
    "deployment_window",
  ];
  assert.equal(variants.length, 5);
});

test("scheduler index exports WorkflowTimeoutPolicy variants", () => {
  const policies: WorkflowTimeoutPolicy[] = ["fail_workflow", "remain_pending"];
  assert.equal(policies.length, 2);
});

test("scheduler index exports WorkflowSuspensionStatus variants", () => {
  const statuses: WorkflowSuspensionStatus[] = ["active", "resumable", "expired", "cancelled"];
  assert.equal(statuses.length, 4);
});
