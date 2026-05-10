import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { runMultiStepOrchestration } from "../../src/platform/execution/execution-engine/multi-step-orchestration.js";
import { TransitionService } from "../../src/platform/execution/state-transition/transition-service.js";
import { ApprovalService } from "../../src/platform/control-plane/approval-center/approval-service.js";
import { RuntimeStateMachine } from "../../src/platform/five-plane-execution/runtime-state-machine.js";
import { createMinimalHarnessRun } from "../helpers/fixtures/base.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";

function makeTaskCommand(
  taskId: string,
  fromStatus: "queued" | "pending" | "in_progress",
  toStatus: "pending" | "in_progress",
  traceId: string,
  executionId: string | null = null,
) {
  return {
    entityKind: "task" as const,
    entityId: taskId,
    fromStatus,
    toStatus,
    executionId,
    reasonCode: "e2e_critical",
    traceId,
    actorType: "system" as const,
    occurredAt: nowIso(),
  };
}

function makeExecCommand(
  executionId: string,
  fromStatus: "executing",
  toStatus: "succeeded" | "failed",
  traceId: string,
) {
  return {
    entityKind: "execution" as const,
    entityId: executionId,
    fromStatus,
    toStatus,
    reasonCode: "e2e_critical",
    traceId,
    actorType: "agent" as const,
    occurredAt: nowIso(),
  };
}

function createCriticalPlan(): string {
  return `oapeflir://plan ${JSON.stringify([
    {
      stepId: "step_plan",
      action: "plan",
      dependencies: [],
      outputs: ["step_plan"],
      timeout: 30000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
    {
      stepId: "step_execute",
      action: "execute",
      dependencies: ["step_plan"],
      outputs: ["step_execute"],
      timeout: 30000,
      retryPolicy: { maxRetries: 1, backoffMs: 0 },
    },
    {
      stepId: "step_evaluate",
      action: "evaluate",
      dependencies: ["step_execute"],
      outputs: ["step_evaluate"],
      timeout: 30000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
  ])}`;
}

test("E2E Critical: task enters execution through the canonical lifecycle pipeline", () => {
  const harness = createE2EHarness("aa-e2e-critical-task-success-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const transitions = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Critical workflow success task",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ request: "complete this task" }),
        normalizedInputJson: JSON.stringify({ request: "complete this task" }),
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
      // @ts-ignore existing test fixture shape
      harness.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-general",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      harness.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    transitions.transitionTaskStatus(makeTaskCommand(taskId, "queued", "pending", traceId));
    transitions.transitionTaskStatus(makeTaskCommand(taskId, "pending", "in_progress", traceId, executionId));
    transitions.transitionExecutionStatus(makeExecCommand(executionId, "executing", "succeeded", traceId));

    assert.equal(harness.store.getTask(taskId)?.status, "in_progress");
    assert.equal(harness.store.getExecution(executionId)?.status, "succeeded");
    assert.equal(harness.store.getSession(sessionId)?.status, "streaming");
  } finally {
    harness.cleanup();
  }
});

test("E2E Critical: execution failure is recorded without relying on legacy workflow state", () => {
  const harness = createE2EHarness("aa-e2e-critical-task-failed-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const transitions = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Critical workflow failed task",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
      // @ts-ignore existing test fixture shape
      harness.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      harness.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    transitions.transitionExecutionStatus(makeExecCommand(executionId, "executing", "failed", traceId));

    assert.equal(harness.store.getTask(taskId)?.status, "in_progress");
    assert.equal(harness.store.getExecution(executionId)?.status, "failed");
    assert.equal(harness.store.getSession(sessionId)?.status, "streaming");
  } finally {
    harness.cleanup();
  }
});

test("E2E Critical: multi-step workflow executes via canonical PlanGraphBundle dispatch", async () => {
  const harness = createE2EHarness("aa-e2e-critical-canonical-workflow-");
  try {
    const result = await runMultiStepOrchestration({
      dbPath: harness.dbPath,
      title: "Critical canonical workflow",
      request: createCriticalPlan(),
      stepOutputOverrides: {
        step_plan: { plan: "approved plan" },
        step_execute: { execution: "applied change" },
        step_evaluate: { verdict: "accepted" },
      },
    });

    assert.equal(result.routing.routeReason, "oapeflir_bridge");
    assert.ok(result.snapshot.task);
    assert.ok(result.snapshot.workflow);
    assert.ok(result.plannedWorkflow.workflow.workflowId.startsWith("oapeflir_"));
  } finally {
    harness.cleanup();
  }
});

test("E2E Critical: approval request blocks and resumes execution through ApprovalService", () => {
  const harness = createE2EHarness("aa-e2e-critical-approval-");
  try {
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: "task-approval-critical",
        parentId: null,
        rootId: "task-approval-critical",
        divisionId: "general_ops",
        title: "Approval critical task",
        status: "in_progress",
        source: "user",
        priority: "high",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        completedAt: null,
      });
      // @ts-ignore existing test fixture shape
      harness.store.insertExecution({
        id: "exec-approval-critical",
        taskId: "task-approval-critical",
        workflowId: "approval_workflow",
        parentExecutionId: null,
        agentId: "agent-runtime",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: newId("trace"),
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 1,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: nowIso(),
        finishedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    });
    const approvals = new ApprovalService(harness.db, harness.store);
    const approval = approvals.createRequest({
      taskId: "task-approval-critical",
      executionId: "exec-approval-critical",
      sourceAgentId: "agent-runtime",
      reason: "high risk write requires approval",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: {
        action: "write_file",
        constraints: ["workspace-only"],
      },
      timeoutPolicy: "reject",
    });

    assert.equal(approval.status, "pending");

    approvals.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "option_selected",
      selectedOptionId: "approve",
      respondedBy: "operator-1",
      respondedAt: "2026-05-10T12:00:00.000Z",
    });

    const storedApproval = harness.store.getApproval(approval.approvalId);
    assert.equal(storedApproval?.status, "approved");
    const events = harness.store.listEventsForTask("task-approval-critical").map((event) => event.eventType);
    assert.equal(events.includes("decision:requested"), true);
    assert.equal(events.includes("decision:responded"), true);
  } finally {
    harness.cleanup();
  }
});

test("E2E Critical: cancelled HarnessRun remains terminal under canonical runtime state machine", () => {
  const machine = new RuntimeStateMachine();
  const run = createMinimalHarnessRun({
    status: "cancelled",
    terminalAt: "2026-05-10T12:00:00.000Z",
    terminalReason: "operator.cancelled",
    fencingToken: "fence-critical-cancelled",
  });

  assert.throws(() => machine.transition({
    commandId: newId("cmd"),
    entityType: "HarnessRun",
    entityId: run.harnessRunId,
    principal: "critical-e2e",
    aggregateType: "HarnessRun",
    aggregate: run,
    fromStatus: "cancelled",
    toStatus: "running",
    tenantId: run.tenantId,
    traceId: newId("trace"),
    reasonCode: "invalid.resume_after_cancel",
    emittedBy: "tests/e2e/critical-workflows.test.ts",
    fencingToken: run.fencingToken ?? "fence-critical-cancelled",
    auditRef: "audit://critical/cancelled-terminal",
  }));
});
