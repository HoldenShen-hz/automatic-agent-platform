import { test } from "node:test";
import assert from "node:assert/strict";
import {
  provideContext,
  getContext,
  getContextOrNull,
  withContextPatch,
  RuntimeContextSnapshot,
} from "../../../../src/platform/shared/context/runtime-context.js";

test("Context propagation - nested contexts are isolated", () => {
  const outerSnapshot: RuntimeContextSnapshot = {
    traceId: "outer-trace",
    taskId: "outer-task",
    tenantId: "outer-tenant",
  };

  const innerSnapshot: RuntimeContextSnapshot = {
    traceId: "inner-trace",
    taskId: "inner-task",
    workspaceId: "inner-workspace",
  };

  provideContext(outerSnapshot, () => {
    // Outer context is active
    assert.equal(getContext().traceId, "outer-trace");
    assert.equal(getContext().taskId, "outer-task");
    assert.equal(getContext().tenantId, "outer-tenant");

    // Enter inner context
    provideContext(innerSnapshot, () => {
      // Inner context overrides outer
      assert.equal(getContext().traceId, "inner-trace");
      assert.equal(getContext().taskId, "inner-task");
      assert.equal(getContext().workspaceId, "inner-workspace");
      // tenantId is undefined in inner context
    });

    // Back to outer context
    assert.equal(getContext().traceId, "outer-trace");
    assert.equal(getContext().taskId, "outer-task");
  });
});

test("Context propagation - withContextPatch preserves outer values", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace-123",
    taskId: "task-456",
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    agentId: undefined,
  };

  provideContext(snapshot, () => {
    const patched = withContextPatch({ agentId: "agent-abc" }, () => {
      return getContext();
    });

    assert.equal(patched.traceId, "trace-123");      // Unchanged
    assert.equal(patched.taskId, "task-456");        // Unchanged
    assert.equal(patched.tenantId, "tenant-1");      // Unchanged
    assert.equal(patched.workspaceId, "workspace-1"); // Unchanged
    assert.equal(patched.agentId, "agent-abc");      // Patched

    // Original context is unchanged
    const original = getContext();
    assert.equal(original.agentId, undefined);
  });
});

test("Context propagation - getContextOrNull returns null outside context", () => {
  const result = getContextOrNull();
  assert.equal(result, null);
});

test("Context propagation - withContextPatch applies patch on top of current context", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace-1",
    taskId: "task-1",
    spanId: undefined,
    parentSpanId: undefined,
  };

  provideContext(snapshot, () => {
    // First patch creates a new context with spanId
    const patch1 = withContextPatch({ spanId: "span-1" }, () => getContext());
    assert.equal(patch1.spanId, "span-1");
    assert.equal(patch1.parentSpanId, undefined);

    // Second patch creates another context based on ORIGINAL, not patch1
    // (because withContextPatch calls getContext() which returns the snapshot, not the patched version)
    const patch2 = withContextPatch({ parentSpanId: "parent-1" }, () => getContext());
    assert.equal(patch2.parentSpanId, "parent-1");
    assert.equal(patch2.spanId, undefined); // From original, not from patch1

    // Original context remains unchanged
    const original = getContext();
    assert.equal(original.spanId, undefined);
    assert.equal(original.parentSpanId, undefined);
  });
});

test("Context propagation - async operations preserve context", async () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "async-trace",
    taskId: "async-task",
  };

  await provideContext(snapshot, async () => {
    // Simulate async operation
    const result = await Promise.resolve("delayed");
    const ctx = getContext();
    assert.equal(ctx.traceId, "async-trace");
    assert.equal(ctx.taskId, "async-task");
    return result;
  });
});

test("Context propagation - concurrent contexts are isolated", async () => {
  const snapshot1: RuntimeContextSnapshot = {
    traceId: "trace-concurrent-1",
    taskId: "task-1",
  };
  const snapshot2: RuntimeContextSnapshot = {
    traceId: "trace-concurrent-2",
    taskId: "task-2",
  };

  const results = await Promise.all([
    provideContext(snapshot1, async () => {
      const ctx1 = getContext();
      await Promise.resolve(); // Yield to event loop
      return ctx1.traceId;
    }),
    provideContext(snapshot2, async () => {
      const ctx2 = getContext();
      await Promise.resolve(); // Yield to event loop
      return ctx2.traceId;
    }),
  ]);

  assert.equal(results[0], "trace-concurrent-1");
  assert.equal(results[1], "trace-concurrent-2");
});