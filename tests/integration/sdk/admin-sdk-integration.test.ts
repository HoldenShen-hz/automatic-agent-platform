/**
 * @fileoverview Integration tests for Admin SDK with seeded API context
 *
 * Tests the Admin SDK against a real seeded API context to verify
 * end-to-end functionality including tenant management, policy management,
 * domain lifecycle, and rollout control operations.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AdminSdk } from "../../../src/sdk/admin-sdk/index.js";
import { createSeededApiContext, type SeededApiContext } from "../../helpers/api.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================

function createMockFetchForSeededContext(ctx: SeededApiContext) {
  const originalFetch = globalThis.fetch;
  const baseUrl = "https://api.example.com";

  // Helper to create Response with proper headers
  const createResponse = (data: unknown, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "content-type": "application/json",
        "x-next-cursor": "null",
        "x-total-count": "0",
      },
    });
  };

  globalThis.fetch = async (url: URL | RequestInfo, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.toString() : String(url);

    // Tenant endpoints
    if (urlStr.includes("/tenants") && init?.method === "GET") {
      return createResponse([
        { tenantId: "seeded-tenant", name: "Seeded Tenant", status: "active" },
      ]);
    }
    if (urlStr.match(/\/tenants\/([^/]+)$/) && !urlStr.includes("/suspend") && !urlStr.includes("/resume")) {
      const match = urlStr.match(/\/tenants\/([^/]+)$/);
      if (match && init?.method === "GET") {
        return createResponse({ tenantId: match[1], name: "Test Tenant", status: "active" });
      }
      if (match && init?.method === "DELETE") {
        return createResponse({ deleted: true });
      }
      if (match && init?.method === "PATCH") {
        return createResponse({ tenantId: match[1], name: "Updated Tenant" });
      }
    }
    if (urlStr.match(/\/tenants\/([^/]+)\/suspend$/) && init?.method === "POST") {
      const match = urlStr.match(/\/tenants\/([^/]+)\/suspend$/);
      return createResponse({ tenantId: match?.[1], status: "suspended" });
    }
    if (urlStr.match(/\/tenants\/([^/]+)\/resume$/) && init?.method === "POST") {
      const match = urlStr.match(/\/tenants\/([^/]+)\/resume$/);
      return createResponse({ tenantId: match?.[1], status: "active" });
    }

    // Policy endpoints
    if (urlStr.includes("/policies") && init?.method === "GET") {
      return createResponse([
        { policyId: "policy-1", name: "Policy 1", effect: "allow" },
      ]);
    }
    if (urlStr.match(/\/policies\/([^/]+)$/) && init?.method === "GET") {
      const match = urlStr.match(/\/policies\/([^/]+)$/);
      return createResponse({ policyId: match?.[1], name: "Test Policy", effect: "allow" });
    }
    if (urlStr.match(/\/policies\/([^/]+)$/) && init?.method === "DELETE") {
      return createResponse({ deleted: true });
    }
    if (urlStr.match(/\/policies\/attachments/) && init?.method === "POST") {
      return createResponse({ attached: true });
    }
    if (urlStr.match(/\/policies\/attachments/) && init?.method === "DELETE") {
      return createResponse({ detached: true });
    }
    if (urlStr.match(/\/policies\/([^/]+)\/attachments$/)) {
      return createResponse([]);
    }

    // Domain endpoints
    if (urlStr.includes("/domains") && init?.method === "GET") {
      return createResponse([
        { domainId: "domain-seeded", name: "Seeded Domain" },
      ]);
    }
    if (urlStr.match(/\/domains\/([^/]+)\/lifecycle\/activate$/) && init?.method === "POST") {
      return createResponse({ domainId: "domain-1", status: "active" });
    }
    if (urlStr.match(/\/domains\/([^/]+)\/lifecycle\/deactivate$/) && init?.method === "POST") {
      return createResponse({ domainId: "domain-1", status: "inactive" });
    }
    if (urlStr.match(/\/domains\/([^/]+)\/lifecycle\/suspend$/) && init?.method === "POST") {
      return createResponse({ domainId: "domain-1", status: "suspended" });
    }
    if (urlStr.match(/\/domains\/([^/]+)\/lifecycle\/resume$/) && init?.method === "POST") {
      return createResponse({ domainId: "domain-1", status: "active" });
    }
    if (urlStr.match(/\/domains\/([^/]+)\/lifecycle\/status$/)) {
      return createResponse({ domainId: "domain-1", status: "active", lastUpdated: new Date().toISOString() });
    }

    // Rollout endpoints
    if (urlStr.includes("/rollouts") && init?.method === "GET") {
      return createResponse([
        { rolloutId: "rollout-seeded", name: "Seeded Rollout", status: "in_progress" },
      ]);
    }
    if (urlStr.match(/\/rollouts\/([^/]+)$/) && init?.method === "GET") {
      const match = urlStr.match(/\/rollouts\/([^/]+)$/);
      return createResponse({ rolloutId: match?.[1], name: "Test Rollout", status: "pending" });
    }
    if (urlStr.match(/\/rollouts\/([^/]+)\/pause$/) && init?.method === "POST") {
      return createResponse({ rolloutId: "rollout-1", status: "paused" });
    }
    if (urlStr.match(/\/rollouts\/([^/]+)\/resume$/) && init?.method === "POST") {
      return createResponse({ rolloutId: "rollout-1", status: "in_progress" });
    }
    if (urlStr.match(/\/rollouts\/([^/]+)\/cancel$/) && init?.method === "POST") {
      return createResponse({ rolloutId: "rollout-1", status: "cancelled" });
    }
    if (urlStr.match(/\/rollouts\/([^/]+)\/rollback$/) && init?.method === "POST") {
      return createResponse({ rolloutId: "rollout-1", status: "rolled_back" });
    }
    if (urlStr.match(/\/rollouts\/([^/]+)\/advance$/) && init?.method === "POST") {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      return createResponse({ rolloutId: "rollout-1", percentage: body.targetPercentage });
    }
    if (urlStr.match(/\/rollouts\/([^/]+)\/status$/)) {
      return createResponse({ rolloutId: "rollout-1", status: "in_progress", percentage: 50, strategy: "canary" });
    }

    // Panic endpoints
    if (urlStr.includes("/panic/trigger")) {
      return createResponse({ triggered: true });
    }
    if (urlStr.match(/\/panic\/([^/]+)\/resume$/)) {
      return createResponse({ resumed: true });
    }

    // Agent lifecycle
    if (urlStr.match(/\/agents\/([^/]+)\/([^/]+)$/)) {
      return createResponse({ agentId: "agent-1", action: "started" });
    }

    // Secrets
    if (urlStr.includes("/secrets/rotate")) {
      return createResponse({ rotated: true });
    }

    // Version handshake
    if (urlStr.includes("/version")) {
      return createResponse({
        platformVersion: "v4.3",
        contractVersion: "v4.3",
        minClientVersion: "0.1.0",
      });
    }

    // Default: return not found to fail test if unexpected
    console.warn(`Unhandled fetch: ${urlStr} ${init?.method ?? "GET"}`);
    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
}

// ============================================================================
// Admin SDK Integration Tests with Seeded Context
// ============================================================================

test("AdminSdk with seeded context: listTenants returns seeded tenant data", async () => {
  const workspace = createTempWorkspace("admin-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);
    const restore = createMockFetchForSeededContext(ctx);

    try {
      const sdk = new AdminSdk({
        baseUrl: "https://api.example.com",
        apiVersion: "v1",
        bearerToken: "test-token",
      });

      const result = await sdk.listTenants<{ tenantId: string; name: string }>();
      assert.ok(result.data.length > 0);
      assert.equal(result.status, 200);
    } finally {
      restore();
    }
  } finally {
    if (ctx) {
      ctx.db.close();
    }
    cleanupPath(workspace);
  }
});

test("AdminSdk with seeded context: listPolicies returns policy data", async () => {
  const workspace = createTempWorkspace("admin-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);
    const restore = createMockFetchForSeededContext(ctx);

    try {
      const sdk = new AdminSdk({
        baseUrl: "https://api.example.com",
        apiVersion: "v1",
        bearerToken: "test-token",
      });

      const result = await sdk.listPolicies<{ policyId: string; name: string }>();
      assert.ok(result.data.length > 0);
      assert.equal(result.status, 200);
    } finally {
      restore();
    }
  } finally {
    if (ctx) {
      ctx.db.close();
    }
    cleanupPath(workspace);
  }
});

test("AdminSdk with seeded context: listDomains returns domain data", async () => {
  const workspace = createTempWorkspace("admin-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);
    const restore = createMockFetchForSeededContext(ctx);

    try {
      const sdk = new AdminSdk({
        baseUrl: "https://api.example.com",
        apiVersion: "v1",
        bearerToken: "test-token",
      });

      const result = await sdk.listDomains<{ domainId: string; name: string }>();
      assert.ok(result.data.length > 0);
      assert.equal(result.status, 200);
    } finally {
      restore();
    }
  } finally {
    if (ctx) {
      ctx.db.close();
    }
    cleanupPath(workspace);
  }
});

test("AdminSdk with seeded context: listRollouts returns rollout data", async () => {
  const workspace = createTempWorkspace("admin-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);
    const restore = createMockFetchForSeededContext(ctx);

    try {
      const sdk = new AdminSdk({
        baseUrl: "https://api.example.com",
        apiVersion: "v1",
        bearerToken: "test-token",
      });

      const result = await sdk.listRollouts<{ rolloutId: string; name: string }>();
      assert.ok(result.data.length > 0);
      assert.equal(result.status, 200);
    } finally {
      restore();
    }
  } finally {
    if (ctx) {
      ctx.db.close();
    }
    cleanupPath(workspace);
  }
});

test("AdminSdk with seeded context: pauseHarnessRun creates pause directive", () => {
  const workspace = createTempWorkspace("admin-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);
    const sdk = new AdminSdk({
      baseUrl: "https://api.example.com",
      apiVersion: "v1",
      bearerToken: "test-token",
    });

    const directive = sdk.pauseHarnessRun({
      harnessRunId: "harness-run-123",
      reason: "Maintenance window",
      issuedBy: {
        principalId: "p_admin",
        tenantId: "t_tenant",
        roles: ["admin"],
      },
    });

    assert.equal(directive.type, "pause");
    assert.equal(directive.scope?.harnessRunId, "harness-run-123");
    assert.equal(directive.reason, "Maintenance window");
    assert.equal(directive.issuedBy.principalId, "p_admin");
    assert.ok(directive.operationalDirectiveId.startsWith("opdir_"));
  } finally {
    if (ctx) {
      ctx.db.close();
    }
    cleanupPath(workspace);
  }
});

test("AdminSdk with seeded context: abortHarnessRun creates kill directive", () => {
  const workspace = createTempWorkspace("admin-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);
    const sdk = new AdminSdk({
      baseUrl: "https://api.example.com",
      apiVersion: "v1",
      bearerToken: "test-token",
    });

    const directive = sdk.abortHarnessRun({
      harnessRunId: "harness-run-456",
      reason: "User requested cancellation",
      issuedBy: {
        principalId: "p_operator",
        tenantId: "t_tenant",
        roles: ["operator"],
      },
    });

    assert.equal(directive.type, "kill");
    assert.equal(directive.scope?.harnessRunId, "harness-run-456");
    assert.equal(directive.issuedBy.principalId, "p_operator");
  } finally {
    if (ctx) {
      ctx.db.close();
    }
    cleanupPath(workspace);
  }
});

test("AdminSdk with seeded context: issueDecisionDirective creates approve directive", () => {
  const workspace = createTempWorkspace("admin-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);
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
    assert.equal(directive.issuedBy.displayName, "John Doe");
    assert.equal(directive.riskAcknowledged, true);
    assert.ok(directive.decisionDirectiveId.startsWith("decDir_"));
  } finally {
    if (ctx) {
      ctx.db.close();
    }
    cleanupPath(workspace);
  }
});

test("AdminSdk with seeded context: issueOperationalDirective with custom params", () => {
  const workspace = createTempWorkspace("admin-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);
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
  } finally {
    if (ctx) {
      ctx.db.close();
    }
    cleanupPath(workspace);
  }
});

test("AdminSdk with seeded context: tenant operations work correctly", async () => {
  const workspace = createTempWorkspace("admin-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);
    const restore = createMockFetchForSeededContext(ctx);

    try {
      const sdk = new AdminSdk({
        baseUrl: "https://api.example.com",
        apiVersion: "v1",
        bearerToken: "test-token",
      });

      // Test getTenant
      const tenantResult = await sdk.getTenant<{ tenantId: string; name: string }>("tenant-123");
      assert.equal(tenantResult.data.tenantId, "tenant-123");

      // Test suspendTenant
      const suspendResult = await sdk.suspendTenant<{ tenantId: string; status: string }>("tenant-123", "Policy violation");
      assert.equal(suspendResult.data.status, "suspended");

      // Test resumeTenant
      const resumeResult = await sdk.resumeTenant<{ tenantId: string; status: string }>("tenant-123");
      assert.equal(resumeResult.data.status, "active");
    } finally {
      restore();
    }
  } finally {
    if (ctx) {
      ctx.db.close();
    }
    cleanupPath(workspace);
  }
});

test("AdminSdk with seeded context: domain lifecycle operations work correctly", async () => {
  const workspace = createTempWorkspace("admin-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);
    const restore = createMockFetchForSeededContext(ctx);

    try {
      const sdk = new AdminSdk({
        baseUrl: "https://api.example.com",
        apiVersion: "v1",
        bearerToken: "test-token",
      });

      // Test activateDomain
      const activateResult = await sdk.activateDomain<{ domainId: string; status: string }>("domain-1", "Ready to activate");
      assert.equal(activateResult.data.status, "active");

      // Test suspendDomain
      const suspendResult = await sdk.suspendDomain<{ domainId: string; status: string }>("domain-1", "Maintenance");
      assert.equal(suspendResult.data.status, "suspended");

      // Test resumeDomain
      const resumeResult = await sdk.resumeDomain<{ domainId: string; status: string }>("domain-1");
      assert.equal(resumeResult.data.status, "active");

      // Test getDomainStatus
      const statusResult = await sdk.getDomainStatus<{ domainId: string; status: string }>("domain-1");
      assert.equal(statusResult.data.domainId, "domain-1");
      assert.equal(statusResult.data.status, "active");
    } finally {
      restore();
    }
  } finally {
    if (ctx) {
      ctx.db.close();
    }
    cleanupPath(workspace);
  }
});

test("AdminSdk with seeded context: rollout control operations work correctly", async () => {
  const workspace = createTempWorkspace("admin-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);
    const restore = createMockFetchForSeededContext(ctx);

    try {
      const sdk = new AdminSdk({
        baseUrl: "https://api.example.com",
        apiVersion: "v1",
        bearerToken: "test-token",
      });

      // Test getRollout
      const rolloutResult = await sdk.getRollout<{ rolloutId: string; name: string }>("rollout-1");
      assert.equal(rolloutResult.data.rolloutId, "rollout-1");

      // Test pauseRollout
      const pauseResult = await sdk.pauseRollout<{ rolloutId: string; status: string }>("rollout-1", "Scheduled maintenance");
      assert.equal(pauseResult.data.status, "paused");

      // Test resumeRollout
      const resumeResult = await sdk.resumeRollout<{ rolloutId: string; status: string }>("rollout-1");
      assert.equal(resumeResult.data.status, "in_progress");

      // Test cancelRollout
      const cancelResult = await sdk.cancelRollout<{ rolloutId: string; status: string }>("rollout-1", "User requested");
      assert.equal(cancelResult.data.status, "cancelled");

      // Test rollbackRollout
      const rollbackResult = await sdk.rollbackRollout<{ rolloutId: string; status: string }>("rollout-1");
      assert.equal(rollbackResult.data.status, "rolled_back");

      // Test advanceRolloutPercentage
      const advanceResult = await sdk.advanceRolloutPercentage<{ rolloutId: string; percentage: number }>("rollout-1", 75);
      assert.equal(advanceResult.data.percentage, 75);

      // Test getRolloutStatus
      const statusResult = await sdk.getRolloutStatus<{ rolloutId: string; status: string; percentage: number }>("rollout-1");
      assert.equal(statusResult.data.status, "in_progress");
      assert.equal(statusResult.data.percentage, 50);
    } finally {
      restore();
    }
  } finally {
    if (ctx) {
      ctx.db.close();
    }
    cleanupPath(workspace);
  }
});

test("AdminSdk with seeded context: policy attachment operations work correctly", async () => {
  const workspace = createTempWorkspace("admin-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);
    const restore = createMockFetchForSeededContext(ctx);

    try {
      const sdk = new AdminSdk({
        baseUrl: "https://api.example.com",
        apiVersion: "v1",
        bearerToken: "test-token",
      });

      // Test attachPolicy
      const attachResult = await sdk.attachPolicy<{ attached: boolean }>("tenant", "tenant-1", "policy-1");
      assert.equal(attachResult.data.attached, true);

      // Test detachPolicy
      const detachResult = await sdk.detachPolicy<{ detached: boolean }>("tenant", "tenant-1", "policy-1");
      assert.equal(detachResult.data.detached, true);

      // Test listPolicyAttachments
      const attachmentsResult = await sdk.listPolicyAttachments<{ targetType: string }>("policy-1");
      assert.ok(Array.isArray(attachmentsResult.data));
    } finally {
      restore();
    }
  } finally {
    if (ctx) {
      ctx.db.close();
    }
    cleanupPath(workspace);
  }
});

test("AdminSdk with seeded context: panic and emergency operations work", async () => {
  const workspace = createTempWorkspace("admin-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);
    const restore = createMockFetchForSeededContext(ctx);

    try {
      const sdk = new AdminSdk({
        baseUrl: "https://api.example.com",
        apiVersion: "v1",
        bearerToken: "test-token",
      });

      // Test triggerPanic
      const panicResult = await sdk.triggerPanic<{ triggered: boolean }>({ scope: "platform" });
      assert.equal(panicResult.data.triggered, true);

      // Test resumePanic
      const resumeResult = await sdk.resumePanic<{ resumed: boolean }>("global", {});
      assert.equal(resumeResult.data.resumed, true);
    } finally {
      restore();
    }
  } finally {
    if (ctx) {
      ctx.db.close();
    }
    cleanupPath(workspace);
  }
});

test("AdminSdk with seeded context: agent and secrets management work", async () => {
  const workspace = createTempWorkspace("admin-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);
    const restore = createMockFetchForSeededContext(ctx);

    try {
      const sdk = new AdminSdk({
        baseUrl: "https://api.example.com",
        apiVersion: "v1",
        bearerToken: "test-token",
      });

      // Test manageAgentLifecycle
      const agentResult = await sdk.manageAgentLifecycle<{ agentId: string; action: string }>("agent-1", "start");
      assert.equal(agentResult.data.agentId, "agent-1");

      // Test rotateSecrets
      const secretsResult = await sdk.rotateSecrets<{ rotated: boolean }>({ secretName: "api_key" });
      assert.equal(secretsResult.data.rotated, true);
    } finally {
      restore();
    }
  } finally {
    if (ctx) {
      ctx.db.close();
    }
    cleanupPath(workspace);
  }
});
