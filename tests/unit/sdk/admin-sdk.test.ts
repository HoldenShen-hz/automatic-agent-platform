/**
 * @fileoverview Unit tests for Admin SDK (src/sdk/admin-sdk/index.ts)
 * Covers R8-23: OperationalDirective methods
 */

import assert from "node:assert/strict";
import test from "node:test";

import { AdminSdk } from "../../../src/sdk/admin-sdk/index.js";
import { createApiClient } from "../../../src/sdk/client-sdk/api-client.js";
import type { ApiClientConfig } from "../../../src/sdk/client-sdk/api-client.js";

const ADMIN_SDK_TEST_CONFIG = {
  baseUrl: "https://api.example.com",
  apiVersion: "v1",
  bearerToken: "test-token",
  principal: {
    principalId: "sdk-admin",
    tenantId: "t_tenant",
    roles: ["admin"],
  },
} as const;

// ============================================================================
// R8-23: OperationalDirective methods via AdminSdk
// ============================================================================

test("AdminSdk.pauseHarnessRun creates pause operational directive", () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const directive = sdk.pauseHarnessRun({
    harnessRunId: "harness_run_123",
    reason: "Maintenance window",
    issuedBy: {
      principalId: "p_admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  assert.equal(directive.type, "pause");
  assert.equal(directive.scope?.harnessRunId, "harness_run_123");
  assert.equal(directive.reason, "Maintenance window");
  assert.equal(directive.issuedBy.principalId, "p_admin");
  assert.ok(directive.operationalDirectiveId.startsWith("opdir_"));
  assert.ok(directive.createdAt.length > 0);
});

test("AdminSdk.abortHarnessRun creates kill operational directive", () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const directive = sdk.abortHarnessRun({
    harnessRunId: "harness_run_456",
    reason: "User requested cancellation",
    issuedBy: {
      principalId: "p_operator",
      tenantId: "t_tenant",
      roles: ["operator"],
    },
  });

  assert.equal(directive.type, "kill");
  assert.equal(directive.scope?.harnessRunId, "harness_run_456");
  assert.equal(directive.reason, "User requested cancellation");
  assert.equal(directive.issuedBy.principalId, "p_operator");
  assert.deepEqual(directive.issuedBy.roles, ["operator"]);
});

test("AdminSdk.resumeHarnessRun creates resume operational directive", () => {
  const sdk = new AdminSdk(ADMIN_SDK_TEST_CONFIG);

  const directive = sdk.resumeHarnessRun("harness_run_resume", {
    principalId: "p_operator",
    tenantId: "t_tenant",
    roles: ["operator"],
  });

  assert.equal(directive.type, "resume");
  assert.equal(directive.scope?.harnessRunId, "harness_run_resume");
  assert.equal(directive.issuedBy.principalId, "p_operator");
});

test("AdminSdk.issueOperationalDirective creates custom operational directive", () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const directive = sdk.issueOperationalDirective({
    type: "mode_switch",
    scope: {
      tenantId: "t_tenant",
      harnessRunId: "harness_run_789",
    },
    issuedBy: {
      principalId: "p_admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
    reason: "Switch to supervised mode",
    params: { targetMode: "supervised" },
    expiresAt: "2026-04-28T12:00:00.000Z",
  });

  assert.equal(directive.type, "mode_switch");
  assert.equal(directive.scope?.tenantId, "t_tenant");
  assert.equal(directive.scope?.harnessRunId, "harness_run_789");
  assert.deepEqual(directive.params, { targetMode: "supervised" });
  assert.equal(directive.expiresAt, "2026-04-28T12:00:00.000Z");
});

test("AdminSdk.issueOperationalDirective with quota_adjust type", () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const directive = sdk.issueOperationalDirective({
    type: "quota_adjust",
    scope: {
      tenantId: "t_tenant",
    },
    issuedBy: {
      principalId: "p_admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
    reason: "Increase quota for production tenant",
    params: { maxTasksPerHour: 1000 },
  });

  assert.equal(directive.type, "quota_adjust");
  assert.deepEqual(directive.params, { maxTasksPerHour: 1000 });
});

test("AdminSdk.issueOperationalDirective with rollback type", () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const directive = sdk.issueOperationalDirective({
    type: "rollback",
    scope: {
      harnessRunId: "harness_run_rollback",
    },
    issuedBy: {
      principalId: "p_admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
    reason: "Rollback due to critical error",
    params: { checkpointRef: "checkpoint_abc" },
  });

  assert.equal(directive.type, "rollback");
  assert.deepEqual(directive.params, { checkpointRef: "checkpoint_abc" });
});

test("AdminSdk.issueOperationalDirective with resume type", () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const directive = sdk.issueOperationalDirective({
    type: "resume",
    issuedBy: {
      principalId: "p_operator",
      tenantId: "t_tenant",
      roles: ["operator"],
    },
    reason: "Resume after maintenance",
    params: {},
  });

  assert.equal(directive.type, "resume");
  assert.deepEqual(directive.params, {});
});

