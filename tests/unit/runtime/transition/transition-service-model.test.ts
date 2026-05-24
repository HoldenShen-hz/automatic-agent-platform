import test from "node:test";
import assert from "node:assert/strict";

import type {
  BlockedApprovalRequestDefinition,
  BlockedForApprovalTransitionCommand,
  BlockedForApprovalTransitionResult,
  TaskTerminalTransitionInput,
} from "../../../../src/platform/five-plane-execution/state-transition/transition-service-model.js";
import type {
  TaskStatus,
  WorkflowStatus,
  SessionStatus,
  ExecutionStatus,
  TaskTerminalStatus,
} from "../../../../src/platform/contracts/types/status.js";
import type { TransitionAuditContext } from "../../../../src/platform/contracts/types/domain.js";

// =============================================================================
// BLOCKED APPROVAL REQUEST DEFINITION TESTS
// =============================================================================

test("BlockedApprovalRequestDefinition accepts valid risk levels", () => {
  const validRiskLevels: Array<"low" | "medium" | "high" | "critical"> = [
    "low",
    "medium",
    "high",
    "critical",
  ];

  for (const riskLevel of validRiskLevels) {
    const definition: BlockedApprovalRequestDefinition = {
      sourceAgentId: "agent-1",
      reason: "Test reason",
      riskLevel,
      options: ["approve", "reject"],
      context: {},
      timeoutPolicy: "reject",
    };
    assert.equal(definition.riskLevel, riskLevel);
  }
});

test("BlockedApprovalRequestDefinition accepts all timeout policies", () => {
  const policies: Array<"reject" | "approve" | "remain_pending"> = [
    "reject",
    "approve",
    "remain_pending",
  ];

  for (const policy of policies) {
    const definition: BlockedApprovalRequestDefinition = {
      sourceAgentId: "agent-1",
      reason: "Test reason",
      riskLevel: "medium",
      options: ["option1"],
      context: {},
      timeoutPolicy: policy,
    };
    assert.equal(definition.timeoutPolicy, policy);
  }
});

test("BlockedApprovalRequestDefinition allows optional approvalId and createdAt", () => {
  // Without optional fields
  const definition1: BlockedApprovalRequestDefinition = {
    sourceAgentId: "agent-1",
    reason: "Test reason",
    riskLevel: "low",
    options: [],
    context: {},
    timeoutPolicy: "approve",
  };
  assert.equal(definition1.approvalId, undefined);
  assert.equal(definition1.createdAt, undefined);

  // With optional fields
  const definition2: BlockedApprovalRequestDefinition = {
    approvalId: "approval-123",
    sourceAgentId: "agent-1",
    reason: "Test reason",
    riskLevel: "high",
    options: ["yes", "no"],
    context: { key: "value" },
    timeoutPolicy: "reject",
    createdAt: "2025-01-01T00:00:00.000Z",
  };
  assert.equal(definition2.approvalId, "approval-123");
  assert.equal(definition2.createdAt, "2025-01-01T00:00:00.000Z");
});

test("BlockedApprovalRequestDefinition context can hold arbitrary data", () => {
  const definition: BlockedApprovalRequestDefinition = {
    sourceAgentId: "agent-1",
    reason: "Test reason",
    riskLevel: "critical",
    options: ["proceed"],
    context: {
      nested: { deep: [1, 2, 3] },
      numberValue: 42,
      boolValue: true,
    },
    timeoutPolicy: "remain_pending",
  };
  assert.deepEqual(definition.context, {
    nested: { deep: [1, 2, 3] },
    numberValue: 42,
    boolValue: true,
  });
});

// =============================================================================
// BLOCKED FOR APPROVAL TRANSITION COMMAND TESTS
// =============================================================================

