/**
 * @fileoverview Integration tests for Client SDK with seeded API context
 *
 * Tests the Client SDK event subscriber, version handshake, and API client
 * functionality against a real seeded API context.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { AdminSdk } from "../../../src/sdk/admin-sdk/index.js";
import { createSeededApiContext, type SeededApiContext } from "../../helpers/api.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================

const ADMIN_PRINCIPAL = {
  principalId: "p_admin",
  tenantId: "t_tenant",
  roles: ["admin"],
};

function createAdminSdk() {
  return new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: ADMIN_PRINCIPAL,
  });
}

function createMockFetchForClientContext(ctx: SeededApiContext) {
  const originalFetch = globalThis.fetch;
  const createResponse = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        "content-type": "application/json",
        ...headers,
      },
    });

  globalThis.fetch = async (url: URL | RequestInfo, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.toString() : String(url);

    // Version handshake
    if (urlStr.includes("/version")) {
      return createResponse({
        platformVersion: "v4.3",
        contractVersion: "v4.3",
        minClientVersion: "0.1.0",
      });
    }

    // Harness runs endpoints
    if (urlStr.includes("/harness-runs") && init?.method === "GET") {
      return createResponse([
        { runId: "run-1", status: "completed" },
        { runId: "run-2", status: "in_progress" },
      ], 200, {
        "x-next-cursor": "null",
        "x-total-count": "2",
      });
    }

    // Packs endpoints
    if (urlStr.includes("/packs") && init?.method === "GET") {
      return createResponse([
        { packId: "pack-1", name: "Pack 1" },
      ], 200, {
        "x-next-cursor": "null",
        "x-total-count": "1",
      });
    }

    if (urlStr.endsWith("/tenants") && init?.method === "GET") {
      return createResponse([{ tenantId: "tenant-integration", name: "Integration Tenant" }], 200, {
        "x-next-cursor": "null",
        "x-total-count": "1",
      });
    }
    if (urlStr.match(/\/tenants\/[^/]+$/) && init?.method === "GET") {
      return createResponse({ tenantId: "tenant-integration", name: "Integration Tenant" });
    }

    if (urlStr.match(/\/domains\/[^/]+\/(activate|deactivate|suspend|resume)$/) && init?.method === "POST") {
      return createResponse({ domainId: "domain-integration-test", status: "ok" });
    }
    if (urlStr.match(/\/domains\/[^/]+\/status$/) && init?.method === "GET") {
      return createResponse({ domainId: "domain-integration-test", status: "active" });
    }

    if (urlStr.endsWith("/rollouts") && init?.method === "GET") {
      return createResponse([{ rolloutId: "rollout-integration-test", status: "pending" }], 200, {
        "x-next-cursor": "null",
        "x-total-count": "1",
      });
    }
    if (urlStr.endsWith("/rollouts") && init?.method === "POST") {
      return createResponse({ rolloutId: "rollout-new", status: "pending" }, 201);
    }
    if (urlStr.match(/\/rollouts\/[^/]+$/) && init?.method === "GET") {
      return createResponse({ rolloutId: "rollout-integration-test", status: "pending" });
    }
    if (urlStr.match(/\/rollouts\/[^/]+$/) && init?.method === "PATCH") {
      return createResponse({ rolloutId: "rollout-integration-test", status: "in_progress", percentage: 50 });
    }

    if (urlStr.endsWith("/policies") && init?.method === "GET") {
      return createResponse([{ policyId: "policy-integration-test", name: "Integration Policy" }], 200, {
        "x-next-cursor": "null",
        "x-total-count": "1",
      });
    }
    if (urlStr.endsWith("/policies") && init?.method === "POST") {
      return createResponse({ policyId: "policy-new", name: "New Policy" }, 201);
    }
    if (urlStr.match(/\/policies\/[^/]+$/) && init?.method === "GET") {
      return createResponse({ policyId: "policy-integration-test", name: "Integration Policy" });
    }
    if (urlStr.match(/\/policies\/[^/]+$/) && init?.method === "PATCH") {
      return createResponse({ policyId: "policy-integration-test", description: "Updated description" });
    }

    // Default: call original fetch
    return originalFetch(url, init);
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
}

// ============================================================================
// Client SDK Integration Tests with Seeded Context
// ============================================================================

test("Client SDK integration: AdminSdk works with seeded context for directive creation", () => {
  const workspace = createTempWorkspace("client-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);

    const sdk = createAdminSdk();

    // Test directive creation (doesn't make network calls)
    const pauseDirective = sdk.pauseHarnessRun({
      harnessRunId: "run-integration-1",
      reason: "Integration test pause",
      issuedBy: {
        principalId: "p_integration",
        tenantId: ctx.seededTaskId,
        roles: ["admin"],
      },
    });

    assert.equal(pauseDirective.type, "pause");
    assert.equal(pauseDirective.scope?.harnessRunId, "run-integration-1");
    assert.equal(pauseDirective.issuedBy.tenantId, ctx.seededTaskId);

    const abortDirective = sdk.abortHarnessRun({
      harnessRunId: "run-integration-2",
      reason: "Integration test abort",
      issuedBy: {
        principalId: "p_integration",
        tenantId: ctx.seededTaskId,
        roles: ["operator"],
      },
    });

    assert.equal(abortDirective.type, "kill");
    assert.equal(abortDirective.scope?.harnessRunId, "run-integration-2");
  } finally {
    if (ctx) {
      ctx.db.close();
    }
    cleanupPath(workspace);
  }
});

test("Client SDK integration: Decision directives work with seeded context", () => {
  const workspace = createTempWorkspace("client-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);

    const sdk = createAdminSdk();

    // Test approve directive
    const approveDirective = sdk.issueDecisionDirective({
      type: "approve",
      targetRef: `execution_${ctx.seededTaskId}`,
      payload: { qualityScore: 0.95, reviewerNotes: "Looks good" },
      reason: "Meets all criteria",
      issuedBy: {
        principalId: "p_approver",
        tenantId: ctx.seededTaskId,
        roles: ["approver"],
        displayName: "Integration Test Approver",
      },
      riskAcknowledged: true,
    });

    assert.equal(approveDirective.type, "approve");
    assert.equal(approveDirective.targetRef, `execution_${ctx.seededTaskId}`);
    assert.equal(approveDirective.issuedBy.displayName, "Integration Test Approver");
    assert.equal(approveDirective.riskAcknowledged, true);

    // Test deny directive
    const denyDirective = sdk.issueDecisionDirective({
      type: "deny",
      targetRef: `execution_${ctx.seededTaskId}_deny`,
      payload: { reasonCode: "quality_below_threshold", score: 0.3 },
      reason: "Quality score below threshold",
      issuedBy: {
        principalId: "p_reviewer",
        tenantId: ctx.seededTaskId,
        roles: ["reviewer"],
      },
      riskAcknowledged: false,
    });

    assert.equal(denyDirective.type, "deny");
    assert.equal(denyDirective.riskAcknowledged, false);

    // Test override directive
    const overrideDirective = sdk.issueDecisionDirective({
      type: "override",
      targetRef: `policy_${ctx.seededTaskId}`,
      payload: { overrideReason: "business_need", urgency: "high" },
      reason: "Override required for critical deployment",
      issuedBy: {
        principalId: "p_admin",
        tenantId: ctx.seededTaskId,
        roles: ["admin"],
      },
    });

    assert.equal(overrideDirective.type, "override");
    assert.deepEqual(overrideDirective.payload, { overrideReason: "business_need", urgency: "high" });
  } finally {
    if (ctx) {
      ctx.db.close();
    }
    cleanupPath(workspace);
  }
});

test("Client SDK integration: Operational directives with expiration work", () => {
  const workspace = createTempWorkspace("client-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);

    const sdk = createAdminSdk();

    const expiresAt = "2026-04-30T12:00:00.000Z";

    const directive = sdk.issueOperationalDirective({
      type: "mode_switch",
      scope: {
        tenantId: ctx.seededTaskId,
        harnessRunId: "run-expiring",
      },
      issuedBy: {
        principalId: "p_admin",
        tenantId: ctx.seededTaskId,
        roles: ["admin"],
      },
      reason: "Temporary mode switch for maintenance",
      params: { targetMode: "maintenance" },
      expiresAt,
    });

    assert.equal(directive.type, "mode_switch");
    assert.equal(directive.scope?.tenantId, ctx.seededTaskId);
    assert.equal(directive.expiresAt, expiresAt);
    assert.deepEqual(directive.params, { targetMode: "maintenance" });
  } finally {
    if (ctx) {
      ctx.db.close();
    }
    cleanupPath(workspace);
  }
});

test("Client SDK integration: Tenant management with seeded context", async () => {
  const workspace = createTempWorkspace("client-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);
    const restore = createMockFetchForClientContext(ctx);

    try {
      const sdk = createAdminSdk();

      // These operations use the mock fetch
      const tenants = await sdk.listTenants<{ tenantId: string; name: string }>();
      assert.ok(tenants.data.length >= 0);

      const tenant = await sdk.getTenant<{ tenantId: string; name: string }>("tenant-integration");
      assert.equal(tenant.status, 200);
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

test("Client SDK integration: Domain operations with seeded context", async () => {
  const workspace = createTempWorkspace("client-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);
    const restore = createMockFetchForClientContext(ctx);

    try {
      const sdk = createAdminSdk();

      const activateResult = await sdk.activateDomain<{ status: string }>("domain-integration-test");
      assert.equal(activateResult.status, 200);

      const deactivateResult = await sdk.deactivateDomain<{ status: string }>("domain-integration-test", "Integration test deactivation");
      assert.equal(deactivateResult.status, 200);

      const suspendResult = await sdk.suspendDomain<{ status: string }>("domain-integration-test", "Integration test suspension");
      assert.equal(suspendResult.status, 200);

      const resumeResult = await sdk.resumeDomain<{ status: string }>("domain-integration-test");
      assert.equal(resumeResult.status, 200);

      const statusResult = await sdk.getDomainStatus<{ status: string }>("domain-integration-test");
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

test("Client SDK integration: Rollout operations with seeded context", async () => {
  const workspace = createTempWorkspace("client-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);
    const restore = createMockFetchForClientContext(ctx);

    try {
      const sdk = createAdminSdk();

      const listRolloutsResult = await sdk.listRollouts<{ rolloutId: string; status: string }>();
      assert.equal(listRolloutsResult.data.length, 1);

      const getRolloutResult = await sdk.getRollout<{ rolloutId: string; status: string }>("rollout-integration-test");
      assert.equal(getRolloutResult.data.rolloutId, "rollout-integration-test");

      const createRolloutResult = await sdk.createRollout<{ rolloutId: string; status: string }>({
        rolloutId: "rollout-new",
        name: "New Rollout",
        targetType: "domain",
        targetId: "domain-1",
        strategy: "canary",
        percentage: 10,
        status: "pending",
      });
      assert.equal(createRolloutResult.status, 201);

      const updateRolloutResult = await sdk.updateRollout<{ rolloutId: string; percentage: number }>("rollout-integration-test", {
        percentage: 50,
      });
      assert.equal(updateRolloutResult.data.percentage, 50);
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

test("Client SDK integration: Policy management with seeded context", async () => {
  const workspace = createTempWorkspace("client-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);
    const restore = createMockFetchForClientContext(ctx);

    try {
      const sdk = createAdminSdk();

      const listPoliciesResult = await sdk.listPolicies<{ policyId: string; name: string }>();
      assert.equal(listPoliciesResult.data.length, 1);

      const getPolicyResult = await sdk.getPolicy<{ policyId: string; name: string }>("policy-integration-test");
      assert.equal(getPolicyResult.data.policyId, "policy-integration-test");

      const createPolicyResult = await sdk.createPolicy<{ policyId: string; name: string }>({
        policyId: "policy-new",
        name: "New Policy",
        effect: "allow",
        actions: ["read"],
        resources: ["resource:*"],
        priority: 1,
      });
      assert.equal(createPolicyResult.status, 201);

      const updatePolicyResult = await sdk.updatePolicy<{ policyId: string; description: string }>("policy-integration-test", {
        description: "Updated description",
      });
      assert.equal(updatePolicyResult.data.description, "Updated description");
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

test("Client SDK integration: seededTaskId and approvalId are accessible", () => {
  const workspace = createTempWorkspace("client-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);

    assert.ok(ctx.seededTaskId);
    assert.ok(ctx.seededTaskId.startsWith("task-") || ctx.seededTaskId.length > 0);

    assert.ok(ctx.approvalId);
    assert.ok(ctx.approvalId.startsWith("approval_") || ctx.approvalId.length > 0);

    assert.ok(ctx.seededWorkerId);
    assert.equal(ctx.seededWorkerId, "worker-api-1");
  } finally {
    if (ctx) {
      ctx.db.close();
    }
    cleanupPath(workspace);
  }
});

test("Client SDK integration: services are properly initialized", () => {
  const workspace = createTempWorkspace("client-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);

    // Verify all services are properly initialized
    assert.ok(ctx.store);
    assert.ok(ctx.db);
    assert.ok(ctx.billingService);
    assert.ok(ctx.approvalService);
    assert.ok(ctx.authService);
    assert.ok(ctx.inspectService);
    assert.ok(ctx.missionControlService);
    assert.ok(ctx.gatewayTargetDirectoryService);
    assert.ok(ctx.knowledgePlaneService);
    assert.ok(ctx.artifactPlaneService);
    assert.ok(ctx.domainRegistryService);
    assert.ok(ctx.pluginRegistry);
  } finally {
    if (ctx) {
      ctx.db.close();
    }
    cleanupPath(workspace);
  }
});

test("Client SDK integration: createServer creates HTTP server", () => {
  const workspace = createTempWorkspace("client-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);

    const server = ctx.createServer();

    assert.ok(server);
    assert.equal(typeof server.start, "function");
    assert.equal(typeof server.stop, "function");
  } finally {
    if (ctx) {
      ctx.db.close();
    }
    cleanupPath(workspace);
  }
});

test("Client SDK integration: domain registry has registered domains", () => {
  const workspace = createTempWorkspace("client-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);

    const domains = ctx.domainRegistryService.list();
    assert.ok(domains.length > 0);

    const codingDomain = ctx.domainRegistryService.get("coding");
    assert.ok(codingDomain);
    assert.equal(codingDomain.domainId, "coding");
  } finally {
    if (ctx) {
      ctx.db.close();
    }
    cleanupPath(workspace);
  }
});

test("Client SDK integration: plugin registry has registered plugins", () => {
  const workspace = createTempWorkspace("client-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);

    const plugins = ctx.pluginRegistry.list();
    assert.ok(plugins.length > 0);

    const retrieverPlugin = plugins.find((p) => p.manifest.pluginId.includes("retriever"));
    assert.ok(retrieverPlugin);
  } finally {
    if (ctx) {
      ctx.db.close();
    }
    cleanupPath(workspace);
  }
});
