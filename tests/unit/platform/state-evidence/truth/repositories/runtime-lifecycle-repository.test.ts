import assert from "node:assert/strict";
import test from "node:test";

import type {
  RuntimeLifecycleRepository,
} from "../../../../../../src/platform/state-evidence/truth/repositories/runtime-lifecycle-repository.js";

test("RuntimeLifecycleRepository interface can be used as type", () => {
  // This test verifies the interface structure is valid
  const mockRepo: RuntimeLifecycleRepository = {
    updateTaskStatus: () => {},
    updateTaskStatusCas: () => 0,
    updateTaskOutput: () => {},
    updateWorkflowState: () => {},
    updateWorkflowStateCas: () => 0,
    getWorkflowState: () => null,
    updateSessionStatus: () => {},
    updateSessionStatusCas: () => 0,
    updateExecutionStatus: () => {},
    updateExecutionStatusCas: () => 0,
    createTier1StatusEvent: () => ({ id: "evt-1", taskId: "task-1", sessionId: null, executionId: null, eventType: "test", payloadJson: "{}", traceId: "trace-1", eventTier: "tier_1", createdAt: "2026-04-26T10:00:00.000Z" }),
    insertApproval: () => {},
    getApproval: () => null,
    listApprovalsByTask: () => [],
    updateApprovalDecision: () => {},
    updateApprovalDecisionCas: () => 0,
    updateApprovalRequest: () => {},
    insertEvent: () => ({ id: "evt-1", taskId: "task-1", sessionId: null, executionId: null, eventType: "test", payloadJson: "{}", traceId: "trace-1", eventTier: "tier_1", createdAt: "2026-04-26T10:00:00.000Z" }),
  };

  assert.equal(typeof mockRepo.updateTaskStatus, "function");
  assert.equal(typeof mockRepo.updateTaskStatusCas, "function");
  assert.equal(typeof mockRepo.updateTaskOutput, "function");
  assert.equal(typeof mockRepo.updateWorkflowState, "function");
  assert.equal(typeof mockRepo.updateWorkflowStateCas, "function");
  assert.equal(typeof mockRepo.getWorkflowState, "function");
  assert.equal(typeof mockRepo.updateSessionStatus, "function");
  assert.equal(typeof mockRepo.updateSessionStatusCas, "function");
  assert.equal(typeof mockRepo.updateExecutionStatus, "function");
  assert.equal(typeof mockRepo.updateExecutionStatusCas, "function");
  assert.equal(typeof mockRepo.createTier1StatusEvent, "function");
  assert.equal(typeof mockRepo.insertApproval, "function");
  assert.equal(typeof mockRepo.getApproval, "function");
  assert.equal(typeof mockRepo.listApprovalsByTask, "function");
  assert.equal(typeof mockRepo.updateApprovalDecision, "function");
  assert.equal(typeof mockRepo.updateApprovalDecisionCas, "function");
  assert.equal(typeof mockRepo.updateApprovalRequest, "function");
  assert.equal(typeof mockRepo.insertEvent, "function");
});

test("RuntimeLifecycleRepository.updateTaskStatus signature", () => {
  // Verify the interface method signature
  type UpdateTaskStatusFn = RuntimeLifecycleRepository["updateTaskStatus"];
  // This would be a function that takes (taskId, status, updatedAt, errorCode?, completedAt?)
  // We just verify it compiles
  const fn: UpdateTaskStatusFn = () => {};
  fn("task-123", "running", "2026-04-26T10:00:00.000Z", null, null);
});

test("RuntimeLifecycleRepository.updateTaskStatusCas returns number", () => {
  type UpdateTaskStatusCasFn = RuntimeLifecycleRepository["updateTaskStatusCas"];
  const fn: UpdateTaskStatusCasFn = () => 0;
  const result = fn("task-123", "pending", "running", "2026-04-26T10:00:00.000Z", null, null);
  assert.equal(result, 0);
});

test("RuntimeLifecycleRepository.getWorkflowState can return null", () => {
  type GetWorkflowStateFn = RuntimeLifecycleRepository["getWorkflowState"];
  const fn: GetWorkflowStateFn = () => null;
  const result = fn("task-123");
  assert.equal(result, null);
});

test("RuntimeLifecycleRepository.updateExecutionStatusCas returns number", () => {
  type UpdateExecutionStatusCasFn = RuntimeLifecycleRepository["updateExecutionStatusCas"];
  const fn: UpdateExecutionStatusCasFn = () => 1;
  const result = fn("exec-123", "active", "completed", "2026-04-26T10:00:00.000Z", null, null, null);
  assert.equal(result, 1);
});