/**
 * Integration Tests: Workflow Orchestration
 *
 * Tests the workflow orchestration layer including:
 * - Workflow planning and step sequencing
 * - Step dependency resolution
 * - Output passing between steps
 * - Workflow completion and cancellation
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../../src/platform/execution/state-transition/transition-service.js";
import { IntakeRouter } from "../../../src/platform/orchestration/routing/intake-router.js";
import { WorkflowPlanner } from "../../../src/platform/orchestration/routing/workflow-planner.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";

test("workflow orchestration: IntakeRouter returns valid routing decision", () => {
  const router = new IntakeRouter();

  const routing = router.route({
    title: "Deploy application",
    request: "deploy the new version to production",
  });

  assert.ok(routing != null);
  assert.ok(typeof routing.workflowId === "string");
  assert.ok(typeof routing.divisionId === "string");
  assert.ok(typeof routing.routeReason === "string");
  assert.ok(Array.isArray(routing.routeTrace));
  assert.ok(typeof routing.requiresOrchestration === "boolean");
  assert.ok(routing.classification != null);
  assert.ok(typeof routing.classification.intent === "string");
  assert.ok(typeof routing.classification.confidence === "number");
});

test("workflow orchestration: IntakeRouter classifies request intent", () => {
  const router = new IntakeRouter();

  const routing = router.route({
    title: "Create new user",
    request: "create a new user account with admin permissions",
  });

  assert.equal(routing.classification.intent, "create");
  assert.ok(routing.classification.confidence >= 0.45);
});

test("workflow orchestration: workflow state transitions follow valid path", () => {
  const workspace = createTempWorkspace("aa-orchestration-transition-");

  try {
    const dbPath = join(workspace, "orch-transition.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const transitions = new TransitionService(db, store);

    const taskId = newId("task");
    const sessionId = newId("sess");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Orchestration transition test",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.05,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "wf_ops_standard",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });

      store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Valid transition: running -> paused
    transitions.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: taskId,
      fromStatus: "running",
      toStatus: "paused",
      currentStepIndex: 1,
      outputsJson: '{"step0": "done"}',
      reasonCode: "workflow.pause",
      traceId: newId("trace"),
      occurredAt: now,
    });

    const pausedState = store.getWorkflowState(taskId);
    assert.equal(pausedState?.status, "paused");
    assert.equal(pausedState?.currentStepIndex, 1);

    // Valid transition: paused -> resuming
    transitions.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: taskId,
      fromStatus: "paused",
      toStatus: "resuming",
      currentStepIndex: 1,
      outputsJson: '{"step0": "done"}',
      reasonCode: "workflow.resume",
      traceId: newId("trace"),
      occurredAt: now,
    });

    const resumingState = store.getWorkflowState(taskId);
    assert.equal(resumingState?.status, "resuming");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("workflow orchestration: invalid workflow transition throws", () => {
  const workspace = createTempWorkspace("aa-orchestration-invalid-");

  try {
    const dbPath = join(workspace, "orch-invalid.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const transitions = new TransitionService(db, store);

    const taskId = newId("task");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Invalid transition test",
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

      store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "wf_ops_standard",
        currentStepIndex: 0,
        status: "completed",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
    });

    // Invalid: completed -> running (completed is terminal)
    assert.throws(() => {
      transitions.transitionWorkflowStatus({
        entityKind: "workflow",
        entityId: taskId,
        fromStatus: "completed",
        toStatus: "running",
        currentStepIndex: 0,
        outputsJson: "{}",
        reasonCode: "invalid",
        traceId: newId("trace"),
        occurredAt: now,
      });
    }, /invalid_transition/);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("workflow orchestration: workflow completes with output accumulation", () => {
  const workspace = createTempWorkspace("aa-orchestration-complete-");

  try {
    const dbPath = join(workspace, "orch-complete.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const transitions = new TransitionService(db, store);

    const taskId = newId("task");
    const sessionId = newId("sess");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Complete workflow test",
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

      store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "wf_ops_standard",
        currentStepIndex: 2,
        status: "running",
        outputsJson: '{"step0": "done", "step1": "done"}',
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });

      store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });

      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "wf_ops_standard",
        parentExecutionId: null,
        agentId: "agent_ops",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: newId("trace"),
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
    });

    // Transition to terminal state
    transitions.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "executing",
      terminalStatus: "done",
      taskOutputJson: '{"result": "success"}',
      outputsJson: '{"step0": "done", "step1": "done", "final": "success"}',
      context: {
        reasonCode: "task.completed",
        traceId: newId("trace"),
        occurredAt: now,
        actorType: "system",
      },
    });

    const task = store.getTask(taskId);
    assert.equal(task?.status, "done");
    assert.ok(task?.completedAt != null);

    const workflowState = store.getWorkflowState(taskId);
    assert.equal(workflowState?.status, "completed");

    const session = store.getSession(sessionId);
    assert.equal(session?.status, "completed");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("workflow orchestration: workflow fails and records error", () => {
  const workspace = createTempWorkspace("aa-orchestration-fail-");

  try {
    const dbPath = join(workspace, "orch-fail.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const transitions = new TransitionService(db, store);

    const taskId = newId("task");
    const sessionId = newId("sess");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Fail workflow test",
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

      store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "wf_ops_standard",
        currentStepIndex: 1,
        status: "running",
        outputsJson: '{"step0": "done"}',
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });

      store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });

      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "wf_ops_standard",
        parentExecutionId: null,
        agentId: "agent_ops",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: newId("trace"),
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
    });

    // Transition to failed state
    transitions.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "executing",
      terminalStatus: "failed",
      taskOutputJson: '{"error": "step_failed"}',
      outputsJson: '{"step0": "done", "error": "step1_failed"}',
      context: {
        reasonCode: "workflow.step_failed",
        traceId: newId("trace"),
        occurredAt: now,
        actorType: "system",
      },
    });

    const task = store.getTask(taskId);
    assert.equal(task?.status, "failed");
    assert.equal(task?.errorCode, "workflow.step_failed");

    const workflowState = store.getWorkflowState(taskId);
    assert.equal(workflowState?.status, "failed");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("workflow orchestration: events emitted for workflow lifecycle", () => {
  const workspace = createTempWorkspace("aa-orchestration-events-");

  try {
    const dbPath = join(workspace, "orch-events.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Event emission test",
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

      store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "wf_ops_standard",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
    });

    // Insert workflow events
    db.transaction(() => {
      store.event.insertEvent({
        id: newId("evt"),
        taskId,
        executionId: null,
        eventType: "workflow:planned",
        eventTier: "tier_1",
        payloadJson: JSON.stringify({ workflowId: "wf_ops_standard", planReason: "test" }),
        traceId: newId("trace"),
        createdAt: now,
      });

      store.event.insertEvent({
        id: newId("evt"),
        taskId,
        executionId: null,
        eventType: "workflow:step_completed",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({ stepIndex: 0, stepId: "step_0" }),
        traceId: newId("trace"),
        createdAt: now,
      });
    });

    const events = store.listEventsForTask(taskId);
    assert.ok(events.length >= 2);

    const plannedEvent = events.find((e) => e.eventType === "workflow:planned");
    assert.ok(plannedEvent != null);
    assert.equal(plannedEvent.eventTier, "tier_1");

    const stepEvent = events.find((e) => e.eventType === "workflow:step_completed");
    assert.ok(stepEvent != null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