test("BlockedForApprovalTransitionCommand structure validation", () => {
  const mockContext: TransitionAuditContext = {
    reasonCode: "APPROVAL_REQUIRED",
    traceId: "trace-123",
    occurredAt: "2025-01-01T00:00:00.000Z",
    actorType: "system",
  };

  const command: BlockedForApprovalTransitionCommand = {
    taskId: "task-abc",
    sessionId: "session-xyz",
    executionId: "exec-789",
    currentTaskStatus: "in_progress",
    currentWorkflowStatus: "running",
    currentSessionStatus: "streaming",
    currentExecutionStatus: "executing",
    workflowCurrentStepIndex: 2,
    workflowOutputsJson: '{"step1": "result"}',
    approval: {
      sourceAgentId: "agent-1",
      reason: "Human approval needed",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: {},
      timeoutPolicy: "reject",
    },
    context: mockContext,
  };

  assert.equal(command.taskId, "task-abc");
  assert.equal(command.sessionId, "session-xyz");
  assert.equal(command.executionId, "exec-789");
  assert.equal(command.workflowCurrentStepIndex, 2);
  assert.ok(command.approval);
  assert.equal(command.context.traceId, "trace-123");
});

test("BlockedForApprovalTransitionCommand accepts all valid status values", () => {
  const validStatuses: [TaskStatus, WorkflowStatus, SessionStatus, ExecutionStatus] = [
    "in_progress",
    "running",
    "streaming",
    "executing",
  ];

  const command: BlockedForApprovalTransitionCommand = {
    taskId: "task-1",
    sessionId: "session-1",
    executionId: "exec-1",
    currentTaskStatus: validStatuses[0],
    currentWorkflowStatus: validStatuses[1],
    currentSessionStatus: validStatuses[2],
    currentExecutionStatus: validStatuses[3],
    workflowCurrentStepIndex: 0,
    workflowOutputsJson: "{}",
    approval: {
      sourceAgentId: "agent-1",
      reason: "test",
      riskLevel: "low",
      options: [],
      context: {},
      timeoutPolicy: "approve",
    },
    context: {
      reasonCode: "APPROVAL_TEST",
      traceId: "trace-1",
      occurredAt: "2025-01-01T00:00:00.000Z",
      actorType: "system",
    },
  };

  assert.equal(command.currentTaskStatus, "in_progress");
  assert.equal(command.currentWorkflowStatus, "running");
  assert.equal(command.currentSessionStatus, "streaming");
  assert.equal(command.currentExecutionStatus, "executing");
});

// =============================================================================
// BLOCKED FOR APPROVAL TRANSITION RESULT TESTS
// =============================================================================

test("BlockedForApprovalTransitionResult contains approvalId and createdAt", () => {
  const result: BlockedForApprovalTransitionResult = {
    approvalId: "approval-new-456",
    createdAt: "2025-06-15T10:30:00.000Z",
  };

  assert.equal(result.approvalId, "approval-new-456");
  assert.equal(result.createdAt, "2025-06-15T10:30:00.000Z");
});

// =============================================================================
// TASK TERMINAL TRANSITION INPUT TESTS
// =============================================================================

test("TaskTerminalTransitionInput structure for done terminal status", () => {
  const input: TaskTerminalTransitionInput = {
    taskId: "task-terminal-1",
    sessionId: "session-terminal-1",
    executionId: "exec-terminal-1",
    currentTaskStatus: "in_progress",
    currentWorkflowStatus: "running",
    currentSessionStatus: "streaming",
    currentExecutionStatus: "executing",
    terminalStatus: "done",
    taskOutputJson: '{"result": "success"}',
    outputsJson: '{"steps": []}',
    context: {
      reasonCode: "TASK_DONE",
      traceId: "trace-terminal",
      occurredAt: "2025-01-01T00:00:00.000Z",
      actorType: "system",
    },
  };

  assert.equal(input.taskId, "task-terminal-1");
  assert.equal(input.terminalStatus, "done");
  assert.ok(input.expectedTaskUpdatedAt === undefined);
  assert.ok(input.expectedWorkflowStepIndex === undefined);
});

test("TaskTerminalTransitionInput structure for failed terminal status", () => {
  const input: TaskTerminalTransitionInput = {
    taskId: "task-failed-1",
    sessionId: "session-failed-1",
    executionId: "exec-failed-1",
    currentTaskStatus: "in_progress",
    currentWorkflowStatus: "running",
    currentSessionStatus: "streaming",
    currentExecutionStatus: "executing",
    terminalStatus: "failed",
    taskOutputJson: '{"error": "something went wrong"}',
    outputsJson: '{"steps": []}',
    context: {
      traceId: "trace-failed",
      occurredAt: "2025-01-01T00:00:00.000Z",
      reasonCode: "ERR_EXECUTION_FAILED",
      actorType: "system",
    },
  };

  assert.equal(input.terminalStatus, "failed");
});