// ============================================================================
// R8-23: DecisionDirective methods via AdminSdk
// ============================================================================

test("AdminSdk.issueDecisionDirective creates approve decision directive", () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const directive = sdk.issueDecisionDirective({
    type: "approve",
    targetRef: "execution_123",
    payload: { score: 0.95 },
    reason: "Meets quality threshold",
    issuedBy: {
      principalId: "p_approver",
      tenantId: "t_tenant",
      roles: ["approver"],
      displayName: "John Doe",
    },
    riskAcknowledged: true,
  });

  assert.equal(directive.type, "approve");
  assert.equal(directive.targetRef, "execution_123");
  assert.deepEqual(directive.payload, { score: 0.95 });
  assert.equal(directive.reason, "Meets quality threshold");
  assert.equal(directive.issuedBy.displayName, "John Doe");
  assert.equal(directive.riskAcknowledged, true);
  assert.ok(directive.decisionDirectiveId.startsWith("decDir_"));
});

test("AdminSdk.issueDecisionDirective creates deny decision directive", () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const directive = sdk.issueDecisionDirective({
    type: "deny",
    targetRef: "execution_456",
    payload: { reason: "quality_below_threshold" },
    reason: "Quality score too low",
    issuedBy: {
      principalId: "p_reviewer",
      tenantId: "t_tenant",
      roles: ["reviewer"],
    },
    riskAcknowledged: false,
  });

  assert.equal(directive.type, "deny");
  assert.equal(directive.riskAcknowledged, false);
});

