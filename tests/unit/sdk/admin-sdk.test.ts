/**
 * @fileoverview Unit tests for Admin SDK (src/sdk/admin-sdk/index.ts)
 * Covers R8-23: OperationalDirective methods
 */

import assert from "node:assert/strict";
import test from "node:test";

import { AdminSdk } from "../../../src/sdk/admin-sdk/index.js";
import { createApiClient } from "../../../src/sdk/client-sdk/api-client.js";
import type { ApiClientConfig } from "../../../src/sdk/client-sdk/api-client.js";

// ============================================================================
// R8-23: OperationalDirective methods via AdminSdk
// ============================================================================

test("AdminSdk.pauseHarnessRun creates pause operational directive", () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
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

test("AdminSdk.issueOperationalDirective creates custom operational directive", () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
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
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ domainId: "d_new", name: "New Domain" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.registerDomain<{ domainId: string; name: string }>({
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

test("AdminSdk.triggerPanic sends POST to panic endpoint", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
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

// ============================================================================
// Directive with expiration
// ============================================================================

test("AdminSdk.issueOperationalDirective accepts expiresAt", () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
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
    expiresAt: "2026-04-28T12:00:00.000Z",
  });

  assert.equal(directive.expiresAt, "2026-04-28T12:00:00.000Z");
});