/**
 * E2E Workflow State Transitions Tests
 *
 * Tests workflow state transitions including pause, resume, and completion.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { RuntimeStateMachine } from "../../src/platform/five-plane-execution/runtime-state-machine.js";
import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../src/platform/five-plane-execution/state-transition/transition-service.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import type { WorkflowStatus } from "../../src/platform/contracts/types/status.js";
import { createMinimalHarnessRun } from "../helpers/fixtures/base.js";

function createE2eHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "e2e-workflow-state.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const transitions = new TransitionService(db, store);

  return { workspace, db, store, transitions };
}

test("E2E: workflow transitions from running to paused", () => {
  const h = createE2eHarness("e2e-wf-pause-");
  const taskId = newId("task");
  const traceId = newId("trace");

  try {
    const now = nowIso();
    h.db.transaction(() => {
      h.store.insertWorkflowState({
        taskId,
        divisionId: "general-ops",
        workflowId: "test_workflow",
        currentStepIndex: 1,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
    });

    h.transitions.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: taskId,
      fromStatus: "running",
      toStatus: "paused",
      currentStepIndex: 1,
      outputsJson: "{}",
      reasonCode: "e2e_test",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    const workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "paused", "Workflow should be paused");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: workflow transitions from paused to resuming", () => {
  const h = createE2eHarness("e2e-wf-resuming-");
  const taskId = newId("task");
  const traceId = newId("trace");

  try {
    const now = nowIso();
    h.db.transaction(() => {
      h.store.insertWorkflowState({
        taskId,
        divisionId: "general-ops",
        workflowId: "test_workflow",
        currentStepIndex: 1,
        status: "paused",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: "1",
        startedAt: now,
        updatedAt: now,
      });
    });

    h.transitions.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: taskId,
      fromStatus: "paused",
      toStatus: "resuming",
      currentStepIndex: 1,
      outputsJson: "{}",
      reasonCode: "e2e_test",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    const workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "resuming", "Workflow should be resuming");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: workflow transitions from resuming to running", () => {
  const h = createE2eHarness("e2e-wf-running-");
  const taskId = newId("task");
  const traceId = newId("trace");

  try {
    const now = nowIso();
    h.db.transaction(() => {
      h.store.insertWorkflowState({
        taskId,
        divisionId: "general-ops",
        workflowId: "test_workflow",
        currentStepIndex: 1,
        status: "resuming",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: "1",
        startedAt: now,
        updatedAt: now,
      });
    });

    h.transitions.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: taskId,
      fromStatus: "resuming",
      toStatus: "running",
      currentStepIndex: 1,
      outputsJson: "{}",
      reasonCode: "e2e_test",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    const workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "running", "Workflow should be running");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: workflow state transitions include canonical HarnessRun pause and resume coverage", () => {
  const machine = new RuntimeStateMachine();
  const traceId = newId("trace");
  const harnessRun = createMinimalHarnessRun({
    status: "running",
    fencingToken: "fence-e2e-workflow-state",
  });

  const paused = machine.transition({
    commandId: newId("cmd"),
    entityType: "HarnessRun",
    entityId: harnessRun.harnessRunId,
    principal: "workflow-e2e",
    aggregateType: "HarnessRun",
    aggregate: harnessRun,
    fromStatus: "running",
    toStatus: "paused",
    tenantId: harnessRun.tenantId,
    traceId,
    reasonCode: "e2e.workflow.pause",
    emittedBy: "tests/e2e/workflow-state-transitions.test.ts",
    fencingToken: harnessRun.fencingToken ?? "fence-e2e-workflow-state",
    auditRef: "audit://workflow-state-transitions/pause",
  });
  assert.equal(paused.aggregate.status, "paused");
  assert.equal(paused.event.eventType, "platform.harness_run.status_changed");

  const resuming = machine.transition({
    commandId: newId("cmd"),
    entityType: "HarnessRun",
    entityId: paused.aggregate.harnessRunId,
    principal: "workflow-e2e",
    aggregateType: "HarnessRun",
    aggregate: paused.aggregate,
    fromStatus: "paused",
    toStatus: "resuming",
    tenantId: paused.aggregate.tenantId,
    traceId,
    reasonCode: "e2e.workflow.resume",
    emittedBy: "tests/e2e/workflow-state-transitions.test.ts",
    fencingToken: paused.aggregate.fencingToken ?? "fence-e2e-workflow-state",
    auditRef: "audit://workflow-state-transitions/resume",
  });
  assert.equal(resuming.aggregate.status, "resuming");
  assert.equal(resuming.event.eventType, "platform.harness_run.status_changed");
});

test("E2E: workflow transitions to failed on error", () => {
  const h = createE2eHarness("e2e-wf-failed-");
  const taskId = newId("task");
  const traceId = newId("trace");

  try {
    const now = nowIso();
    h.db.transaction(() => {
      h.store.insertWorkflowState({
        taskId,
        divisionId: "general-ops",
        workflowId: "test_workflow",
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

    h.db.transaction(() => {
      h.store.updateWorkflowRecoveryState({
        taskId,
        status: "failed",
        currentStepIndex: 0,
        outputsJson: "{}",
        updatedAt: nowIso(),
        resumableFromStep: null,
        retryCount: 0,
        lastErrorCode: "workflow.step_failed",
      });
    });

    const workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "failed", "Workflow should be failed");
    assert.equal(workflow?.lastErrorCode, "workflow.step_failed", "Error code should be recorded");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: workflow completes with all step outputs", () => {
  const h = createE2eHarness("e2e-wf-complete-");
  const taskId = newId("task");
  const traceId = newId("trace");

  try {
    const now = nowIso();
    h.db.transaction(() => {
      h.store.insertWorkflowState({
        taskId,
        divisionId: "general-ops",
        workflowId: "multi_step_wf",
        currentStepIndex: 2,
        status: "running",
        outputsJson: JSON.stringify({
          step0_output: "result_0",
          step1_output: "result_1",
        }),
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
    });

    h.transitions.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: taskId,
      fromStatus: "running",
      toStatus: "completed",
      currentStepIndex: 3,
      outputsJson: JSON.stringify({
        step0_output: "result_0",
        step1_output: "result_1",
        step2_output: "final_result",
      }),
      reasonCode: "e2e_test",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    const workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "completed", "Workflow should be completed");
    assert.equal(workflow?.currentStepIndex, 3, "Final step index should be recorded");

    const outputs = JSON.parse(workflow!.outputsJson);
    assert.ok(outputs.step0_output, "Step 0 output should be preserved");
    assert.ok(outputs.step1_output, "Step 1 output should be preserved");
    assert.ok(outputs.step2_output, "Step 2 output should be present");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
