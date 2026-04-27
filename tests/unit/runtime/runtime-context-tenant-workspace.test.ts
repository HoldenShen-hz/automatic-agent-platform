import test from "node:test";
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
  type RuntimeContextSnapshot,
} from "../../../src/platform/shared/context/runtime-context.js";

function baseContext(overrides: Partial<RuntimeContextSnapshot> = {}): RuntimeContextSnapshot {
  return {
    traceId: "trace_test",
    taskId: "task_test",
    ...overrides,
  };
}

test("getTenantId returns tenantId when set in context", () => {
  const ctx = baseContext({ tenantId: "tenant_abc" });
  provideContext(ctx, () => {
    assert.equal(getTenantId(), "tenant_abc");
  });
});

test("getTenantId returns null when tenantId not set", () => {
  const ctx = baseContext({});
  provideContext(ctx, () => {
    assert.equal(getTenantId(), null);
  });
});

test("getTenantId returns null when context is missing", () => {
  assert.equal(getTenantId(), null);
});

test("getTenantIdOrNull returns tenantId when set", () => {
  const ctx = baseContext({ tenantId: "tenant_xyz" });
  provideContext(ctx, () => {
    assert.equal(getTenantIdOrNull(), "tenant_xyz");
  });
});

test("getTenantIdOrNull returns null when not set", () => {
  const ctx = baseContext({});
  provideContext(ctx, () => {
    assert.equal(getTenantIdOrNull(), null);
  });
});

test("getWorkspaceId returns workspaceId when set", () => {
  const ctx = baseContext({ workspaceId: "ws_123" });
  provideContext(ctx, () => {
    assert.equal(getWorkspaceId(), "ws_123");
  });
});

test("getWorkspaceId returns null when workspaceId not set", () => {
  const ctx = baseContext({});
  provideContext(ctx, () => {
    assert.equal(getWorkspaceId(), null);
  });
});

test("getWorkspaceId returns null when context is missing", () => {
  assert.equal(getWorkspaceId(), null);
});

test("getWorkspaceIdOrNull returns workspaceId when set", () => {
  const ctx = baseContext({ workspaceId: "ws_456" });
  provideContext(ctx, () => {
    assert.equal(getWorkspaceIdOrNull(), "ws_456");
  });
});

test("getWorkspaceIdOrNull returns null when not set", () => {
  const ctx = baseContext({});
  provideContext(ctx, () => {
    assert.equal(getWorkspaceIdOrNull(), null);
  });
});

test("hasTenantContext returns true when tenantId is set with value", () => {
  const ctx = baseContext({ tenantId: "tenant_active" });
  provideContext(ctx, () => {
    assert.equal(hasTenantContext(), true);
  });
});

test("hasTenantContext returns false when tenantId is empty string", () => {
  const ctx = baseContext({ tenantId: "" });
  provideContext(ctx, () => {
    assert.equal(hasTenantContext(), false);
  });
});

test("hasTenantContext returns false when tenantId is not set", () => {
  const ctx = baseContext({});
  provideContext(ctx, () => {
    assert.equal(hasTenantContext(), false);
  });
});

test("hasTenantContext returns false when context missing", () => {
  assert.equal(hasTenantContext(), false);
});

test("hasWorkspaceContext returns true when workspaceId is set", () => {
  const ctx = baseContext({ workspaceId: "ws_active" });
  provideContext(ctx, () => {
    assert.equal(hasWorkspaceContext(), true);
  });
});

test("hasWorkspaceContext returns false when workspaceId is empty string", () => {
  const ctx = baseContext({ workspaceId: "" });
  provideContext(ctx, () => {
    assert.equal(hasWorkspaceContext(), false);
  });
});

test("hasWorkspaceContext returns false when workspaceId is not set", () => {
  const ctx = baseContext({});
  provideContext(ctx, () => {
    assert.equal(hasWorkspaceContext(), false);
  });
});

test("hasWorkspaceContext returns false when context missing", () => {
  assert.equal(hasWorkspaceContext(), false);
});

test("withContextPatch preserves workspaceId from parent when patching tenantId", () => {
  const ctx = baseContext({
    tenantId: "tenant_parent",
    workspaceId: "ws_parent",
  });
  provideContext(ctx, () => {
    withContextPatch({ tenantId: "tenant_child" }, () => {
      const patched = getContext();
      assert.equal(patched.tenantId, "tenant_child");
      assert.equal(patched.workspaceId, "ws_parent");
      assert.ok(hasTenantContext());
      assert.ok(hasWorkspaceContext());
    });
    // After patch scope, original context is restored
    assert.equal(getContext().tenantId, "tenant_parent");
  });
});

test("withContextPatch can patch both tenant and workspace together", () => {
  const ctx = baseContext({});
  provideContext(ctx, () => {
    withContextPatch({ tenantId: "new_tenant", workspaceId: "new_ws" }, () => {
      const patched = getContext();
      assert.equal(patched.tenantId, "new_tenant");
      assert.equal(patched.workspaceId, "new_ws");
      assert.ok(hasTenantContext());
      assert.ok(hasWorkspaceContext());
    });
  });
});

test("assertContext includes tenantId and workspaceId when checking all fields", () => {
  const ctx = baseContext({
    tenantId: "tenant_required",
    workspaceId: "ws_required",
  });
  provideContext(ctx, () => {
    const result = assertContext("traceId", "taskId", "tenantId", "workspaceId");
    assert.equal(result.tenantId, "tenant_required");
    assert.equal(result.workspaceId, "ws_required");
  });
});

test("getContextOrNull returns context inside provideContext", () => {
  const ctx = baseContext();
  provideContext(ctx, () => {
    const retrieved = getContextOrNull();
    assert.ok(retrieved !== null);
    assert.equal(retrieved!.traceId, "trace_test");
  });
});

test("getContextOrNull returns null outside provideContext", () => {
  assert.equal(getContextOrNull(), null);
});

test("multiple nested patches maintain isolation", () => {
  const ctx = baseContext({ tenantId: "tenant_outer" });
  provideContext(ctx, () => {
    withContextPatch({ tenantId: "tenant_middle" }, () => {
      withContextPatch({ workspaceId: "ws_inner" }, () => {
        const inner = getContext();
        assert.equal(inner.tenantId, "tenant_middle");
        assert.equal(inner.workspaceId, "ws_inner");
      });
      // After inner patch, back to middle
      const middle = getContext();
      assert.equal(middle.tenantId, "tenant_middle");
      assert.ok(!middle.workspaceId);
    });
    // After both patches, back to outer
    const outer = getContext();
    assert.equal(outer.tenantId, "tenant_outer");
    assert.ok(!outer.workspaceId);
  });
});