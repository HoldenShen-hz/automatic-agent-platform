/**
 * Integration tests for Kernel Modules - State transition with real storage
 */

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("StateTransitionMachine integration with real workflow transitions", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "kernel-test-"));

  try {
    const { openAuthoritativeStorageContext } = await import(
      "../../../../src/platform/state-evidence/truth/storage-backend-factory.js"
    );
    const { StateTransitionMachine } = await import(
      "../../../../src/platform/execution/state-transition/state-transition-machine.js"
    );

    const dbPath = join(tmpDir, "test.db");
    const storage = openAuthoritativeStorageContext({ dbPath });
    storage.migrate();

    const machine = new StateTransitionMachine("task", {
      queued: ["in_progress", "cancelled"],
      in_progress: ["done", "failed", "cancelled"],
      done: [],
      failed: [],
      cancelled: [],
    });
    const store = storage.store;

    const { newId, nowIso } = await import("../../../../src/platform/contracts/types/ids.js");
    const taskId = newId("task");
    const sessionId = newId("sess");

    store.task.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "test",
      title: "Test",
      status: "queued",
      source: "test",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0.01,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      completedAt: null,
    });

    store.session.insertSession({
      id: sessionId,
      taskId,
      channel: "test",
      status: "open",
      externalSessionId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    machine.assertTransition("queued", "in_progress");

    // Verify the transition was valid by checking the machine state
    // Note: We don't actually update the store here since we just want to verify
    // the StateTransitionMachine logic works correctly

    storage.close();
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("StateTransitionMachine workflow state transitions", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "workflow-transition-test-"));

  try {
    const { openAuthoritativeStorageContext } = await import(
      "../../../../src/platform/state-evidence/truth/storage-backend-factory.js"
    );
    const { StateTransitionMachine } = await import(
      "../../../../src/platform/execution/state-transition/state-transition-machine.js"
    );

    const dbPath = join(tmpDir, "test.db");
    const storage = openAuthoritativeStorageContext({ dbPath });
    storage.migrate();

    const workflowMachine = new StateTransitionMachine("workflow", {
      running: ["paused", "cancelling", "failed"],
      paused: ["running", "failed"],
      cancelling: ["cancelled"],
      cancelled: [],
      completed: [],
      failed: [],
    });
    const store = storage.store;

    const { newId, nowIso } = await import("../../../../src/platform/contracts/types/ids.js");
    const taskId = newId("task");

    store.task.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "test",
      title: "Test",
      status: "in_progress",
      source: "test",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0.01,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      completedAt: null,
    });

    store.workflow.insertWorkflowState({
      taskId,
      divisionId: "test",
      workflowId: newId("wf"),
      currentStepIndex: 0,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: nowIso(),
      updatedAt: nowIso(),
    });

    workflowMachine.assertTransition("running", "paused");
    workflowMachine.assertTransition("paused", "running");
    workflowMachine.assertTransition("running", "cancelling");
    workflowMachine.assertTransition("cancelling", "cancelled");

    // Verify terminal state has no transitions
    assert.throws(() => {
      workflowMachine.assertTransition("cancelled", "running");
    });

    storage.close();
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("StateTransitionMachine session state transitions", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "session-transition-test-"));

  try {
    const { openAuthoritativeStorageContext } = await import(
      "../../../../src/platform/state-evidence/truth/storage-backend-factory.js"
    );
    const { StateTransitionMachine } = await import(
      "../../../../src/platform/execution/state-transition/state-transition-machine.js"
    );

    const dbPath = join(tmpDir, "test.db");
    const storage = openAuthoritativeStorageContext({ dbPath });
    storage.migrate();

    const sessionMachine = new StateTransitionMachine("session", {
      open: ["streaming", "awaiting_user", "completed", "failed", "cancelled"],
      streaming: ["awaiting_user", "completed", "failed", "cancelled", "open"],
      awaiting_user: ["streaming", "completed", "failed", "cancelled"],
      completed: [],
      failed: [],
      cancelled: [],
    });

    sessionMachine.assertTransition("open", "streaming");
    sessionMachine.assertTransition("streaming", "awaiting_user");
    sessionMachine.assertTransition("streaming", "open");

    storage.close();
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("StateTransitionMachine execution state transitions", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "execution-transition-test-"));

  try {
    const { openAuthoritativeStorageContext } = await import(
      "../../../../src/platform/state-evidence/truth/storage-backend-factory.js"
    );
    const { StateTransitionMachine } = await import(
      "../../../../src/platform/execution/state-transition/state-transition-machine.js"
    );

    const dbPath = join(tmpDir, "test.db");
    const storage = openAuthoritativeStorageContext({ dbPath });
    storage.migrate();

    const execMachine = new StateTransitionMachine("execution", {
      created: ["prechecking", "cancelled"],
      prechecking: ["executing", "cancelled"],
      executing: ["succeeded", "failed", "cancelled"],
      succeeded: [],
      failed: [],
      cancelled: [],
    });

    execMachine.assertTransition("created", "prechecking");
    execMachine.assertTransition("prechecking", "executing");
    execMachine.assertTransition("executing", "succeeded");

    assert.throws(() => {
      execMachine.assertTransition("succeeded", "executing");
    });

    storage.close();
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("StateTransitionMachine invalid transitions throw", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "invalid-transition-test-"));

  try {
    const { openAuthoritativeStorageContext } = await import(
      "../../../../src/platform/state-evidence/truth/storage-backend-factory.js"
    );
    const { StateTransitionMachine } = await import(
      "../../../../src/platform/execution/state-transition/state-transition-machine.js"
    );

    const dbPath = join(tmpDir, "test.db");
    const storage = openAuthoritativeStorageContext({ dbPath });
    storage.migrate();

    const taskMachine = new StateTransitionMachine("task", {
      queued: ["in_progress", "cancelled"],
      in_progress: ["done", "failed", "cancelled"],
      done: [],
      failed: [],
      cancelled: [],
    });

    assert.throws(() => {
      taskMachine.assertTransition("done", "in_progress");
    });

    assert.throws(() => {
      taskMachine.assertTransition("queued", "done");
    });

    storage.close();
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("StateTransitionMachine approval transitions", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "approval-transition-test-"));

  try {
    const { openAuthoritativeStorageContext } = await import(
      "../../../../src/platform/state-evidence/truth/storage-backend-factory.js"
    );
    const { StateTransitionMachine } = await import(
      "../../../../src/platform/execution/state-transition/state-transition-machine.js"
    );

    const dbPath = join(tmpDir, "test.db");
    const storage = openAuthoritativeStorageContext({ dbPath });
    storage.migrate();

    const approvalMachine = new StateTransitionMachine("approval", {
      pending: ["approved", "rejected"],
      approved: [],
      rejected: [],
    });

    approvalMachine.assertTransition("pending", "approved");
    approvalMachine.assertTransition("pending", "rejected");

    assert.throws(() => {
      approvalMachine.assertTransition("approved", "rejected");
    });

    storage.close();
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});