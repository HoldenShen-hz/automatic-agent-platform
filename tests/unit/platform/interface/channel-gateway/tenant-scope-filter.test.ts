import test from "node:test";
import assert from "node:assert/strict";
import { TenantScopeFilter } from "../../../../../src/platform/interface/channel-gateway/index.js";
import type { TaskProjectionScope, PrincipalScope } from "../../../../../src/platform/interface/channel-gateway/index.js";

test("TenantScopeFilter allows principal with matching tenant", () => {
  const taskScope: TaskProjectionScope = { taskId: "task-1", tenantId: "tenant-A" };
  const filter = new TenantScopeFilter(() => taskScope);

  const principal: PrincipalScope = { actorId: "user-1", tenantId: "tenant-A" };
  const result = filter.evaluate(principal, "task-1");

  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "scope.allowed");
});

test("TenantScopeFilter rejects when task is unknown", () => {
  const filter = new TenantScopeFilter(() => null);

  const principal: PrincipalScope = { actorId: "user-1", tenantId: "tenant-A" };
  const result = filter.evaluate(principal, "task-unknown");

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "scope.task_unknown");
});

test("TenantScopeFilter rejects when tenant IDs do not match", () => {
  const taskScope: TaskProjectionScope = { taskId: "task-1", tenantId: "tenant-A" };
  const filter = new TenantScopeFilter(() => taskScope);

  const principal: PrincipalScope = { actorId: "user-1", tenantId: "tenant-B" };
  const result = filter.evaluate(principal, "task-1");

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "scope.tenant_mismatch");
});

test("TenantScopeFilter allows when principal tenant is null (system scope)", () => {
  const taskScope: TaskProjectionScope = { taskId: "task-1", tenantId: null };
  const filter = new TenantScopeFilter(() => taskScope);

  const principal: PrincipalScope = { actorId: "system", tenantId: null };
  const result = filter.evaluate(principal, "task-1");

  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "scope.allowed");
});

test("TenantScopeFilter rejects when task requires scopes but principal has none", () => {
  const taskScope: TaskProjectionScope = {
    taskId: "task-1",
    tenantId: "tenant-A",
    requiredScopes: ["admin:write"],
  };
  const filter = new TenantScopeFilter(() => taskScope);

  const principal: PrincipalScope = { actorId: "user-1", tenantId: "tenant-A" };
  const result = filter.evaluate(principal, "task-1");

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "scope.missing_required_scope");
});

test("TenantScopeFilter rejects when principal is missing one of required scopes", () => {
  const taskScope: TaskProjectionScope = {
    taskId: "task-1",
    tenantId: "tenant-A",
    requiredScopes: ["admin:write", "task:execute"],
  };
  const filter = new TenantScopeFilter(() => taskScope);

  const principal: PrincipalScope = {
    actorId: "user-1",
    tenantId: "tenant-A",
    scopes: ["admin:write"],
  };
  const result = filter.evaluate(principal, "task-1");

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "scope.missing_required_scope");
});

test("TenantScopeFilter allows when principal has all required scopes", () => {
  const taskScope: TaskProjectionScope = {
    taskId: "task-1",
    tenantId: "tenant-A",
    requiredScopes: ["admin:write", "task:execute"],
  };
  const filter = new TenantScopeFilter(() => taskScope);

  const principal: PrincipalScope = {
    actorId: "user-1",
    tenantId: "tenant-A",
    scopes: ["admin:write", "task:execute"],
  };
  const result = filter.evaluate(principal, "task-1");

  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "scope.allowed");
});

test("TenantScopeFilter allows when no required scopes are defined", () => {
  const taskScope: TaskProjectionScope = {
    taskId: "task-1",
    tenantId: "tenant-A",
    requiredScopes: [],
  };
  const filter = new TenantScopeFilter(() => taskScope);

  const principal: PrincipalScope = {
    actorId: "user-1",
    tenantId: "tenant-A",
    scopes: [],
  };
  const result = filter.evaluate(principal, "task-1");

  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "scope.allowed");
});

test("TenantScopeFilter allows when task scope has no requiredScopes defined", () => {
  const taskScope: TaskProjectionScope = { taskId: "task-1", tenantId: "tenant-A" };
  const filter = new TenantScopeFilter(() => taskScope);

  const principal: PrincipalScope = { actorId: "user-1", tenantId: "tenant-A", scopes: [] };
  const result = filter.evaluate(principal, "task-1");

  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "scope.allowed");
});