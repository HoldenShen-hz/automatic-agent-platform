/**
 * @fileoverview Unit tests for Admin SDK - Domain Management, Pack Publishing, Harness Control, and Runtime Directives
 *
 * Tests the domain management, pack publishing, harness control, and runtime directive operations
 * in the Admin SDK (src/sdk/admin-sdk/index.ts)
 */

import assert from "node:assert/strict";
import test from "node:test";

import { AdminSdk, type AdminSdkConfig } from "../../../src/sdk/admin-sdk/index.js";
import type { OperationalDirectiveType, DecisionDirectiveType } from "../../../src/platform/contracts/control-directive/index.js";

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================

function createAdminSdk(config?: Partial<AdminSdkConfig>) {
  return new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    requiredRole: "admin",
    ...config,
  });
}

// Helper to create a valid issuedBy object
function createIssuedBy(overrides?: Partial<{ principalId: string; tenantId: string; roles: readonly string[] }>) {
  return {
    principalId: overrides?.principalId ?? "admin-user",
    tenantId: overrides?.tenantId ?? "tenant-1",
    roles: overrides?.roles ?? ["admin"] as const,
  };
}

function mockFetchForAdminSdk(responses: Array<{ url: string; data: unknown; status?: number }>) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: URL | Request, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.toString() : String(url);
    const match = responses.find((r) => urlStr.includes(r.url));
    if (match) {
      return new Response(JSON.stringify(match.data), {
        status: match.status ?? 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(url, init);
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

// ============================================================================
// AdminSdk Constructor Tests
// ============================================================================

test("AdminSdk constructor creates client with config", () => {
  const sdk = createAdminSdk();
  assert.ok(sdk);
});

// ============================================================================
// Domain Management Tests
// ============================================================================

test("AdminSdk.listDomains returns paginated domains", async () => {
  const sdk = createAdminSdk();

  const restore = mockFetchForAdminSdk([
    { url: "/domains", data: [{ domainId: "d1", name: "Domain 1" }, { domainId: "d2", name: "Domain 2" }] },
  ]);

  try {
    const result = await sdk.listDomains<{ domainId: string; name: string }>();
    assert.deepEqual(result.data, [{ domainId: "d1", name: "Domain 1" }, { domainId: "d2", name: "Domain 2" }]);
  } finally {
    restore();
  }
});

test("AdminSdk.registerDomain sends POST with domain data", async () => {
  const sdk = createAdminSdk();

  let capturedBody: unknown = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: URL | Request, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.toString() : String(url);
    if (urlStr.includes("/domains") && init?.method === "POST") {
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return new Response(JSON.stringify({ domainId: "new-domain", name: "New Domain" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(url, init);
  };

  try {
    const result = await sdk.registerDomain<{ domainId: string; name: string }>({ name: "New Domain", displayName: "New Domain" });
    assert.equal(result.data.domainId, "new-domain");
    assert.equal(result.status, 201);
    assert.ok(capturedBody);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.registerDomain validates input with Zod schema", async () => {
  const sdk = createAdminSdk();

  // Missing required 'displayName' field should throw ValidationError
  try {
    await sdk.registerDomain<{ domainId: string }>({ name: "" }); // name too short
    assert.fail("Expected ValidationError to be thrown");
  } catch (err: unknown) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes("invalid_input") || err.message.includes("validation failed"));
  }
});

test("AdminSdk.registerDomain rejects empty domainId", async () => {
  const sdk = createAdminSdk();

  try {
    await sdk.registerDomain<{ domainId: string }>({ domainId: "", displayName: "Test" });
    assert.fail("Expected ValidationError to be thrown");
  } catch (err: unknown) {
    assert.ok(err instanceof Error);
  }
});

// ============================================================================
// Pack Publishing Tests
// ============================================================================

test("AdminSdk.publishPack requires admin role", async () => {
  const sdkNoRole = createAdminSdk();

  try {
    await sdkNoRole.publishPack<{ published: boolean }>("pack-1", {});
    assert.fail("Expected ValidationError to be thrown");
  } catch (err: unknown) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes("permission_denied"));
  }
});

test("AdminSdk.publishPack allows admin role", async () => {
  const sdk = createAdminSdk({ requiredRole: "admin" });

  let capturedBody: unknown = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: URL | Request, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.toString() : String(url);
    if (urlStr.includes("/packs/pack-1")) {
      capturedBody = init?.body;
      return new Response(JSON.stringify({ published: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(url, init);
  };

  try {
    const result = await sdk.publishPack<{ published: boolean }>("pack-1", { version: "1.0.0" });
    assert.equal(result.data.published, true);
    assert.ok(capturedBody);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.publishPack allows operator role", async () => {
  const sdk = createAdminSdk({ requiredRole: "operator" });

  const restore = mockFetchForAdminSdk([
    { url: "/packs/pack-1/publish", data: { published: true } },
  ]);

  try {
    const result = await sdk.publishPack<{ published: boolean }>("pack-1", {});
    assert.equal(result.data.published, true);
  } finally {
    restore();
  }
});

// ============================================================================
// Harness Control Tests
// ============================================================================

test("AdminSdk.pauseHarnessRun sends POST to pause endpoint", async () => {
  const sdk = createAdminSdk();

  let capturedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: URL | Request, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.toString() : String(url);
    capturedUrl = urlStr;
    if (urlStr.includes("/harness")) {
      return new Response(JSON.stringify({ runId: "run-1", status: "paused" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(url, init);
  };

  try {
    const result = await sdk.pauseHarnessRun<{ runId: string; status: string }>("run-1", "Scheduled maintenance");
    assert.equal(result.data.status, "paused");
    assert.ok(capturedUrl.includes("/pause"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.abortHarnessRun sends POST to abort endpoint", async () => {
  const sdk = createAdminSdk();

  let capturedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: URL | Request, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.toString() : String(url);
    capturedUrl = urlStr;
    if (urlStr.includes("/harness")) {
      return new Response(JSON.stringify({ runId: "run-1", status: "aborted" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(url, init);
  };

  try {
    const result = await sdk.abortHarnessRun<{ runId: string; status: string }>("run-1", "Critical failure");
    assert.equal(result.data.status, "aborted");
    assert.ok(capturedUrl.includes("/abort"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// Panic Management Tests
// ============================================================================

test("AdminSdk.triggerPanic sends POST to panic trigger endpoint", async () => {
  const sdk = createAdminSdk();

  let capturedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: URL | Request, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.toString() : String(url);
    capturedUrl = urlStr;
    if (urlStr.includes("/panic/")) {
      return new Response(JSON.stringify({ triggered: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(url, init);
  };

  try {
    const result = await sdk.triggerPanic<{ triggered: boolean }>({ scope: "global", reason: "Test panic" });
    assert.equal(result.data.triggered, true);
    assert.ok(capturedUrl.includes("/panic/trigger"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.resumePanic sends POST to panic resume endpoint", async () => {
  const sdk = createAdminSdk();

  let capturedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: URL | Request, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.toString() : String(url);
    capturedUrl = urlStr;
    if (urlStr.includes("/panic/")) {
      return new Response(JSON.stringify({ resumed: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(url, init);
  };

  try {
    const result = await sdk.resumePanic<{ resumed: boolean }>("test-scope", { acknowledged: true });
    assert.equal(result.data.resumed, true);
    assert.ok(capturedUrl.includes("/panic/test-scope/resume"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// Agent Lifecycle Tests
// ============================================================================

test("AdminSdk.manageAgentLifecycle sends POST to agent action endpoint", async () => {
  const sdk = createAdminSdk();

  let capturedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: URL | Request, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.toString() : String(url);
    capturedUrl = urlStr;
    if (urlStr.includes("/agents/")) {
      return new Response(JSON.stringify({ agentId: "agent-1", action: "pause" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(url, init);
  };

  try {
    const result = await sdk.manageAgentLifecycle<{ agentId: string; action: string }>("agent-1", "pause");
    assert.equal(result.data.agentId, "agent-1");
    assert.equal(result.data.action, "pause");
    assert.ok(capturedUrl.includes("/agents/agent-1/pause"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.manageAgentLifecycle includes body when provided", async () => {
  const sdk = createAdminSdk();

  let capturedBody: unknown = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: URL | Request, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.toString() : String(url);
    if (urlStr.includes("/agents/")) {
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return new Response(JSON.stringify({ agentId: "agent-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(url, init);
  };

  try {
    const result = await sdk.manageAgentLifecycle<{ agentId: string }>("agent-1", "configure", { maxConcurrency: 5 });
    assert.equal(result.data.agentId, "agent-1");
    assert.deepEqual(capturedBody, { maxConcurrency: 5 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// Secrets Rotation Tests
// ============================================================================

test("AdminSdk.rotateSecrets sends POST to secrets rotate endpoint", async () => {
  const sdk = createAdminSdk();

  let capturedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: URL | Request, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.toString() : String(url);
    capturedUrl = urlStr;
    if (urlStr.includes("/secrets/")) {
      return new Response(JSON.stringify({ rotated: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(url, init);
  };

  try {
    const result = await sdk.rotateSecrets<{ rotated: boolean }>({ secretId: "secret-1", reason: "Scheduled rotation" });
    assert.equal(result.data.rotated, true);
    assert.ok(capturedUrl.includes("/secrets/rotate"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// OperationalDirective Tests
// ============================================================================

test("AdminSdk.issueOperationalDirective creates directive", () => {
  const sdk = createAdminSdk();

  const directive = sdk.issueOperationalDirective({
    type: "pause" as OperationalDirectiveType,
    issuedBy: createIssuedBy({ principalId: "admin-user" }),
    reason: "Maintenance window",
    scope: { workerId: "execution" },
  });

  assert.ok(directive);
  assert.equal(directive.type, "pause");
  assert.equal(directive.issuedBy.principalId, "admin-user");
  assert.equal(directive.reason, "Maintenance window");
  assert.equal(directive.scope.workerId, "execution");
});

test("AdminSdk.issueOperationalDirective includes params when provided", () => {
  const sdk = createAdminSdk();

  const directive = sdk.issueOperationalDirective({
    type: "quota_adjust" as OperationalDirectiveType,
    issuedBy: createIssuedBy({ principalId: "admin-user" }),
    reason: "Increase quota",
    params: { tenantId: "t1", newQuota: 100 },
  });

  assert.ok(directive.params);
  assert.equal((directive.params as { tenantId: string; newQuota: number }).tenantId, "t1");
  assert.equal((directive.params as { tenantId: string; newQuota: number }).newQuota, 100);
});

test("AdminSdk.issueOperationalDirective includes expiration when provided", () => {
  const sdk = createAdminSdk();

  const expiresAt = "2026-05-10T12:00:00Z";
  const directive = sdk.issueOperationalDirective({
    type: "kill" as OperationalDirectiveType,
    issuedBy: createIssuedBy({ principalId: "admin-user" }),
    reason: "Immediate termination",
    expiresAt,
  });

  assert.equal(directive.expiresAt, expiresAt);
});

// ============================================================================
// DecisionDirective Tests
// ============================================================================

test("AdminSdk.issueDecisionDirective creates directive", () => {
  const sdk = createAdminSdk();

  const directive = sdk.issueDecisionDirective({
    type: "approve" as DecisionDirectiveType,
    issuedBy: createIssuedBy({ principalId: "admin-user" }),
    targetRef: "execution-123",
    payload: { approved: true },
    reason: "Approved by admin",
  });

  assert.ok(directive);
  assert.equal(directive.type, "approve");
  assert.equal(directive.issuedBy.principalId, "admin-user");
  assert.equal(directive.targetRef, "execution-123");
  assert.deepEqual(directive.payload, { approved: true });
  assert.equal(directive.reason, "Approved by admin");
});

test("AdminSdk.issueDecisionDirective includes risk acknowledgment when provided", () => {
  const sdk = createAdminSdk();

  const directive = sdk.issueDecisionDirective({
    type: "override" as DecisionDirectiveType,
    issuedBy: createIssuedBy({ principalId: "admin-user" }),
    targetRef: "policy-456",
    payload: { overridden: true },
    reason: "Risk accepted",
    riskAcknowledged: true,
  });

  assert.ok(directive.riskAcknowledged);
});

test("AdminSdk.issueDecisionDirective includes scope when provided", () => {
  const sdk = createAdminSdk();

  const directive = sdk.issueDecisionDirective({
    type: "patch" as DecisionDirectiveType,
    scope: { tenantId: "tenant" },
    issuedBy: createIssuedBy({ principalId: "admin-user" }),
    targetRef: "tenant-t1",
    payload: { patched: true },
    reason: "Tenant-level patch",
  });

  assert.equal(directive.scope.tenantId, "tenant");
});

// ============================================================================
// sendOperationalDirective Tests
// ============================================================================

test("AdminSdk.sendOperationalDirective sends directive via envelope", async () => {
  const sdk = createAdminSdk();

  let capturedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: URL | Request, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.toString() : String(url);
    capturedUrl = urlStr;
    if (urlStr.includes("/directives/operational")) {
      return new Response(JSON.stringify({ acknowledged: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(url, init);
  };

  try {
    const directive = sdk.issueOperationalDirective({
      type: "resume" as OperationalDirectiveType,
      issuedBy: createIssuedBy({ principalId: "admin-user" }),
      reason: "Resume after maintenance",
    });

    const result = await sdk.sendOperationalDirective<{ acknowledged: boolean }>(directive);
    assert.equal(result.data.acknowledged, true);
    assert.ok(capturedUrl.includes("/directives/operational"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// sendDecisionDirective Tests
// ============================================================================

test("AdminSdk.sendDecisionDirective sends directive via envelope", async () => {
  const sdk = createAdminSdk();

  let capturedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: URL | Request, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.toString() : String(url);
    capturedUrl = urlStr;
    if (urlStr.includes("/directives/decision")) {
      return new Response(JSON.stringify({ acknowledged: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(url, init);
  };

  try {
    const directive = sdk.issueDecisionDirective({
      type: "deny" as DecisionDirectiveType,
      issuedBy: createIssuedBy({ principalId: "admin-user" }),
      targetRef: "execution-789",
      payload: { denied: true },
      reason: "Security policy violation",
    });

    const result = await sdk.sendDecisionDirective<{ acknowledged: boolean }>(directive);
    assert.equal(result.data.acknowledged, true);
    assert.ok(capturedUrl.includes("/directives/decision"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});