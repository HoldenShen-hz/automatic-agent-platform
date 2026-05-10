import { test } from "node:test";
import assert from "node:assert/strict";
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
  RuntimeContextSnapshot,
} from "../../../../src/platform/shared/context/runtime-context.js";

test("RuntimeContext - provideContext and getContext", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace-123",
    taskId: "task-456",
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
  };

  const result = provideContext(snapshot, () => {
    const ctx = getContext();
    assert.equal(ctx.traceId, "trace-123");
    assert.equal(ctx.taskId, "task-456");
    return ctx;
  });

  assert.equal((result as RuntimeContextSnapshot).traceId, "trace-123");
});

test("RuntimeContext - getContext throws when outside provideContext", () => {
  assert.throws(
    () => getContext(),
    /runtime_context.missing/
  );
});

test("RuntimeContext - getContextOrNull returns null when outside context", () => {
  const ctx = getContextOrNull();
  assert.equal(ctx, null);
});

test("RuntimeContext - getContextOrNull returns context when inside", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace-123",
    taskId: "task-456",
  };

  const result = provideContext(snapshot, () => {
    const ctx = getContextOrNull();
    assert.notEqual(ctx, null);
    assert.equal(ctx?.traceId, "trace-123");
    return true;
  });

  assert.equal(result, true);
});

test("RuntimeContext - withContextPatch creates merged context", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace-123",
    taskId: "task-456",
    tenantId: "tenant-1",
  };

  provideContext(snapshot, () => {
    const result = withContextPatch({ taskId: "task-789", spanId: "span-1" }, () => {
      return getContext();
    });

    assert.equal(result.traceId, "trace-123");  // unchanged
    assert.equal(result.taskId, "task-789");    // patched
    assert.equal(result.spanId, "span-1");      // new field
  });
});

test("RuntimeContext - assertContext passes when all fields present", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace-123",
    taskId: "task-456",
    tenantId: "tenant-1",
  };

  provideContext(snapshot, () => {
    const ctx = assertContext("traceId", "taskId");
    assert.equal(ctx.traceId, "trace-123");
  });
});

test("RuntimeContext - assertContext throws when field missing", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace-123",
    taskId: "",  // empty string should fail
    tenantId: "tenant-1",
  };

  provideContext(snapshot, () => {
    assert.throws(
      () => assertContext("taskId"),
      /Missing required context fields/
    );
  });
});

test("RuntimeContext - assertContext works with multiple required fields", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace-123",
    taskId: "task-456",
    tenantId: "tenant-1",
  };

  provideContext(snapshot, () => {
    const ctx = assertContext("traceId", "taskId", "tenantId");
    assert.equal(ctx.tenantId, "tenant-1");
  });
});

test("RuntimeContext - getTenantId returns tenantId from context", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace-123",
    taskId: "task-456",
    tenantId: "tenant-abc",
  };

  provideContext(snapshot, () => {
    assert.equal(getTenantId(), "tenant-abc");
  });
});

test("RuntimeContext - getTenantId returns null when not set", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace-123",
    taskId: "task-456",
    tenantId: null,
  };

  provideContext(snapshot, () => {
    assert.equal(getTenantId(), null);
  });
});

test("RuntimeContext - getTenantIdOrNull is alias for getTenantId", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace-123",
    taskId: "task-456",
    tenantId: "tenant-1",
  };

  provideContext(snapshot, () => {
    assert.equal(getTenantIdOrNull(), getTenantId());
  });
});

test("RuntimeContext - getWorkspaceId returns workspaceId from context", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace-123",
    taskId: "task-456",
    workspaceId: "workspace-xyz",
  };

  provideContext(snapshot, () => {
    assert.equal(getWorkspaceId(), "workspace-xyz");
  });
});

test("RuntimeContext - getWorkspaceId returns null when not set", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace-123",
    taskId: "task-456",
    workspaceId: null,
  };

  provideContext(snapshot, () => {
    assert.equal(getWorkspaceId(), null);
  });
});

test("RuntimeContext - getWorkspaceIdOrNull is alias for getWorkspaceId", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace-123",
    taskId: "task-456",
    workspaceId: "workspace-1",
  };

  provideContext(snapshot, () => {
    assert.equal(getWorkspaceIdOrNull(), getWorkspaceId());
  });
});

test("RuntimeContext - hasTenantContext returns true when tenantId is set", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace-123",
    taskId: "task-456",
    tenantId: "tenant-1",
  };

  provideContext(snapshot, () => {
    assert.equal(hasTenantContext(), true);
  });
});

test("RuntimeContext - hasTenantContext returns false when tenantId is empty", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace-123",
    taskId: "task-456",
    tenantId: "",
  };

  provideContext(snapshot, () => {
    assert.equal(hasTenantContext(), false);
  });
});

test("RuntimeContext - hasTenantContext returns false when tenantId is undefined", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace-123",
    taskId: "task-456",
  };

  provideContext(snapshot, () => {
    assert.equal(hasTenantContext(), false);
  });
});

test("RuntimeContext - hasWorkspaceContext returns true when workspaceId is set", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace-123",
    taskId: "task-456",
    workspaceId: "workspace-1",
  };

  provideContext(snapshot, () => {
    assert.equal(hasWorkspaceContext(), true);
  });
});

test("RuntimeContext - hasWorkspaceContext returns false when workspaceId is empty", () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace-123",
    taskId: "task-456",
    workspaceId: "",
  };

  provideContext(snapshot, () => {
    assert.equal(hasWorkspaceContext(), false);
  });
});

test("RuntimeContext - provideContext works with async functions", async () => {
  const snapshot: RuntimeContextSnapshot = {
    traceId: "trace-async",
    taskId: "task-async",
  };

  await provideContext(snapshot, async () => {
    const result = await Promise.resolve(getContext());
    assert.equal(result.traceId, "trace-async");
    return result;
  });
});

test("RuntimeContext - nested provideContext", () => {
  const snapshot1: RuntimeContextSnapshot = {
    traceId: "trace-1",
    taskId: "task-1",
  };
  const snapshot2: RuntimeContextSnapshot = {
    traceId: "trace-2",
    taskId: "task-2",
  };

  provideContext(snapshot1, () => {
    assert.equal(getContext().traceId, "trace-1");

    provideContext(snapshot2, () => {
      assert.equal(getContext().traceId, "trace-2");
    });

    // Back to outer context
    assert.equal(getContext().traceId, "trace-1");
  });
});