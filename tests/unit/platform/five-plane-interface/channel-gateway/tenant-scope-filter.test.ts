import { strict as assert } from "node:assert";
import { test } from "node:test";

import { TenantScopeFilter, type TaskProjectionScopeResolver } from "../../../../../src/platform/five-plane-interface/channel-gateway/tenant-scope-filter.js";

function makeResolver(found: boolean, taskScope?: { tenantId: string | null; requiredScopes?: readonly string[] }): TaskProjectionScopeResolver {
  return (taskId: string) => {
    if (!found) return null;
    return {
      taskId,
      tenantId: taskScope == null ? "tenant_abc" : taskScope.tenantId,
      ...(taskScope?.requiredScopes !== undefined ? { requiredScopes: taskScope.requiredScopes } : {}),
    };
  };
}

test("TenantScopeFilter evaluate returns scope.task_unknown when task not found", () => {
  const filter = new TenantScopeFilter(makeResolver(false));
  const result = filter.evaluate({ actorId: "actor_123", tenantId: "tenant_abc" }, "task_456");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "scope.task_unknown");
});

test("TenantScopeFilter evaluate returns scope.tenant_mismatch when tenant differs", () => {
  const filter = new TenantScopeFilter(makeResolver(true, { tenantId: "tenant_xyz" }));
  const result = filter.evaluate({ actorId: "actor_123", tenantId: "tenant_abc" }, "task_456");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "scope.tenant_mismatch");
});

test("TenantScopeFilter evaluate allows when tenant matches and no required scopes", () => {
  const filter = new TenantScopeFilter(makeResolver(true, { tenantId: "tenant_abc" }));
  const result = filter.evaluate({ actorId: "actor_123", tenantId: "tenant_abc" }, "task_456");
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "scope.allowed");
});

test("TenantScopeFilter evaluate allows when tenant matches and principal has required scope", () => {
  const filter = new TenantScopeFilter(makeResolver(true, { tenantId: "tenant_abc", requiredScopes: ["tasks:read"] }));
  const result = filter.evaluate(
    { actorId: "actor_123", tenantId: "tenant_abc", scopes: ["tasks:read", "tasks:write"] },
    "task_456",
  );
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "scope.allowed");
});

test("TenantScopeFilter evaluate returns scope.missing_required_scope when principal lacks scope", () => {
  const filter = new TenantScopeFilter(makeResolver(true, { tenantId: "tenant_abc", requiredScopes: ["tasks:admin"] }));
  const result = filter.evaluate(
    { actorId: "actor_123", tenantId: "tenant_abc", scopes: ["tasks:read"] },
    "task_456",
  );
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "scope.missing_required_scope");
});

test("TenantScopeFilter evaluate allows when principal has all required scopes", () => {
  const filter = new TenantScopeFilter(makeResolver(true, { tenantId: "tenant_abc", requiredScopes: ["tasks:read", "tasks:write"] }));
  const result = filter.evaluate(
    { actorId: "actor_123", tenantId: "tenant_abc", scopes: ["tasks:read", "tasks:write", "tasks:admin"] },
    "task_456",
  );
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "scope.allowed");
});

test("TenantScopeFilter evaluate handles null tenantId in principal", () => {
  const filter = new TenantScopeFilter(makeResolver(true, { tenantId: null }));
  const result = filter.evaluate({ actorId: "actor_123", tenantId: null }, "task_456");
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "scope.allowed");
});

test("TenantScopeFilter evaluate handles null tenantId in task scope", () => {
  const filter = new TenantScopeFilter(makeResolver(true, { tenantId: "tenant_abc" }));
  const result = filter.evaluate({ actorId: "actor_123", tenantId: null }, "task_456");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "scope.tenant_mismatch");
});

test("TenantScopeFilter evaluate handles both null tenantIds matching", () => {
  const filter = new TenantScopeFilter(makeResolver(true, { tenantId: null }));
  const result = filter.evaluate({ actorId: "actor_123", tenantId: null }, "task_456");
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "scope.allowed");
});

test("TenantScopeFilter evaluate handles empty required scopes array", () => {
  const filter = new TenantScopeFilter(makeResolver(true, { tenantId: "tenant_abc", requiredScopes: [] }));
  const result = filter.evaluate(
    { actorId: "actor_123", tenantId: "tenant_abc", scopes: [] },
    "task_456",
  );
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "scope.allowed");
});

test("TenantScopeFilter evaluate handles undefined scopes in principal", () => {
  const filter = new TenantScopeFilter(makeResolver(true, { tenantId: "tenant_abc", requiredScopes: ["tasks:read"] }));
  const result = filter.evaluate(
    { actorId: "actor_123", tenantId: "tenant_abc" },
    "task_456",
  );
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "scope.missing_required_scope");
});