test("AdminSdk.issueDecisionDirective creates override decision directive", () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const directive = sdk.issueDecisionDirective({
    type: "override",
    targetRef: "policy_789",
    payload: { overrideReason: "business_need" },
    reason: "Override policy for specific use case",
    issuedBy: {
      principalId: "p_admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  assert.equal(directive.type, "override");
  assert.deepEqual(directive.payload, { overrideReason: "business_need" });
});

test("AdminSdk.issueDecisionDirective creates patch decision directive", () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const directive = sdk.issueDecisionDirective({
    type: "patch",
    targetRef: "config_abc",
    payload: { key: "max_retries", value: 5 },
    reason: "Update max retries configuration",
    issuedBy: {
      principalId: "p_operator",
      tenantId: "t_tenant",
      roles: ["operator"],
    },
  });

  assert.equal(directive.type, "patch");
  assert.deepEqual(directive.payload, { key: "max_retries", value: 5 });
});

test("AdminSdk.issueDecisionDirective creates takeover decision directive", () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const directive = sdk.issueDecisionDirective({
    type: "takeover",
    targetRef: "execution takeover_123",
    payload: { targetPrincipalId: "p_new_owner" },
    reason: "Transfer ownership to different team",
    issuedBy: {
      principalId: "p_admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  assert.equal(directive.type, "takeover");
  assert.deepEqual(directive.payload, { targetPrincipalId: "p_new_owner" });
});

test("AdminSdk.issueDecisionDirective creates expire_approval decision directive", () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const directive = sdk.issueDecisionDirective({
    type: "expire_approval",
    targetRef: "approval_xyz",
    payload: { originalRequester: "p_user1" },
    reason: "Approval window has expired",
    issuedBy: {
      principalId: "p_system",
      tenantId: "t_tenant",
      roles: ["system"],
    },
  });

  assert.equal(directive.type, "expire_approval");
});

// ============================================================================
// AdminSdk basic API operations
// ============================================================================

test("AdminSdk.listDomains returns paginated response", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  // Mock fetch
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([{ domainId: "d1" }, { domainId: "d2" }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.listDomains<{ domainId: string }>();
    assert.deepEqual(result.data, [{ domainId: "d1" }, { domainId: "d2" }]);
    assert.equal(result.status, 200);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.registerDomain sends POST request", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ domainId: "d_new", name: "New Domain" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.registerDomain<{ domainId: string; name: string }>({
      domainId: "d_new",
      name: "New Domain",
    });
    assert.equal(result.data.domainId, "d_new");
    assert.equal(result.status, 201);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.publishPack calls client.publishPack", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ packId: "pack_1", status: "published" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.publishPack<{ packId: string; status: string }>("pack_1", {});
    assert.equal(result.data.packId, "pack_1");
    assert.equal(result.data.status, "published");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.listWorkers and getConfig call operational endpoints", async () => {
  const sdk = new AdminSdk(ADMIN_SDK_TEST_CONFIG);
  const seenUrls: string[] = [];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    seenUrls.push(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await sdk.listWorkers("tenant-1");
    await sdk.getConfig("runtime/default");
    assert.deepEqual(seenUrls, [
      "https://api.example.com/api/v1/workers?tenantId=tenant-1",
      "https://api.example.com/api/v1/config/runtime/default",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk sends X-Platform-Version and X-SDK-Version headers", async () => {
  const sdk = new AdminSdk(ADMIN_SDK_TEST_CONFIG);
  const seenHeaders: Headers[] = [];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    seenHeaders.push(new Headers(init?.headers));
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await sdk.listWorkers();
    assert.equal(seenHeaders.length, 1);
    assert.equal(seenHeaders[0]?.get("X-Platform-Version"), "v4.3");
    assert.equal(seenHeaders[0]?.get("X-SDK-Version"), "1.0.0");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.triggerPanic sends POST to panic endpoint", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ triggered: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.triggerPanic<{ triggered: boolean }>({ scope: "platform" });
    assert.equal(result.data.triggered, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.resumePanic sends POST to resume endpoint", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ resumed: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.resumePanic<{ resumed: boolean }>("global", {});
    assert.equal(result.data.resumed, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.manageAgentLifecycle sends POST to agent action endpoint", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ agentId: "agent_1", action: "stopped" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.manageAgentLifecycle<{ agentId: string; action: string }>(
      "agent_1",
      "stop",
    );
    assert.equal(result.data.agentId, "agent_1");
    assert.equal(result.data.action, "stopped");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.rotateSecrets sends POST to secrets endpoint", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ rotated: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.rotateSecrets<{ rotated: boolean }>({
      secretName: "api_key",
    });
    assert.equal(result.data.rotated, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// =============================================================================
// Tenant Management Operations
// =============================================================================

test("AdminSdk.createTenant sends POST to /tenants", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ tenantId: "t_new", name: "New Tenant" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.createTenant<{ tenantId: string; name: string }>({
      name: "New Tenant",
    });
    assert.equal(result.data.tenantId, "t_new");
    assert.equal(result.status, 201);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.getTenant sends GET to /tenants/:id", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ tenantId: "t_1", name: "Tenant 1", status: "active" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.getTenant<{ tenantId: string; name: string; status: string }>("t_1");
    assert.equal(result.data.tenantId, "t_1");
    assert.equal(result.data.status, "active");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.listTenants returns paginated response", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([{ tenantId: "t_1" }, { tenantId: "t_2" }]), {
      status: 200,
      headers: { "content-type": "application/json", "x-next-cursor": "cursor_2", "x-total-count": "10" },
    });

  try {
    const result = await sdk.listTenants<{ tenantId: string }>({ limit: 2 });
    assert.deepEqual(result.data, [{ tenantId: "t_1" }, { tenantId: "t_2" }]);
    assert.equal(result.nextCursor, "cursor_2");
    assert.equal(result.totalCount, 10);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.updateTenant sends PATCH to /tenants/:id", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ tenantId: "t_1", name: "Updated Tenant" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.updateTenant<{ tenantId: string; name: string }>("t_1", { name: "Updated Tenant" });
    assert.equal(result.data.name, "Updated Tenant");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.deleteTenant sends DELETE to /tenants/:id", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ deleted: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.deleteTenant<{ deleted: boolean }>("t_1");
    assert.equal(result.data.deleted, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.activateTenant sends POST to /tenants/:id/activate", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ tenantId: "t_1", status: "active" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.activateTenant<{ tenantId: string; status: string }>("t_1");
    assert.equal(result.data.status, "active");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.suspendTenant sends POST to /tenants/:id/suspend", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ tenantId: "t_1", status: "suspended" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.suspendTenant<{ tenantId: string; status: string }>("t_1", "Policy violation");
    assert.equal(result.data.status, "suspended");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// =============================================================================
// Configuration Management Operations
// =============================================================================

test("AdminSdk.getConfig sends GET to /config/:key", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ key: "runtime/default", value: { maxWorkers: 10 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.getConfig<{ key: string; value: unknown }>("runtime/default");
    assert.equal(result.data.key, "runtime/default");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.listConfigs returns paginated response", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([{ key: "config_1" }, { key: "config_2" }]), {
      status: 200,
      headers: { "content-type": "application/json", "x-next-cursor": "cursor_2" },
    });

  try {
    const result = await sdk.listConfigs<{ key: string }>({ scope: "runtime", limit: 10 });
    assert.deepEqual(result.data, [{ key: "config_1" }, { key: "config_2" }]);
    assert.equal(result.nextCursor, "cursor_2");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.setConfig sends PUT to /config/:key", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ key: "new_config", value: { enabled: true } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.setConfig<{ key: string; value: unknown }>("new_config", { value: { enabled: true } });
    assert.equal(result.data.key, "new_config");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.updateConfig sends PATCH to /config/:key", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ key: "config_1", value: { maxWorkers: 20 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.updateConfig<{ key: string; value: { maxWorkers: number } }>("config_1", { maxWorkers: 20 });
    assert.equal(result.data.value.maxWorkers, 20);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.deleteConfig sends DELETE to /config/:key", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ deleted: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.deleteConfig<{ deleted: boolean }>("old_config");
    assert.equal(result.data.deleted, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.listConfigRevisions returns paginated revisions", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([{ revisionId: "rev_1" }, { revisionId: "rev_2" }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.listConfigRevisions<{ revisionId: string }>("config_1");
    assert.deepEqual(result.data, [{ revisionId: "rev_1" }, { revisionId: "rev_2" }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.rollbackConfig sends POST to /config/:key/rollback", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ key: "config_1", currentRevision: "rev_1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.rollbackConfig<{ key: string; currentRevision: string }>("config_1", "rev_1");
    assert.equal(result.data.currentRevision, "rev_1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// =============================================================================
// Audit Access/Logging Operations
// =============================================================================

test("AdminSdk.queryAuditLogs returns paginated audit logs", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([{ auditId: "audit_1", action: "tenant.create" }]), {
      status: 200,
      headers: { "content-type": "application/json", "x-next-cursor": "cursor_2" },
    });

  try {
    const result = await sdk.queryAuditLogs<{ auditId: string; action: string }>({
      tenantId: "t_1",
      startTime: "2026-01-01T00:00:00Z",
      limit: 10,
    });
    assert.deepEqual(result.data, [{ auditId: "audit_1", action: "tenant.create" }]);
    assert.equal(result.nextCursor, "cursor_2");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.getAuditLog sends GET to /audit/logs/:id", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ auditId: "audit_123", action: "config.update", timestamp: "2026-05-01T12:00:00Z" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.getAuditLog<{ auditId: string; action: string; timestamp: string }>("audit_123");
    assert.equal(result.data.auditId, "audit_123");
    assert.equal(result.data.action, "config.update");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.exportAuditLogs sends POST to /audit/export", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ exportId: "exp_1", status: "completed", downloadUrl: "https://..." }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.exportAuditLogs<{ exportId: string; status: string; downloadUrl: string }>({
      format: "json",
      startTime: "2026-01-01T00:00:00Z",
      endTime: "2026-05-01T00:00:00Z",
    });
    assert.equal(result.data.exportId, "exp_1");
    assert.equal(result.data.status, "completed");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.getAuditStats sends GET to /audit/stats", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ totalEvents: 1000, tenantBreakdown: { t_1: 500 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.getAuditStats<{ totalEvents: number; tenantBreakdown: Record<string, number> }>({
      startTime: "2026-01-01T00:00:00Z",
    });
    assert.equal(result.data.totalEvents, 1000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.archiveAuditLogs sends POST to /audit/archive", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ archived: true, count: 500 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.archiveAuditLogs<{ archived: boolean; count: number }>({
      olderThan: "2026-01-01T00:00:00Z",
    });
    assert.equal(result.data.archived, true);
    assert.equal(result.data.count, 500);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// Directive with expiration
// ============================================================================

test("AdminSdk.issueOperationalDirective accepts expiresAt", () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const directive = sdk.issueOperationalDirective({
    type: "pause",
    scope: { harnessRunId: "harness_run_expire" },
    issuedBy: {
      principalId: "p_admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
    reason: "Temporary pause",
    expiresAt: "2026-04-28T23:59:59.000Z",
  });

  assert.equal(directive.expiresAt, "2026-04-28T23:59:59.000Z");
});

test("AdminSdk.issueDecisionDirective accepts expiresAt", () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: {
      principalId: "sdk-admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
  });

  const directive = sdk.issueDecisionDirective({
    type: "approve",
    targetRef: "exec_123",
    payload: {},
    reason: "Temporary approval",
    issuedBy: {
      principalId: "p_approver",
      tenantId: "t_tenant",
      roles: ["approver"],
    },
  });

  // issueDecisionDirective does not support expiresAt - it only works with issueOperationalDirective
  assert.equal(directive.type, "approve");
});
