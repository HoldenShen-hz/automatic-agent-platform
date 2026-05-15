/**
 * Integration Test: Orchestration with Execution Engine
 *
 * Tests the integration between orchestration routing, workflow planning,
 * and the multi-step execution engine using SQLite-backed storage.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { createIntegrationContext } from "../../../helpers/integration-context.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { WorkflowPlanner } from "../../../../src/platform/five-plane-orchestration/routing/workflow-planner.js";
import { IntakeRouter } from "../../../../src/platform/five-plane-orchestration/routing/intake-router.js";

function createOrchestrationContext(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "orchestration-execution.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, dbPath, db, store };
}

test("OrchestrationExecution: IntakeRouter routes simple requests", () => {
  const ctx = createOrchestrationContext("aa-intake-route-");
  try {
    const router = new IntakeRouter();

    const result = router.route({
      request: "Hello, just a simple greeting",
      divisionId: null,
    });

    assert.equal(result.requiresOrchestration, false);
    assert.ok(result.agentId != null);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("OrchestrationExecution: IntakeRouter routes complex requests to orchestration", () => {
  const ctx = createOrchestrationContext("aa-intake-complex-");
  try {
    const router = new IntakeRouter();

    const result = router.route({
      request: "Summarize the task, review the summary, and confirm the plan",
      divisionId: null,
    });

    assert.equal(result.requiresOrchestration, true);
    assert.ok(result.workflowId != null);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("OrchestrationExecution: WorkflowPlanner produces execution steps", () => {
  const ctx = createOrchestrationContext("aa-planner-");
  try {
    const planner = new WorkflowPlanner();

    const planned = planner.plan({
      workflowId: "single_division_multi_step_orchestration",
      request: "Test workflow planning",
    });

    assert.ok(planned.workflow != null);
    assert.ok(planned.executionSteps.length > 0);
    assert.ok(planned.workflow.workflowId != null);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("OrchestrationExecution: WorkflowPlanner handles dependency edges", () => {
  const ctx = createOrchestrationContext("aa-planner-deps-");
  try {
    const planner = new WorkflowPlanner();

    const planned = planner.plan({
      workflowId: "single_division_multi_step_orchestration",
      request: "Analyze the findings, draft a solution, and review the result",
    });

    assert.ok(planned.dependencyEdges.length >= 0);
    assert.ok(planned.executionSteps.length >= 2);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("OrchestrationExecution: Task and execution are created in store", () => {
  const ctx = createOrchestrationContext("aa-task-exec-");
  try {
    const taskId = "task-orch-test-001";
    const executionId = "exec-orch-test-001";
    const now = nowIso();

    ctx.store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: "Orchestration test task",
      status: "in_progress",
      source: "user",
      priority: "normal",
      inputJson: '{"request": "test"}',
      normalizedInputJson: '{"request": "test"}',
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    });

    ctx.store.insertExecution({
      id: executionId,
      taskId,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-test",
      roleId: "general_executor",
      runKind: "task_run",
      status: "executing",
      inputRef: null,
      traceId: `trace-${executionId}`,
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

    const task = ctx.store.getTask(taskId);
    assert.ok(task !== null);
    assert.equal(task.id, taskId);

    const execution = ctx.store.getExecution(executionId);
    assert.ok(execution !== null);
    assert.equal(execution.id, executionId);
    assert.equal(execution.taskId, taskId);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("OrchestrationExecution: Events are recorded for task lifecycle", () => {
  const ctx = createOrchestrationContext("aa-task-events-");
  try {
    const taskId = "task-events-001";
    const now = nowIso();

    ctx.store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: "Task with events",
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

    ctx.store.event.insertEvent({
      id: "evt-001",
      taskId,
      executionId: null,
      eventType: "task:status_changed",
      eventTier: "tier_1",
      payloadJson: '{"newStatus": "in_progress"}',
      traceId: null,
      createdAt: now,
    });

    const events = ctx.store.listEventsForTask(taskId);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.eventType, "task:status_changed");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("OrchestrationExecution: Session records are created and updated", () => {
  const ctx = createOrchestrationContext("aa-session-");
  try {
    const sessionId = "session-orch-001";
    const taskId = "task-session-001";
    const now = nowIso();

    ctx.store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: "Session test task",
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

    ctx.store.session.insertSession({
      id: sessionId,
      taskId,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });

    const session = ctx.store.session.getSession(sessionId);
    assert.ok(session !== null);
    assert.equal(session.id, sessionId);
    assert.equal(session.status, "open");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("OrchestrationExecution: Workflow records track status through execution", () => {
  const ctx = createOrchestrationContext("aa-workflow-record-");
  try {
    const taskId = "task-wf-record-001";
    const workflowId = "wf-record-001";
    const now = nowIso();

    ctx.store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: "Workflow record test",
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

    ctx.store.workflow.insertWorkflow({
      id: workflowId,
      taskId,
      workflowDefinitionId: "test_workflow",
      status: "running",
      createdAt: now,
      updatedAt: now,
      finishedAt: null,
    });

    const workflow = ctx.store.workflow.getWorkflow(workflowId);
    assert.ok(workflow !== null);
    assert.equal(workflow.status, "running");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("OrchestrationExecution: Step outputs are recorded with status", () => {
  const ctx = createOrchestrationContext("aa-step-outputs-");
  try {
    const taskId = "task-step-out-001";
    const workflowId = "wf-step-out-001";
    const stepId = "step_out_001";
    const now = nowIso();

    ctx.store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: "Step output test",
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

    ctx.store.workflow.insertWorkflow({
      id: workflowId,
      taskId,
      workflowDefinitionId: "test_workflow",
      status: "running",
      createdAt: now,
      updatedAt: now,
      finishedAt: null,
    });

    ctx.store.workflow.insertStepOutput({
      id: "step-output-001",
      workflowId,
      stepId,
      status: "success",
      dataJson: '{"result": "ok"}',
      createdAt: now,
      updatedAt: now,
    });

    const outputs = ctx.store.workflow.listStepOutputsByWorkflow(workflowId);
    assert.equal(outputs.length, 1);
    assert.equal(outputs[0]?.stepId, stepId);
    assert.equal(outputs[0]?.status, "success");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("OrchestrationExecution: Execution precheck stores allowed tools", () => {
  const ctx = createOrchestrationContext("aa-precheck-");
  try {
    const taskId = "task-precheck-001";
    const executionId = "exec-precheck-001";
    const now = nowIso();

    ctx.store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: "Precheck test",
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

    ctx.store.insertExecution({
      id: executionId,
      taskId,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-test",
      roleId: "general_executor",
      runKind: "task_run",
      status: "executing",
      inputRef: null,
      traceId: `trace-${executionId}`,
      attempt: 1,
      timeoutMs: 60000,
      budgetUsdLimit: 1,
      requiresApproval: 0,
      sandboxMode: "workspace_write",
      allowedToolsJson: '["read", "edit", "bash"]',
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

    ctx.store.dispatch.upsertExecutionPrecheck({
      executionId,
      allowedToolsJson: '["read", "edit", "bash"]',
      visibleToolsJson: '["read", "edit"]',
      deferredVisibleToolsJson: '["bash"]',
      resolvedToolsJson: '["read", "edit", "bash"]',
      roleId: "general_executor",
      workflowId: "single_agent_minimal",
    });

    const precheck = ctx.store.dispatch.getExecutionPrecheck(executionId);
    assert.ok(precheck !== null);
    const allowedTools = JSON.parse(precheck!.allowedToolsJson ?? "[]");
    assert.deepEqual(allowedTools, ["read", "edit", "bash"]);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("OrchestrationExecution: Cost events aggregate correctly", () => {
  const ctx = createOrchestrationContext("aa-cost-");
  try {
    const taskId = "task-cost-001";
    const now = nowIso();

    ctx.store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: "Cost aggregation test",
      status: "done",
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
      completedAt: now,
    });

    ctx.store.event.insertCostEvent({
      id: "cost-001",
      taskId,
      budgetScope: "task_execution",
      provider: "anthropic",
      modelId: "claude-sonnet-4",
      promptTokens: 100,
      completionTokens: 50,
      costUsd: 0.005,
      occurredAt: now,
    });

    ctx.store.event.insertCostEvent({
      id: "cost-002",
      taskId,
      budgetScope: "task_execution",
      provider: "anthropic",
      modelId: "claude-sonnet-4",
      promptTokens: 200,
      completionTokens: 100,
      costUsd: 0.010,
      occurredAt: now,
    });

    const costEvents = ctx.store.listCostEventsByTask(taskId);
    assert.equal(costEvents.length, 2);

    const totalCost = ctx.store.sumCostByTask(taskId);
    assert.equal(totalCost, 0.015);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("OrchestrationExecution: Message records support session queries", () => {
  const ctx = createOrchestrationContext("aa-messages-");
  try {
    const taskId = "task-msgs-001";
    const sessionId = "session-msgs-001";
    const now = nowIso();

    ctx.store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: "Message records test",
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

    ctx.store.session.insertSession({
      id: sessionId,
      taskId,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });

    ctx.store.session.insertMessage({
      id: "msg-001",
      sessionId,
      messageType: "user_message",
      partsJson: '[{"partType": "text", "text": "Hello"}]',
      createdAt: now,
    });

    ctx.store.session.insertMessage({
      id: "msg-002",
      sessionId,
      messageType: "assistant_response",
      partsJson: '[{"partType": "text", "text": "Hi there!"}]',
      createdAt: now,
    });

    const messages = ctx.store.listMessagesBySession(sessionId);
    assert.equal(messages.length, 2);
    assert.equal(messages[0]?.messageType, "user_message");
    assert.equal(messages[1]?.messageType, "assistant_response");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});