test("TaskTerminalTransitionInput structure for cancelled terminal status", () => {
  const input: TaskTerminalTransitionInput = {
    taskId: "task-cancelled-1",
    sessionId: "session-cancelled-1",
    executionId: "exec-cancelled-1",
    currentTaskStatus: "in_progress",
    currentWorkflowStatus: "running",
    currentSessionStatus: "streaming",
    currentExecutionStatus: "executing",
    terminalStatus: "cancelled",
    taskOutputJson: "{}",
    outputsJson: "{}",
    context: {
      reasonCode: "TASK_CANCELLED",
      traceId: "trace-cancelled",
      occurredAt: "2025-01-01T00:00:00.000Z",
      actorType: "user",
    },
  };

  assert.equal(input.terminalStatus, "cancelled");
  assert.equal(input.taskOutputJson, "{}");
});

test("TaskTerminalTransitionInput accepts all TaskTerminalStatus values", () => {
  const terminalStatuses: TaskTerminalStatus[] = ["done", "failed", "cancelled"];

  for (const status of terminalStatuses) {
    const input: TaskTerminalTransitionInput = {
      taskId: "task-1",
      sessionId: "session-1",
      executionId: "exec-1",
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "executing",
      terminalStatus: status,
      taskOutputJson: "{}",
      outputsJson: "{}",
      context: {
        reasonCode: "TASK_TERMINAL",
        traceId: "trace-1",
        occurredAt: "2025-01-01T00:00:00.000Z",
        actorType: "system",
      },
    };
    assert.equal(input.terminalStatus, status);
  }
});

test("TaskTerminalTransitionInput optional expected fields", () => {
  const input: TaskTerminalTransitionInput = {
    taskId: "task-1",
    sessionId: "session-1",
    executionId: "exec-1",
    currentTaskStatus: "in_progress",
    currentWorkflowStatus: "running",
    currentSessionStatus: "streaming",
    currentExecutionStatus: "executing",
    terminalStatus: "done",
    taskOutputJson: "{}",
    outputsJson: "{}",
    context: {
      traceId: "trace-1",
      occurredAt: "2025-01-01T00:00:00.000Z",
      actorType: "system",
      reasonCode: "task_terminal",
    },
    expectedTaskUpdatedAt: "2025-01-01T01:00:00.000Z",
    expectedWorkflowStepIndex: 5,
    expectedSessionUpdatedAt: "2025-01-01T01:00:00.000Z",
    expectedExecutionUpdatedAt: "2025-01-01T01:00:00.000Z",
  };

  assert.equal(input.expectedTaskUpdatedAt, "2025-01-01T01:00:00.000Z");
  assert.equal(input.expectedWorkflowStepIndex, 5);
  assert.equal(input.expectedSessionUpdatedAt, "2025-01-01T01:00:00.000Z");
  assert.equal(input.expectedExecutionUpdatedAt, "2025-01-01T01:00:00.000Z");
});

test("TaskTerminalTransitionInput workflow step index validation", () => {
  const input: TaskTerminalTransitionInput = {
    taskId: "task-steps",
    sessionId: "session-steps",
    executionId: "exec-steps",
    currentTaskStatus: "in_progress",
    currentWorkflowStatus: "running",
    currentSessionStatus: "streaming",
    currentExecutionStatus: "executing",
    terminalStatus: "done",
    taskOutputJson: "{}",
    outputsJson: '{"stepResults": []}',
      context: {
        reasonCode: "WORKFLOW_STEPS",
        traceId: "trace-steps",
        occurredAt: "2025-01-01T00:00:00.000Z",
        actorType: "system",
    },
    expectedWorkflowStepIndex: 10,
  };

  assert.equal(input.expectedWorkflowStepIndex, 10);
  assert.ok(input.expectedWorkflowStepIndex >= 0);
});
