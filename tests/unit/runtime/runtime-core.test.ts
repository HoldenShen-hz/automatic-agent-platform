/**
 * Unit Tests: Runtime Core
 *
 * Tests for runtime core modules including state transition machine,
 * context propagation, and related utilities.
 */

import assert from "node:assert/strict";
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
  getTenantIdOrNull,
  getWorkspaceId,
  getWorkspaceIdOrNull,
  hasTenantContext,
  hasWorkspaceContext,
} from "../../../src/platform/shared/context/runtime-context.js";
import { ValidationError } from "../../../src/platform/contracts/errors.js";

// ---------------------------------------------------------------------------
// StateTransitionMachine Tests
// ---------------------------------------------------------------------------

test("StateTransitionMachine validates entity kind in constructor", () => {
  const machine = new StateTransitionMachine<string>("task", {
    pending: ["running"],
    running: ["done"],
  });

  assert.ok(machine instanceof StateTransitionMachine);
});

test("StateTransitionMachine accepts valid transitions", () => {
  const machine = new StateTransitionMachine<string>("execution", {
    created: ["queued", "running"],
    queued: ["running", "cancelled"],
    running: ["succeeded", "failed", "cancelled"],
  });

  machine.assertTransition("created", "queued");
  machine.assertTransition("queued", "running");
  machine.assertTransition("running", "succeeded");
});

test("StateTransitionMachine rejects invalid transitions", () => {
  const machine = new StateTransitionMachine<string>("task", {
    pending: ["running"],
    running: ["done"],
  });

  assert.throws(
    () => machine.assertTransition("pending", "done"),
    WorkflowStateError,
  );
});

test("StateTransitionMachine allows idempotent noop transitions", () => {
  const machine = new StateTransitionMachine<string>("task", {
    pending: ["running"],
    running: ["done"],
  });

  assert.doesNotThrow(
    () => machine.assertTransition("pending", "pending"),
  );
});

test("StateTransitionMachine handles terminal states", () => {
  const machine = new StateTransitionMachine<string>("task", {
    pending: ["running"],
    running: ["completed"],
    completed: [],
  });

  machine.assertTransition("pending", "running");
  machine.assertTransition("running", "completed");

  assert.throws(
    () => machine.assertTransition("completed", "running"),
    WorkflowStateError,
  );
});

