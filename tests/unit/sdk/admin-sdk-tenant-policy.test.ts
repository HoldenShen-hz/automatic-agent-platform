/**
 * @fileoverview Unit tests for Admin SDK - Tenant Management, Policy Management, Domain Lifecycle, and Rollout Control
 *
 * Tests the tenant management, policy management, domain lifecycle, and rollout control
 * operations in the Admin SDK (src/sdk/admin-sdk/index.ts)
 */

import assert from "node:assert/strict";
import test from "node:test";

import { AdminSdk } from "../../../src/sdk/admin-sdk/index.js";
import type { TenantInput, PolicyInput, RolloutInput } from "../../../src/sdk/admin-sdk/index.js";
import type { PrincipalRef } from "../../../src/platform/contracts/executable-contracts/index.js";

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================

const TEST_PRINCIPAL: PrincipalRef = { principalId: "p_test", tenantId: "t_test", roles: ["admin"] };

function createAdminSdk() {
  return new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });
}

function mockFetchForAdminSdk(responses: Array<{ url: string; data: unknown; status?: number }>) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: URL | RequestInfo, init?: RequestInit) => {
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
// Tenant Management Tests
// ============================================================================

test("AdminSdk.listTenants returns paginated response", async () => {
  const sdk = createAdminSdk();

  const restore = mockFetchForAdminSdk([
    { url: "/tenants", data: [{ tenantId: "t1", name: "Tenant 1" }, { tenantId: "t2", name: "Tenant 2" }] },
  ]);

  try {
    const result = await sdk.listTenants<{ tenantId: string; name: string }>();
    assert.deepEqual(result.data, [{ tenantId: "t1", name: "Tenant 1" }, { tenantId: "t2", name: "Tenant 2" }]);
    assert.equal(result.status, 200);
  } finally {
    restore();
  }
});

test("AdminSdk.getTenant returns tenant by ID", async () => {
  const sdk = createAdminSdk();

  const restore = mockFetchForAdminSdk([
    { url: "/tenants/tenant-abc", data: { tenantId: "tenant-abc", name: "Tenant ABC", status: "active" } },
  ]);

  try {
    const result = await sdk.getTenant<{ tenantId: string; name: string; status: string }>("tenant-abc");
    assert.equal(result.data.tenantId, "tenant-abc");
    assert.equal(result.data.name, "Tenant ABC");
    assert.equal(result.status, 200);
  } finally {
    restore();
  }
});

test("AdminSdk.createTenant sends POST request with tenant data", async () => {
  const sdk = createAdminSdk();

  const tenantInput: TenantInput = {
    tenantId: "new-tenant",
    name: "New Tenant",
    displayName: "New Tenant Display",
    status: "active",
    metadata: { region: "us-east" },
  };

  let capturedBody: unknown = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: URL | RequestInfo, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.toString() : String(url);
    if (urlStr.includes("/tenants")) {
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return new Response(JSON.stringify({ tenantId: "new-tenant", name: "New Tenant", status: "active" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(url, init);
  };

  try {
    const result = await sdk.createTenant<{ tenantId: string; name: string; status: string }>(tenantInput);
    assert.equal(result.data.tenantId, "new-tenant");
    assert.equal(result.status, 201);
    assert.ok(capturedBody);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.updateTenant sends PATCH request", async () => {
  const sdk = createAdminSdk();

  const restore = mockFetchForAdminSdk([
    { url: "/tenants/tenant-xyz", data: { tenantId: "tenant-xyz", name: "Updated Name" } },
  ]);

  try {
    const result = await sdk.updateTenant<{ tenantId: string; name: string }>("tenant-xyz", { name: "Updated Name" });
    assert.equal(result.data.name, "Updated Name");
  } finally {
    restore();
  }
});

test("AdminSdk.deleteTenant sends DELETE request", async () => {
  const sdk = createAdminSdk();

  const restore = mockFetchForAdminSdk([
    { url: "/tenants/tenant-delete", data: { deleted: true } },
  ]);

  try {
    const result = await sdk.deleteTenant<{ deleted: boolean }>("tenant-delete");
    assert.equal(result.data.deleted, true);
  } finally {
    restore();
  }
});

test("AdminSdk.suspendTenant sends POST with reason", async () => {
  const sdk = createAdminSdk();

  let capturedBody: unknown = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: URL | RequestInfo, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.toString() : String(url);
    if (urlStr.includes("/suspend")) {
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return new Response(JSON.stringify({ tenantId: "tenant-suspend", status: "suspended" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(url, init);
  };

  try {
    const result = await sdk.suspendTenant<{ tenantId: string; status: string }>("tenant-suspend", "Policy violation");
    assert.equal(result.data.status, "suspended");
    assert.deepEqual(capturedBody.payload, { reason: "Policy violation" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.resumeTenant sends POST to resume endpoint", async () => {
  const sdk = createAdminSdk();

  const restore = mockFetchForAdminSdk([
    { url: "/tenants/tenant-resume/resume", data: { tenantId: "tenant-resume", status: "active" } },
  ]);

  try {
    const result = await sdk.resumeTenant<{ tenantId: string; status: string }>("tenant-resume");
    assert.equal(result.data.status, "active");
  } finally {
    restore();
  }
});

// ============================================================================
// Policy Management Tests
// ============================================================================

test("AdminSdk.listPolicies returns paginated response", async () => {
  const sdk = createAdminSdk();

  const restore = mockFetchForAdminSdk([
    { url: "/policies", data: [{ policyId: "p1", name: "Policy 1" }, { policyId: "p2", name: "Policy 2" }] },
  ]);

  try {
    const result = await sdk.listPolicies<{ policyId: string; name: string }>();
    assert.deepEqual(result.data, [{ policyId: "p1", name: "Policy 1" }, { policyId: "p2", name: "Policy 2" }]);
  } finally {
    restore();
  }
});

test("AdminSdk.getPolicy returns policy by ID", async () => {
  const sdk = createAdminSdk();

  const restore = mockFetchForAdminSdk([
    { url: "/policies/policy-abc", data: { policyId: "policy-abc", name: "Policy ABC", effect: "allow" } },
  ]);

  try {
    const result = await sdk.getPolicy<{ policyId: string; name: string; effect: string }>("policy-abc");
    assert.equal(result.data.policyId, "policy-abc");
    assert.equal(result.data.effect, "allow");
  } finally {
    restore();
  }
});

test("AdminSdk.createPolicy sends POST with policy data", async () => {
  const sdk = createAdminSdk();

  const policyInput: PolicyInput = {
    policyId: "new-policy",
    name: "New Policy",
    description: "A test policy",
    effect: "allow",
    actions: ["read", "write"],
    resources: ["resource:*"],
    conditions: { ipRange: "10.0.0.0/8" },
    priority: 1,
  };

  let capturedBody: unknown = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: URL | RequestInfo, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.toString() : String(url);
    if (urlStr.includes("/policies")) {
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return new Response(JSON.stringify({ policyId: "new-policy", name: "New Policy" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(url, init);
  };

  try {
    const result = await sdk.createPolicy<{ policyId: string; name: string }>(policyInput);
    assert.equal(result.data.policyId, "new-policy");
    assert.equal(result.status, 201);
    assert.ok(capturedBody);
    assert.deepEqual((capturedBody as { payload: { actions: string[] } }).payload.actions, ["read", "write"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.updatePolicy sends PATCH request", async () => {
  const sdk = createAdminSdk();

  const restore = mockFetchForAdminSdk([
    { url: "/policies/policy-xyz", data: { policyId: "policy-xyz", name: "Updated Policy" } },
  ]);

  try {
    const result = await sdk.updatePolicy<{ policyId: string; name: string }>("policy-xyz", { name: "Updated Policy" });
    assert.equal(result.data.name, "Updated Policy");
  } finally {
    restore();
  }
});

test("AdminSdk.deletePolicy sends DELETE request", async () => {
  const sdk = createAdminSdk();

  const restore = mockFetchForAdminSdk([
    { url: "/policies/policy-delete", data: { deleted: true } },
  ]);

  try {
    const result = await sdk.deletePolicy<{ deleted: boolean }>("policy-delete");
    assert.equal(result.data.deleted, true);
  } finally {
    restore();
  }
});

test("AdminSdk.attachPolicy sends POST to attachments endpoint", async () => {
  const sdk = createAdminSdk();

  let capturedBody: unknown = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: URL | RequestInfo, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.toString() : String(url);
    if (urlStr.includes("/policies/attachments")) {
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return new Response(JSON.stringify({ attached: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(url, init);
  };

  try {
    const result = await sdk.attachPolicy<{ attached: boolean }>("tenant", "tenant-1", "policy-1");
    assert.equal(result.data.attached, true);
    assert.deepEqual(capturedBody.payload, { targetType: "tenant", targetId: "tenant-1", policyId: "policy-1" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.detachPolicy sends DELETE with query params", async () => {
  const sdk = createAdminSdk();

  const restore = mockFetchForAdminSdk([
    { url: "/policies/attachments?targetType=tenant&targetId=tenant-1&policyId=policy-1", data: { detached: true } },
  ]);

  try {
    const result = await sdk.detachPolicy<{ detached: boolean }>("tenant", "tenant-1", "policy-1");
    assert.equal(result.data.detached, true);
  } finally {
    restore();
  }
});

test("AdminSdk.listPolicyAttachments returns paginated attachments", async () => {
  const sdk = createAdminSdk();

  const restore = mockFetchForAdminSdk([
    { url: "/policies/policy-abc/attachments", data: [{ targetType: "tenant", targetId: "t1" }, { targetType: "user", targetId: "u1" }] },
  ]);

  try {
    const result = await sdk.listPolicyAttachments<{ targetType: string; targetId: string }>("policy-abc");
    assert.equal(result.data.length, 2);
    assert.equal(result.data[0].targetType, "tenant");
  } finally {
    restore();
  }
});

// ============================================================================
// Domain Lifecycle Tests
// ============================================================================

test("AdminSdk.activateDomain sends POST to activate endpoint", async () => {
  const sdk = createAdminSdk();

  let capturedBody: unknown = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: URL | RequestInfo, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.toString() : String(url);
    if (urlStr.includes("/lifecycle/activate")) {
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return new Response(JSON.stringify({ domainId: "domain-1", status: "active" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(url, init);
  };

  try {
    const result = await sdk.activateDomain<{ domainId: string; status: string }>("domain-1", "Ready to activate");
    assert.equal(result.data.status, "active");
    assert.deepEqual(capturedBody.payload, { reason: "Ready to activate" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.deactivateDomain sends POST to deactivate endpoint", async () => {
  const sdk = createAdminSdk();

  const restore = mockFetchForAdminSdk([
    { url: "/domains/domain-1/lifecycle/deactivate", data: { domainId: "domain-1", status: "inactive" } },
  ]);

  try {
    const result = await sdk.deactivateDomain<{ domainId: string; status: string }>("domain-1", "Maintenance");
    assert.equal(result.data.status, "inactive");
  } finally {
    restore();
  }
});

test("AdminSdk.suspendDomain sends POST with reason", async () => {
  const sdk = createAdminSdk();

  let capturedBody: unknown = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: URL | RequestInfo, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.toString() : String(url);
    if (urlStr.includes("/lifecycle/suspend")) {
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return new Response(JSON.stringify({ domainId: "domain-1", status: "suspended" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(url, init);
  };

  try {
    const result = await sdk.suspendDomain<{ domainId: string; status: string }>("domain-1", "Policy violation");
    assert.equal(result.data.status, "suspended");
    assert.deepEqual(capturedBody.payload, { reason: "Policy violation" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.resumeDomain sends POST to resume endpoint", async () => {
  const sdk = createAdminSdk();

  const restore = mockFetchForAdminSdk([
    { url: "/domains/domain-1/lifecycle/resume", data: { domainId: "domain-1", status: "active" } },
  ]);

  try {
    const result = await sdk.resumeDomain<{ domainId: string; status: string }>("domain-1");
    assert.equal(result.data.status, "active");
  } finally {
    restore();
  }
});

test("AdminSdk.getDomainStatus returns domain lifecycle status", async () => {
  const sdk = createAdminSdk();

  const restore = mockFetchForAdminSdk([
    { url: "/domains/domain-1/lifecycle/status", data: { domainId: "domain-1", status: "active", lastUpdated: "2026-04-29T00:00:00.000Z" } },
  ]);

  try {
    const result = await sdk.getDomainStatus<{ domainId: string; status: string; lastUpdated: string }>("domain-1");
    assert.equal(result.data.status, "active");
    assert.ok(result.data.lastUpdated);
  } finally {
    restore();
  }
});

// ============================================================================
// Rollout Control Tests
// ============================================================================

test("AdminSdk.listRollouts returns paginated response", async () => {
  const sdk = createAdminSdk();

  const restore = mockFetchForAdminSdk([
    { url: "/rollouts", data: [{ rolloutId: "r1", name: "Rollout 1" }, { rolloutId: "r2", name: "Rollout 2" }] },
  ]);

  try {
    const result = await sdk.listRollouts<{ rolloutId: string; name: string }>();
    assert.deepEqual(result.data, [{ rolloutId: "r1", name: "Rollout 1" }, { rolloutId: "r2", name: "Rollout 2" }]);
  } finally {
    restore();
  }
});

test("AdminSdk.getRollout returns rollout by ID", async () => {
  const sdk = createAdminSdk();

  const restore = mockFetchForAdminSdk([
    { url: "/rollouts/rollout-abc", data: { rolloutId: "rollout-abc", name: "Rollout ABC", status: "in_progress" } },
  ]);

  try {
    const result = await sdk.getRollout<{ rolloutId: string; name: string; status: string }>("rollout-abc");
    assert.equal(result.data.rolloutId, "rollout-abc");
    assert.equal(result.data.status, "in_progress");
  } finally {
    restore();
  }
});

test("AdminSdk.createRollout sends POST with rollout data", async () => {
  const sdk = createAdminSdk();

  const rolloutInput: RolloutInput = {
    rolloutId: "new-rollout",
    name: "New Rollout",
    targetType: "domain",
    targetId: "domain-1",
    strategy: "canary",
    percentage: 10,
    status: "pending",
  };

  let capturedBody: unknown = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: URL | RequestInfo, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.toString() : String(url);
    if (urlStr.includes("/rollouts")) {
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return new Response(JSON.stringify({ rolloutId: "new-rollout", name: "New Rollout", status: "pending" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(url, init);
  };

  try {
    const result = await sdk.createRollout<{ rolloutId: string; name: string; status: string }>(rolloutInput);
    assert.equal(result.data.rolloutId, "new-rollout");
    assert.equal(result.status, 201);
    assert.ok(capturedBody);
    assert.equal((capturedBody as { payload: { strategy: string } }).payload.strategy, "canary");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.updateRollout sends PATCH request", async () => {
  const sdk = createAdminSdk();

  const restore = mockFetchForAdminSdk([
    { url: "/rollouts/rollout-xyz", data: { rolloutId: "rollout-xyz", name: "Updated Rollout", percentage: 50 } },
  ]);

  try {
    const result = await sdk.updateRollout<{ rolloutId: string; name: string; percentage: number }>("rollout-xyz", { percentage: 50 });
    assert.equal(result.data.percentage, 50);
  } finally {
    restore();
  }
});

test("AdminSdk.pauseRollout sends POST to pause endpoint", async () => {
  const sdk = createAdminSdk();

  let capturedBody: unknown = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: URL | RequestInfo, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.toString() : String(url);
    if (urlStr.includes("/pause")) {
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return new Response(JSON.stringify({ rolloutId: "rollout-1", status: "paused" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(url, init);
  };

  try {
    const result = await sdk.pauseRollout<{ rolloutId: string; status: string }>("rollout-1", "Scheduled maintenance");
    assert.equal(result.data.status, "paused");
    assert.deepEqual(capturedBody.payload, { reason: "Scheduled maintenance" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.resumeRollout sends POST to resume endpoint", async () => {
  const sdk = createAdminSdk();

  const restore = mockFetchForAdminSdk([
    { url: "/rollouts/rollout-1/resume", data: { rolloutId: "rollout-1", status: "in_progress" } },
  ]);

  try {
    const result = await sdk.resumeRollout<{ rolloutId: string; status: string }>("rollout-1");
    assert.equal(result.data.status, "in_progress");
  } finally {
    restore();
  }
});

test("AdminSdk.cancelRollout sends POST to cancel endpoint", async () => {
  const sdk = createAdminSdk();

  let capturedBody: unknown = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: URL | RequestInfo, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.toString() : String(url);
    if (urlStr.includes("/cancel")) {
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return new Response(JSON.stringify({ rolloutId: "rollout-1", status: "cancelled" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(url, init);
  };

  try {
    const result = await sdk.cancelRollout<{ rolloutId: string; status: string }>("rollout-1", "User requested");
    assert.equal(result.data.status, "cancelled");
    assert.deepEqual(capturedBody.payload, { reason: "User requested" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.getRolloutStatus returns rollout status details", async () => {
  const sdk = createAdminSdk();

  const restore = mockFetchForAdminSdk([
    { url: "/rollouts/rollout-1/status", data: { rolloutId: "rollout-1", status: "in_progress", percentage: 45, strategy: "canary" } },
  ]);

  try {
    const result = await sdk.getRolloutStatus<{ rolloutId: string; status: string; percentage: number; strategy: string }>("rollout-1");
    assert.equal(result.data.status, "in_progress");
    assert.equal(result.data.percentage, 45);
    assert.equal(result.data.strategy, "canary");
  } finally {
    restore();
  }
});

test("AdminSdk.rollbackRollout sends POST to rollback endpoint", async () => {
  const sdk = createAdminSdk();

  const restore = mockFetchForAdminSdk([
    { url: "/rollouts/rollout-1/rollback", data: { rolloutId: "rollout-1", status: "rolled_back" } },
  ]);

  try {
    const result = await sdk.rollbackRollout<{ rolloutId: string; status: string }>("rollout-1");
    assert.equal(result.data.status, "rolled_back");
  } finally {
    restore();
  }
});

test("AdminSdk.advanceRolloutPercentage sends POST with target percentage", async () => {
  const sdk = createAdminSdk();

  let capturedBody: unknown = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: URL | RequestInfo, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.toString() : String(url);
    if (urlStr.includes("/advance")) {
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return new Response(JSON.stringify({ rolloutId: "rollout-1", percentage: 75 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(url, init);
  };

  try {
    const result = await sdk.advanceRolloutPercentage<{ rolloutId: string; percentage: number }>("rollout-1", 75);
    assert.equal(result.data.percentage, 75);
    assert.deepEqual(capturedBody.payload, { targetPercentage: 75 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// AdminSdk Constructor and Configuration Tests
// ============================================================================

test("AdminSdk constructor creates client with config", () => {
  const sdk = createAdminSdk();
  assert.ok(sdk);
});

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
  globalThis.fetch = async (url: URL | RequestInfo, init?: RequestInit) => {
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
    const result = await sdk.registerDomain<{ domainId: string; name: string }>({ name: "New Domain" });
    assert.equal(result.data.domainId, "new-domain");
    assert.equal(result.status, 201);
    assert.deepEqual(capturedBody.payload, { name: "New Domain" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
