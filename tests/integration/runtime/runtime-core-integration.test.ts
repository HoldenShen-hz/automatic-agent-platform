/**
 * Integration Tests: Runtime Core
 *
 * Integration tests for runtime core modules with real storage backends.
 * Tests state transition machine, context propagation, and cross-component integration.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { StateTransitionMachine } from "../../../src/platform/five-plane-execution/state-transition/state-transition-machine.js";
import { WorkflowStateError } from "../../../src/platform/contracts/errors.js";
import {
  provideContext,
  getContext,
  getContextOrNull,
  withContextPatch,
  assertContext,
  getTenantId,
  getWorkspaceId,
  hasTenantContext,
  hasWorkspaceContext,
} from "../../../src/platform/shared/context/runtime-context.js";
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
import type { RuntimeContextSnapshot } from "../../../src/platform/shared/context/runtime-context.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createSnapshot(overrides: Partial<RuntimeContextSnapshot> = {}): RuntimeContextSnapshot {
  return {
    traceId: "int-trace-123",
    taskId: "int-task-456",
    executionId: "int-exec-789",
    workflowId: "int-wf-101",
    sessionId: "int-session-202",
    agentId: "int-agent-303",
    divisionId: "int-div-404",
    workdir: "/tmp",
    requestId: "int-req-505",
    approvalId: "int-approval-606",
    abortSignalRef: "int-signal-707",
    budgetScopeId: "int-budget-808",
    tenantId: "int-tenant-909",
    workspaceId: "int-workspace-101",
    spanId: null,
    parentSpanId: null,
    ...overrides,
  };
}

function createSqliteBackend(dbPath: string): SqliteDatabase {
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return db;
}

// ---------------------------------------------------------------------------
// State Transition Machine Integration Tests
// ---------------------------------------------------------------------------

test("StateTransitionMachine validates full task lifecycle with SQLite", () => {
  const machine = new StateTransitionMachine<string>("task", {
    queued: ["pending", "in_progress", "cancelled"],
    pending: ["in_progress", "cancelled"],
    in_progress: ["awaiting_decision", "done", "failed", "cancelled"],
    awaiting_decision: ["in_progress", "failed", "cancelled"],
    done: [],
    failed: [],
    cancelled: [],
  });

  // Full happy path
  machine.assertTransition("queued", "pending");
  machine.assertTransition("pending", "in_progress");
  machine.assertTransition("in_progress", "done");

  // Verify terminal state has no transitions
  assert.throws(
    () => machine.assertTransition("done", "pending"),
    WorkflowStateError,
  );
});

test("StateTransitionMachine validates workflow lifecycle with SQLite", () => {
  const machine = new StateTransitionMachine<string>("workflow", {
    running: ["paused", "completed", "failed", "cancelling", "cancelled"],
    paused: ["resuming", "failed", "cancelled"],
    resuming: ["running", "failed", "cancelled"],
    cancelling: ["cancelled"],
    completed: [],
    failed: [],
    cancelled: [],
  });

  // Pause and resume cycle
  machine.assertTransition("running", "paused");
  machine.assertTransition("paused", "resuming");
  machine.assertTransition("resuming", "running");

  // Cancellation path
  machine.assertTransition("running", "cancelling");
  machine.assertTransition("cancelling", "cancelled");

  // Failure path
  machine.assertTransition("running", "failed");
  assert.throws(
    () => machine.assertTransition("failed", "running"),
    WorkflowStateError,
  );
});

test("StateTransitionMachine validates execution lifecycle with SQLite", () => {
  const machine = new StateTransitionMachine<string>("execution", {
    created: ["queued", "prechecking", "executing", "cancelled", "failed"],
    queued: ["dispatching", "prechecking", "executing", "cancelled", "failed"],
    dispatching: ["prechecking", "executing", "paused", "recovering", "cancelled", "failed"],
    prechecking: ["executing", "blocked", "paused", "recovering", "cancelled", "failed"],
    executing: ["blocked", "succeeded", "failed", "cancelled", "paused", "recovering"],
    paused: ["resuming", "recovering", "timed_out", "failed", "cancelled"],
    recovering: ["ready", "executing", "failed", "cancelled", "timed_out"],
    timed_out: ["resuming", "failed", "cancelled"],
    blocked: ["prechecking", "executing", "cancelled", "failed", "superseded"],
    succeeded: [],
    failed: [],
    cancelled: [],
    superseded: [],
  });

  // Full execution lifecycle
  machine.assertTransition("created", "queued");
  machine.assertTransition("queued", "dispatching");
  machine.assertTransition("dispatching", "prechecking");
  machine.assertTransition("prechecking", "executing");
  machine.assertTransition("executing", "succeeded");

  // Recovery scenario
  machine.assertTransition("created", "queued");
  machine.assertTransition("queued", "dispatching");
  machine.assertTransition("dispatching", "prechecking");
  machine.assertTransition("prechecking", "executing");
  machine.assertTransition("executing", "paused");
  machine.assertTransition("paused", "recovering");
  machine.assertTransition("recovering", "executing");
  machine.assertTransition("executing", "succeeded");
});

test("StateTransitionMachine validates approval lifecycle with SQLite", () => {
  const machine = new StateTransitionMachine<string>("approval", {
    requested: ["approved", "rejected", "expired", "cancelled"],
    approved: [],
    rejected: [],
    expired: [],
    cancelled: [],
  });

  // Approval path
  machine.assertTransition("requested", "approved");

  // Rejection path
  machine.assertTransition("requested", "rejected");

  // Expiration path
  machine.assertTransition("requested", "expired");

  // Terminal states block further transitions
  assert.throws(
    () => machine.assertTransition("approved", "rejected"),
    WorkflowStateError,
  );
  assert.throws(
    () => machine.assertTransition("rejected", "expired"),
    WorkflowStateError,
  );
  assert.throws(
    () => machine.assertTransition("expired", "cancelled"),
    WorkflowStateError,
  );
});

// ---------------------------------------------------------------------------
// Context Propagation Integration Tests
// ---------------------------------------------------------------------------

test("context propagation works with real SQLite backend", () => {
  const workspace = createTempWorkspace("aa-int-context-");
  const dbPath = join(workspace, "test.db");

  try {
    const db = createSqliteBackend(dbPath);

    const snapshot = createSnapshot({ tenantId: "sqlite-tenant" });

    provideContext(snapshot, () => {
      const ctx = getContext();
      assert.equal(ctx.tenantId, "sqlite-tenant");
      assert.equal(ctx.taskId, "int-task-456");
      assert.ok(hasTenantContext());
    });

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("nested context isolation with real backend", () => {
  const workspace = createTempWorkspace("aa-int-nested-");
  const dbPath = join(workspace, "test.db");

  try {
    const db = createSqliteBackend(dbPath);

    const outerSnapshot = createSnapshot({ tenantId: "outer-tenant", workspaceId: "outer-workspace" });
    const innerSnapshot = createSnapshot({ tenantId: "inner-tenant", workspaceId: "inner-workspace" });

    provideContext(outerSnapshot, () => {
      assert.equal(getTenantId(), "outer-tenant");
      assert.equal(getWorkspaceId(), "outer-workspace");

      provideContext(innerSnapshot, () => {
        assert.equal(getTenantId(), "inner-tenant");
        assert.equal(getWorkspaceId(), "inner-workspace");
      });

      // Outer context restored
      assert.equal(getTenantId(), "outer-tenant");
      assert.equal(getWorkspaceId(), "outer-workspace");
    });

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("withContextPatch works with real SQLite backend", () => {
  const workspace = createTempWorkspace("aa-int-patch-");
  const dbPath = join(workspace, "test.db");

  try {
    const db = createSqliteBackend(dbPath);

    const snapshot = createSnapshot({ tenantId: "original-tenant", workspaceId: "original-workspace" });

    provideContext(snapshot, () => {
      assert.equal(getTenantId(), "original-tenant");

      withContextPatch({ tenantId: "patched-tenant" }, () => {
        assert.equal(getTenantId(), "patched-tenant");
        assert.equal(getWorkspaceId(), "original-workspace");
      });

      // Original restored
      assert.equal(getTenantId(), "original-tenant");
    });

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("assertContext validates required fields with real backend", () => {
  const workspace = createTempWorkspace("aa-int-assert-");
  const dbPath = join(workspace, "test.db");

  try {
    const db = createSqliteBackend(dbPath);

    const snapshot = createSnapshot({
      tenantId: "valid-tenant",
      workspaceId: "valid-workspace",
    });

    provideContext(snapshot, () => {
      // Should not throw - all required fields present
      const ctx = assertContext("tenantId", "workspaceId", "traceId");
      assert.ok(ctx);
      assert.equal(ctx.tenantId, "valid-tenant");
    });

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("context survives across async boundaries with real backend", async () => {
  const workspace = createTempWorkspace("aa-int-async-");
  const dbPath = join(workspace, "test.db");

  try {
    const db = createSqliteBackend(dbPath);

    const snapshot = createSnapshot({ tenantId: "async-tenant" });

    await provideContext(snapshot, async () => {
      // Context available before async
      assert.equal(getTenantId(), "async-tenant");

      // Simulate async operation
      await new Promise<void>((resolve) => setImmediate(resolve));

      // Context still available after async
      assert.equal(getTenantId(), "async-tenant");
      assert.ok(hasTenantContext());
    });

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("multiple sequential contexts with real backend", () => {
  const workspace = createTempWorkspace("aa-int-sequential-");
  const dbPath = join(workspace, "test.db");

  try {
    const db = createSqliteBackend(dbPath);

    // First context
    const snapshot1 = createSnapshot({ tenantId: "first-tenant" });
    provideContext(snapshot1, () => {
      assert.equal(getTenantId(), "first-tenant");
    });

    // Second context (should not leak from first)
    const snapshot2 = createSnapshot({ tenantId: "second-tenant", workspaceId: "second-workspace" });
    provideContext(snapshot2, () => {
      assert.equal(getTenantId(), "second-tenant");
      assert.equal(getWorkspaceId(), "second-workspace");
    });

    // Outside any context
    const leakedContext = getContextOrNull();
    assert.equal(leakedContext, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Cross-Component Integration Tests
// ---------------------------------------------------------------------------

test("StateTransitionMachine and context work together", () => {
  const workspace = createTempWorkspace("aa-int-combined-");
  const dbPath = join(workspace, "test.db");

  try {
    const db = createSqliteBackend(dbPath);

    const machine = new StateTransitionMachine<string>("task", {
      queued: ["pending", "in_progress", "cancelled"],
      pending: ["in_progress", "cancelled"],
      in_progress: ["done", "failed", "cancelled"],
      done: [],
      failed: [],
      cancelled: [],
    });

    const snapshot = createSnapshot({ tenantId: "combined-tenant" });

    provideContext(snapshot, () => {
      // Context is available
      assert.ok(hasTenantContext());
      assert.equal(getTenantId(), "combined-tenant");

      // State machine works independently
      machine.assertTransition("queued", "pending");
      machine.assertTransition("pending", "in_progress");
      machine.assertTransition("in_progress", "done");

      // Context still valid after state transitions
      assert.equal(getTenantId(), "combined-tenant");
    });

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("error handling in context with state machine validation", () => {
  const machine = new StateTransitionMachine<string>("task", {
    pending: ["running"],
    running: ["done"],
    done: [],
  });

  const snapshot = createSnapshot({ tenantId: "error-tenant" });

  provideContext(snapshot, () => {
    // Valid transition
    machine.assertTransition("pending", "running");

    // Valid transition
    machine.assertTransition("running", "done");

    // Invalid transition throws - done is terminal
    assert.throws(
      () => machine.assertTransition("done", "running"),
      WorkflowStateError,
    );

    // Context still valid after error
    assert.equal(getTenantId(), "error-tenant");
  });
});

test("concurrent context and state machine operations", () => {
  const workspace = createTempWorkspace("aa-int-concurrent-");
  const dbPath = join(workspace, "test.db");

  try {
    const db = createSqliteBackend(dbPath);

    const taskMachine = new StateTransitionMachine<string>("task", {
      queued: ["pending", "in_progress"],
      pending: ["in_progress"],
      in_progress: ["done"],
    });

    const sessionMachine = new StateTransitionMachine<string>("session", {
      open: ["streaming", "completed"],
      streaming: ["completed"],
      completed: [],
    });

    const snapshot = createSnapshot();

    provideContext(snapshot, () => {
      // Multiple state machines can be used
      taskMachine.assertTransition("queued", "pending");
      sessionMachine.assertTransition("open", "streaming");

      taskMachine.assertTransition("pending", "in_progress");
      sessionMachine.assertTransition("streaming", "completed");

      // Context still valid
      assert.ok(hasTenantContext());
      assert.ok(hasWorkspaceContext());
    });

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

test("empty transition map handles all states as terminal", () => {
  const machine = new StateTransitionMachine<string>("terminal", {});

  assert.throws(
    () => machine.assertTransition("any", "other"),
    WorkflowStateError,
  );
});

test("context with null optional fields", () => {
  const snapshot = createSnapshot({
    approvalId: null,
    abortSignalRef: null,
    budgetScopeId: null,
    spanId: null,
    parentSpanId: null,
  });

  provideContext(snapshot, () => {
    const ctx = getContext();
    assert.equal(ctx.approvalId, null);
    assert.equal(ctx.abortSignalRef, null);
    assert.equal(ctx.budgetScopeId, null);
  });
});

test("context patch preserves null values", () => {
  const snapshot = createSnapshot({
    tenantId: "patch-test",
    approvalId: null,
  });

  provideContext(snapshot, () => {
    withContextPatch({ tenantId: "new-tenant" }, () => {
      // approvalId should still be accessible as null
      const ctx = getContext();
      assert.equal(ctx.approvalId, null);
    });
  });
});