test("StateTransitionMachine reports entity kind in error code", () => {
  const machine = new StateTransitionMachine<string>("workflow", {
    running: ["completed"],
    completed: [],
  });

  try {
    // completed -> running is invalid since completed is terminal
    machine.assertTransition("completed", "running");
    assert.fail("Should have thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    const error = err as WorkflowStateError;
    assert.ok(error.code.includes("workflow"));
  }
});

test("StateTransitionMachine works with generic string states", () => {
  type SimpleState = "idle" | "active" | "stopped";

  const machine = new StateTransitionMachine<SimpleState>("simple", {
    idle: ["active"],
    active: ["stopped", "idle"],
    stopped: [],
  });

  machine.assertTransition("idle", "active");
  machine.assertTransition("active", "stopped");

  assert.throws(
    () => machine.assertTransition("stopped", "idle"),
    WorkflowStateError,
  );
});

test("StateTransitionMachine handles multiple allowed next states", () => {
  const machine = new StateTransitionMachine<string>("task", {
    created: ["pending", "running", "cancelled"],
    pending: ["running", "cancelled"],
    running: ["done", "failed", "cancelled"],
  });

  machine.assertTransition("created", "pending");
  machine.assertTransition("created", "running");
  machine.assertTransition("created", "cancelled");
  machine.assertTransition("running", "done");
  machine.assertTransition("running", "failed");
});

test("StateTransitionMachine throws on transition from non-existent state", () => {
  const machine = new StateTransitionMachine<string>("task", {
    pending: ["running"],
    running: ["done"],
  });

  assert.throws(
    () => machine.assertTransition("done", "pending"),
    WorkflowStateError,
  );
});

// ---------------------------------------------------------------------------
// Runtime Context Tests - provideContext and getContext
// ---------------------------------------------------------------------------

test("provideContext creates context that can be retrieved with getContext", () => {
  const snapshot = {
    traceId: "trace-1",
    taskId: "task-1",
    executionId: "exec-1",
    workflowId: "wf-1",
    sessionId: "sess-1",
    agentId: "agent-1",
    divisionId: "div-1",
    workdir: "/tmp",
    requestId: "req-1",
    approvalId: null,
    abortSignalRef: null,
    budgetScopeId: null,
    tenantId: "tenant-1",
    workspaceId: "ws-1",
    spanId: null,
    parentSpanId: null,
  };

  provideContext(snapshot, () => {
    const ctx = getContext();
    assert.equal(ctx.traceId, "trace-1");
    assert.equal(ctx.taskId, "task-1");
    assert.equal(ctx.tenantId, "tenant-1");
  });
});

test("getContext throws when called outside provideContext", () => {
  assert.throws(
    () => getContext(),
    ValidationError,
  );
});

test("getContextOrNull returns null outside provideContext", () => {
  const ctx = getContextOrNull();
  assert.equal(ctx, null);
});

test("getContextOrNull returns context inside provideContext", () => {
  const snapshot = {
    traceId: "trace-1",
    taskId: "task-1",
    executionId: "exec-1",
    workflowId: "wf-1",
    sessionId: "sess-1",
    agentId: "agent-1",
    divisionId: "div-1",
    workdir: "/tmp",
    requestId: "req-1",
    approvalId: null,
    abortSignalRef: null,
    budgetScopeId: null,
    tenantId: "tenant-1",
    workspaceId: "ws-1",
    spanId: null,
    parentSpanId: null,
  };

  provideContext(snapshot, () => {
    const ctx = getContextOrNull();
    assert.ok(ctx !== null);
    assert.equal(ctx!.traceId, "trace-1");
  });
});

// ---------------------------------------------------------------------------
// Runtime Context Tests - Tenant and Workspace
// ---------------------------------------------------------------------------

test("getTenantId returns tenantId from context", () => {
  const snapshot = {
    traceId: "trace-1",
    taskId: "task-1",
    executionId: "exec-1",
    workflowId: "wf-1",
    sessionId: "sess-1",
    agentId: "agent-1",
    divisionId: "div-1",
    workdir: "/tmp",
    requestId: "req-1",
    approvalId: null,
    abortSignalRef: null,
    budgetScopeId: null,
    tenantId: "tenant-abc",
    workspaceId: "ws-123",
    spanId: null,
    parentSpanId: null,
  };

  provideContext(snapshot, () => {
    assert.equal(getTenantId(), "tenant-abc");
  });
});

test("getTenantId returns null outside context", () => {
  assert.equal(getTenantId(), null);
});

test("getTenantIdOrNull returns tenantId inside context", () => {
  const snapshot = {
    traceId: "trace-1",
    taskId: "task-1",
    executionId: "exec-1",
    workflowId: "wf-1",
    sessionId: "sess-1",
    agentId: "agent-1",
    divisionId: "div-1",
    workdir: "/tmp",
    requestId: "req-1",
    approvalId: null,
    abortSignalRef: null,
    budgetScopeId: null,
    tenantId: "tenant-xyz",
    workspaceId: "ws-456",
    spanId: null,
    parentSpanId: null,
  };

  provideContext(snapshot, () => {
    assert.equal(getTenantIdOrNull(), "tenant-xyz");
  });
});

test("getWorkspaceId returns workspaceId from context", () => {
  const snapshot = {
    traceId: "trace-1",
    taskId: "task-1",
    executionId: "exec-1",
    workflowId: "wf-1",
    sessionId: "sess-1",
    agentId: "agent-1",
    divisionId: "div-1",
    workdir: "/tmp",
    requestId: "req-1",
    approvalId: null,
    abortSignalRef: null,
    budgetScopeId: null,
    tenantId: "tenant-1",
    workspaceId: "workspace-def",
    spanId: null,
    parentSpanId: null,
  };

  provideContext(snapshot, () => {
    assert.equal(getWorkspaceId(), "workspace-def");
  });
});

test("getWorkspaceId returns null outside context", () => {
  assert.equal(getWorkspaceId(), null);
});

test("hasTenantContext returns true when tenantId is set", () => {
  const snapshot = {
    traceId: "trace-1",
    taskId: "task-1",
    executionId: "exec-1",
    workflowId: "wf-1",
    sessionId: "sess-1",
    agentId: "agent-1",
    divisionId: "div-1",
    workdir: "/tmp",
    requestId: "req-1",
    approvalId: null,
    abortSignalRef: null,
    budgetScopeId: null,
    tenantId: "valid-tenant",
    workspaceId: "ws-1",
    spanId: null,
    parentSpanId: null,
  };

  provideContext(snapshot, () => {
    assert.ok(hasTenantContext());
  });
});

test("hasTenantContext returns false when tenantId is empty", () => {
  const snapshot = {
    traceId: "trace-1",
    taskId: "task-1",
    executionId: "exec-1",
    workflowId: "wf-1",
    sessionId: "sess-1",
    agentId: "agent-1",
    divisionId: "div-1",
    workdir: "/tmp",
    requestId: "req-1",
    approvalId: null,
    abortSignalRef: null,
    budgetScopeId: null,
    tenantId: "",
    workspaceId: "ws-1",
    spanId: null,
    parentSpanId: null,
  };

  provideContext(snapshot, () => {
    assert.ok(!hasTenantContext());
  });
});

test("hasWorkspaceContext returns true when workspaceId is set", () => {
  const snapshot = {
    traceId: "trace-1",
    taskId: "task-1",
    executionId: "exec-1",
    workflowId: "wf-1",
    sessionId: "sess-1",
    agentId: "agent-1",
    divisionId: "div-1",
    workdir: "/tmp",
    requestId: "req-1",
    approvalId: null,
    abortSignalRef: null,
    budgetScopeId: null,
    tenantId: "tenant-1",
    workspaceId: "valid-workspace",
    spanId: null,
    parentSpanId: null,
  };

  provideContext(snapshot, () => {
    assert.ok(hasWorkspaceContext());
  });
});

test("hasWorkspaceContext returns false when workspaceId is empty", () => {
  const snapshot = {
    traceId: "trace-1",
    taskId: "task-1",
    executionId: "exec-1",
    workflowId: "wf-1",
    sessionId: "sess-1",
    agentId: "agent-1",
    divisionId: "div-1",
    workdir: "/tmp",
    requestId: "req-1",
    approvalId: null,
    abortSignalRef: null,
    budgetScopeId: null,
    tenantId: "tenant-1",
    workspaceId: "",
    spanId: null,
    parentSpanId: null,
  };

  provideContext(snapshot, () => {
    assert.ok(!hasWorkspaceContext());
  });
});

// ---------------------------------------------------------------------------
// Runtime Context Tests - withContextPatch
// ---------------------------------------------------------------------------

test("withContextPatch creates patched context for nested execution", () => {
  const outerSnapshot = {
    traceId: "trace-outer",
    taskId: "task-outer",
    executionId: "exec-outer",
    workflowId: "wf-outer",
    sessionId: "sess-outer",
    agentId: "agent-outer",
    divisionId: "div-outer",
    workdir: "/tmp",
    requestId: "req-outer",
    approvalId: null,
    abortSignalRef: null,
    budgetScopeId: null,
    tenantId: "outer-tenant",
    workspaceId: "outer-workspace",
    spanId: null,
    parentSpanId: null,
  };

  provideContext(outerSnapshot, () => {
    assert.equal(getTenantId(), "outer-tenant");

    withContextPatch({ tenantId: "patched-tenant" }, () => {
      assert.equal(getTenantId(), "patched-tenant");
    });

    // Original context restored after patch
    assert.equal(getTenantId(), "outer-tenant");
  });
});

test("withContextPatch preserves non-patched fields", () => {
  const outerSnapshot = {
    traceId: "trace-original",
    taskId: "task-original",
    executionId: "exec-original",
    workflowId: "wf-original",
    sessionId: "sess-original",
    agentId: "agent-original",
    divisionId: "div-original",
    workdir: "/tmp",
    requestId: "req-original",
    approvalId: null,
    abortSignalRef: null,
    budgetScopeId: null,
    tenantId: "original-tenant",
    workspaceId: "original-workspace",
    spanId: null,
    parentSpanId: null,
  };

  provideContext(outerSnapshot, () => {
    withContextPatch({ tenantId: "new-tenant" }, () => {
      assert.equal(getTenantId(), "new-tenant");
      assert.equal(getWorkspaceId(), "original-workspace");
      assert.equal(getContext().traceId, "trace-original");
    });
  });
});

// ---------------------------------------------------------------------------
// Runtime Context Tests - assertContext
// ---------------------------------------------------------------------------

test("assertContext returns context when all required keys are present", () => {
  const snapshot = {
    traceId: "trace-1",
    taskId: "task-1",
    executionId: "exec-1",
    workflowId: "wf-1",
    sessionId: "sess-1",
    agentId: "agent-1",
    divisionId: "div-1",
    workdir: "/tmp",
    requestId: "req-1",
    approvalId: null,
    abortSignalRef: null,
    budgetScopeId: null,
    tenantId: "tenant-1",
    workspaceId: "ws-1",
    spanId: null,
    parentSpanId: null,
  };

  provideContext(snapshot, () => {
    const ctx = assertContext("traceId", "taskId", "tenantId");
    assert.ok(ctx);
    assert.equal(ctx.traceId, "trace-1");
  });
});

test("assertContext throws ValidationError when required key is missing", () => {
  const snapshot = {
    traceId: "trace-1",
    taskId: "task-1",
    executionId: "exec-1",
    workflowId: "wf-1",
    sessionId: "sess-1",
    agentId: "agent-1",
    divisionId: "div-1",
    workdir: "/tmp",
    requestId: "req-1",
    approvalId: null,
    abortSignalRef: null,
    budgetScopeId: null,
    tenantId: "",
    workspaceId: "ws-1",
    spanId: null,
    parentSpanId: null,
  };

  provideContext(snapshot, () => {
    assert.throws(
      () => assertContext("tenantId"),
      ValidationError,
    );
  });
});

test("assertContext throws when required key is empty string", () => {
  const snapshot = {
    traceId: "trace-1",
    taskId: "task-1",
    executionId: "exec-1",
    workflowId: "wf-1",
    sessionId: "sess-1",
    agentId: "agent-1",
    divisionId: "div-1",
    workdir: "/tmp",
    requestId: "req-1",
    approvalId: null,
    abortSignalRef: null,
    budgetScopeId: null,
    tenantId: "",
    workspaceId: "ws-1",
    spanId: null,
    parentSpanId: null,
  };

  provideContext(snapshot, () => {
    assert.throws(
      () => assertContext("tenantId"),
      ValidationError,
    );
  });
});

test("assertContext works with no required keys", () => {
  const snapshot = {
    traceId: "trace-1",
    taskId: "task-1",
    executionId: "exec-1",
    workflowId: "wf-1",
    sessionId: "sess-1",
    agentId: "agent-1",
    divisionId: "div-1",
    workdir: "/tmp",
    requestId: "req-1",
    approvalId: null,
    abortSignalRef: null,
    budgetScopeId: null,
    tenantId: "tenant-1",
    workspaceId: "ws-1",
    spanId: null,
    parentSpanId: null,
  };

  provideContext(snapshot, () => {
    const ctx = assertContext();
    assert.ok(ctx);
  });
});

// ---------------------------------------------------------------------------
// Nested Context Tests
// ---------------------------------------------------------------------------

test("nested provideContext preserves outer context after inner completes", () => {
  const outerSnapshot = {
    traceId: "trace-outer",
    taskId: "task-outer",
    executionId: "exec-outer",
    workflowId: "wf-outer",
    sessionId: "sess-outer",
    agentId: "agent-outer",
    divisionId: "div-outer",
    workdir: "/tmp",
    requestId: "req-outer",
    approvalId: null,
    abortSignalRef: null,
    budgetScopeId: null,
    tenantId: "outer-tenant",
    workspaceId: "outer-workspace",
    spanId: null,
    parentSpanId: null,
  };

  const innerSnapshot = {
    traceId: "trace-inner",
    taskId: "task-inner",
    executionId: "exec-inner",
    workflowId: "wf-inner",
    sessionId: "sess-inner",
    agentId: "agent-inner",
    divisionId: "div-inner",
    workdir: "/tmp",
    requestId: "req-inner",
    approvalId: null,
    abortSignalRef: null,
    budgetScopeId: null,
    tenantId: "inner-tenant",
    workspaceId: "inner-workspace",
    spanId: null,
    parentSpanId: null,
  };

  provideContext(outerSnapshot, () => {
    assert.equal(getTenantId(), "outer-tenant");

    provideContext(innerSnapshot, () => {
      assert.equal(getTenantId(), "inner-tenant");
    });

    // Outer context restored
    assert.equal(getTenantId(), "outer-tenant");
  });
});

// ---------------------------------------------------------------------------
// Context with Different Entity Transitions
// ---------------------------------------------------------------------------

test("StateTransitionMachine with task status transitions", () => {
  const machine = new StateTransitionMachine<string>("task", {
    queued: ["pending", "in_progress", "cancelled"],
    pending: ["in_progress", "cancelled"],
    in_progress: ["awaiting_decision", "done", "failed", "cancelled"],
    awaiting_decision: ["in_progress", "failed", "cancelled"],
    done: [],
    failed: [],
    cancelled: [],
  });

  // Valid transitions
  machine.assertTransition("queued", "pending");
  machine.assertTransition("pending", "in_progress");
  machine.assertTransition("in_progress", "done");

  // Invalid transition
  assert.throws(
    () => machine.assertTransition("queued", "done"),
    WorkflowStateError,
  );
});

test("StateTransitionMachine with workflow status transitions", () => {
  const machine = new StateTransitionMachine<string>("workflow", {
    running: ["paused", "completed", "failed", "cancelling", "cancelled"],
    paused: ["resuming", "failed", "cancelled"],
    resuming: ["running", "failed", "cancelled"],
    completed: [],
    failed: [],
    cancelling: ["cancelled"],
    cancelled: [],
  });

  // Valid transitions
  machine.assertTransition("running", "paused");
  machine.assertTransition("paused", "resuming");
  machine.assertTransition("resuming", "running");
  machine.assertTransition("running", "completed");

  // Invalid - can't go directly from completed back to running
  assert.throws(
    () => machine.assertTransition("completed", "running"),
    WorkflowStateError,
  );
});

test("StateTransitionMachine with session status transitions", () => {
  const machine = new StateTransitionMachine<string>("session", {
    open: ["streaming", "awaiting_user", "completed", "failed", "cancelled"],
    streaming: ["awaiting_user", "completed", "failed", "cancelled", "open"],
    awaiting_user: ["streaming", "completed", "failed", "cancelled"],
    paused: ["streaming", "completed", "failed", "cancelled"],
    completed: [],
    failed: [],
    cancelled: [],
  });

  // Valid transitions
  machine.assertTransition("open", "streaming");
  machine.assertTransition("streaming", "open"); // Recovery
  machine.assertTransition("open", "completed"); // Valid path to terminal

  // Invalid - no transition from completed
  assert.throws(
    () => machine.assertTransition("completed", "open"),
    WorkflowStateError,
  );
});

test("StateTransitionMachine with execution status transitions", () => {
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

  // Valid lifecycle
  machine.assertTransition("created", "queued");
  machine.assertTransition("queued", "dispatching");
  machine.assertTransition("dispatching", "prechecking");
  machine.assertTransition("prechecking", "executing");
  machine.assertTransition("executing", "succeeded");

  // Invalid - can't skip states
  assert.throws(
    () => machine.assertTransition("created", "succeeded"),
    WorkflowStateError,
  );
});

test("StateTransitionMachine with approval status transitions", () => {
  const machine = new StateTransitionMachine<string>("approval", {
    requested: ["approved", "rejected", "expired", "cancelled"],
    approved: [],
    rejected: [],
    expired: [],
    cancelled: [],
  });

  // Valid transitions
  machine.assertTransition("requested", "approved");
  machine.assertTransition("requested", "rejected");

  // Terminal states have no outgoing transitions
  assert.throws(
    () => machine.assertTransition("approved", "rejected"),
    WorkflowStateError,
  );
});
