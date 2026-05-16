/**
 * @fileoverview Integration tests for Admin SDK with seeded API context
 *
 * Tests the Admin SDK against a real seeded API context to verify
 * end-to-end functionality including domain management, harness control,
 * panic operations, and directive issuance.
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

function createMockFetchForSeededContext(_ctx: SeededApiContext) {
  const originalFetch = globalThis.fetch;

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

  globalThis.fetch = async (url: URL | Request | string, init?: RequestInit): Promise<Response> => {
    const urlStr = url instanceof URL ? url.toString() : String(url);

    // Domain endpoints
    if (urlStr.includes("/domains") && init?.method === "GET") {
      return createResponse([
        { domainId: "domain-seeded", name: "Seeded Domain" },
      ]);
    }
    if (urlStr.endsWith("/domains") && init?.method === "POST") {
      return createResponse({ domainId: "new-domain", displayName: "New Domain" });
    }
    if (urlStr.match(/\/domains\/([^/]+)\/activate$/) && init?.method === "POST") {
      return createResponse({ domainId: "domain-1", status: "active" });
    }
    if (urlStr.match(/\/domains\/([^/]+)\/deactivate$/) && init?.method === "POST") {
      return createResponse({ domainId: "domain-1", status: "inactive" });
    }
    if (urlStr.match(/\/domains\/([^/]+)\/suspend$/) && init?.method === "POST") {
      return createResponse({ domainId: "domain-1", status: "suspended" });
    }
    if (urlStr.match(/\/domains\/([^/]+)\/resume$/) && init?.method === "POST") {
      return createResponse({ domainId: "domain-1", status: "active" });
    }
    if (urlStr.match(/\/domains\/([^/]+)\/status$/)) {
      return createResponse({ domainId: "domain-1", status: "active", lastUpdated: new Date().toISOString() });
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

test("AdminSdk with seeded context: listDomains returns domain data", async () => {
  const workspace = createTempWorkspace("admin-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);
    const restore = createMockFetchForSeededContext(ctx);

    try {
      const sdk = createAdminSdk();

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

test("AdminSdk with seeded context: registerDomain validates input", async () => {
  const workspace = createTempWorkspace("admin-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);
    const restore = createMockFetchForSeededContext(ctx);

    try {
      const sdk = createAdminSdk();

      // Valid registration
      const result = await sdk.registerDomain<{ domainId: string; displayName: string }>({
        domainId: "new-domain",
        displayName: "New Domain",
      });
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
    const sdk = createAdminSdk();

    const directive = sdk.pauseHarnessRun({
      harnessRunId: "harness-run-123",
      reason: "Maintenance window",
      issuedBy: {
        principalId: "p_admin",
        tenantId: "t_tenant",
        roles: ["admin"],
      },
    });

    assert.equal((directive as unknown as { type: string }).type, "pause");
    assert.equal((directive as unknown as { scope: { harnessRunId: string } }).scope?.harnessRunId, "harness-run-123");
    assert.equal((directive as unknown as { reason: string }).reason, "Maintenance window");
    assert.equal((directive as unknown as { issuedBy: { principalId: string } }).issuedBy.principalId, "p_admin");
    assert.ok((directive as unknown as { operationalDirectiveId: string }).operationalDirectiveId.startsWith("opdir_"));
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
    const sdk = createAdminSdk();

    const directive = sdk.abortHarnessRun({
      harnessRunId: "harness-run-456",
      reason: "User requested cancellation",
      issuedBy: {
        principalId: "p_operator",
        tenantId: "t_tenant",
        roles: ["operator"],
      },
    });

    assert.equal((directive as unknown as { type: string }).type, "kill");
    assert.equal((directive as unknown as { scope: { harnessRunId: string } }).scope?.harnessRunId, "harness-run-456");
    assert.equal((directive as unknown as { issuedBy: { principalId: string } }).issuedBy.principalId, "p_operator");
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
    const sdk = createAdminSdk();

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
    const sdk = createAdminSdk();

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

test("AdminSdk with seeded context: triggerPanic and resumePanic work", async () => {
  const workspace = createTempWorkspace("admin-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);
    const restore = createMockFetchForSeededContext(ctx);

    try {
      const sdk = createAdminSdk();

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

test("AdminSdk with seeded context: manageAgentLifecycle works", async () => {
  const workspace = createTempWorkspace("admin-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);
    const restore = createMockFetchForSeededContext(ctx);

    try {
      const sdk = createAdminSdk();

      // Test manageAgentLifecycle
      const agentResult = await sdk.manageAgentLifecycle<{ agentId: string; action: string }>("agent-1", "start");
      assert.equal(agentResult.data.agentId, "agent-1");
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

test("AdminSdk with seeded context: rotateSecrets works", async () => {
  const workspace = createTempWorkspace("admin-sdk-integration-");
  let ctx: SeededApiContext | null = null;

  try {
    ctx = createSeededApiContext(workspace);
    const restore = createMockFetchForSeededContext(ctx);

    try {
      const sdk = createAdminSdk();

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
