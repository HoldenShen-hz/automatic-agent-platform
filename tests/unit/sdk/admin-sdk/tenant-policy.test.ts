/**
 * @fileoverview Unit tests for Admin SDK - Issue #2012: Missing tenant management
 * Tests for tenant management, config operations, and audit access
 */

import assert from "node:assert/strict";
import test from "node:test";

import { AdminSdk } from "../../../../src/sdk/admin-sdk/index.js";

const TEST_PRINCIPAL = { principalId: "p_admin", tenantId: "t_tenant", roles: ["admin"] };

test("AdminSdk.listTenants returns paginated tenants", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([
      { tenantId: "tenant-1", name: "Tenant One" },
      { tenantId: "tenant-2", name: "Tenant Two" },
    ]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.listTenants<{ tenantId: string; name: string }>();
    assert.equal(result.data.length, 2);
    assert.equal(result.data[0]?.tenantId, "tenant-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.getTenant returns single tenant", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ tenantId: "tenant-1", name: "Tenant One" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.getTenant<{ tenantId: string; name: string }>("tenant-1");
    assert.equal(result.data.tenantId, "tenant-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.createTenant creates new tenant", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ tenantId: "tenant-new", name: "New Tenant" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.createTenant<{ tenantId: string; name: string }>({
      tenantId: "tenant-new",
      name: "New Tenant",
      status: "active",
    });
    assert.equal(result.data.tenantId, "tenant-new");
    assert.equal(result.status, 201);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.updateTenant updates tenant", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ tenantId: "tenant-1", name: "Updated Name" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.updateTenant<{ tenantId: string; name: string }>("tenant-1", {
      name: "Updated Name",
    });
    assert.equal(result.data.name, "Updated Name");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.deleteTenant deletes tenant", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ deleted: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.deleteTenant<{ deleted: boolean }>("tenant-1");
    assert.equal(result.data.deleted, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.suspendTenant suspends tenant", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ tenantId: "tenant-1", status: "suspended" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.suspendTenant<{ tenantId: string; status: string }>("tenant-1", "Policy violation");
    assert.equal(result.data.status, "suspended");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.resumeTenant resumes tenant", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ tenantId: "tenant-1", status: "active" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.resumeTenant<{ tenantId: string; status: string }>("tenant-1");
    assert.equal(result.data.status, "active");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.listPolicies returns paginated policies", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([
      { policyId: "policy-1", name: "Policy One" },
    ]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.listPolicies<{ policyId: string; name: string }>();
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0]?.policyId, "policy-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.getPolicy returns single policy", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ policyId: "policy-1", name: "Policy One" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.getPolicy<{ policyId: string; name: string }>("policy-1");
    assert.equal(result.data.policyId, "policy-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.createPolicy creates new policy", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ policyId: "policy-new", name: "New Policy" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.createPolicy<{ policyId: string; name: string }>({
      policyId: "policy-new",
      name: "New Policy",
      effect: "allow",
      actions: ["read", "write"],
      resources: ["resource:*"],
      priority: 1,
    });
    assert.equal(result.data.policyId, "policy-new");
    assert.equal(result.status, 201);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.updatePolicy updates policy", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ policyId: "policy-1", name: "Updated Policy" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.updatePolicy<{ policyId: string; name: string }>("policy-1", {
      name: "Updated Policy",
    });
    assert.equal(result.data.name, "Updated Policy");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.deletePolicy deletes policy", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ deleted: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.deletePolicy<{ deleted: boolean }>("policy-1");
    assert.equal(result.data.deleted, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.attachPolicy attaches policy to target", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ attached: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.attachPolicy<{ attached: boolean }>("tenant", "tenant-1", "policy-1");
    assert.equal(result.data.attached, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.detachPolicy detaches policy from target", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ detached: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.detachPolicy<{ detached: boolean }>("tenant", "tenant-1", "policy-1");
    assert.equal(result.data.detached, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.listPolicyAttachments lists policy attachments", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([
      { targetType: "tenant", targetId: "tenant-1", policyId: "policy-1" },
    ]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.listPolicyAttachments<{ targetType: string; targetId: string; policyId: string }>("policy-1");
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0]?.targetType, "tenant");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.activateDomain activates domain", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ domainId: "domain-1", status: "active" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.activateDomain<{ domainId: string; status: string }>("domain-1", "Enabling domain");
    assert.equal(result.data.status, "active");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.deactivateDomain deactivates domain", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ domainId: "domain-1", status: "inactive" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.deactivateDomain<{ domainId: string; status: string }>("domain-1", "Disabling domain");
    assert.equal(result.data.status, "inactive");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.suspendDomain suspends domain", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ domainId: "domain-1", status: "suspended" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.suspendDomain<{ domainId: string; status: string }>("domain-1", "Policy violation");
    assert.equal(result.data.status, "suspended");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.resumeDomain resumes domain", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ domainId: "domain-1", status: "active" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.resumeDomain<{ domainId: string; status: string }>("domain-1");
    assert.equal(result.data.status, "active");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.getDomainStatus returns domain status", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ domainId: "domain-1", status: "active" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.getDomainStatus<{ domainId: string; status: string }>("domain-1");
    assert.equal(result.data.domainId, "domain-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.listRollouts returns paginated rollouts", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([
      { rolloutId: "rollout-1", name: "Rollout One" },
    ]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.listRollouts<{ rolloutId: string; name: string }>();
    assert.equal(result.data.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.getRollout returns single rollout", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ rolloutId: "rollout-1", name: "Rollout One" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.getRollout<{ rolloutId: string; name: string }>("rollout-1");
    assert.equal(result.data.rolloutId, "rollout-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.createRollout creates new rollout", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ rolloutId: "rollout-new", name: "New Rollout" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.createRollout<{ rolloutId: string; name: string }>({
      rolloutId: "rollout-new",
      name: "New Rollout",
      targetType: "domain",
      targetId: "domain-1",
      strategy: "canary",
      percentage: 10,
      status: "pending",
    });
    assert.equal(result.status, 201);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.updateRollout updates rollout", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ rolloutId: "rollout-1", percentage: 50 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.updateRollout<{ rolloutId: string; percentage: number }>("rollout-1", {
      percentage: 50,
    });
    assert.equal(result.data.percentage, 50);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.pauseRollout pauses rollout", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ rolloutId: "rollout-1", status: "paused" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.pauseRollout<{ rolloutId: string; status: string }>("rollout-1", "Manual pause");
    assert.equal(result.data.status, "paused");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.resumeRollout resumes rollout", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ rolloutId: "rollout-1", status: "in_progress" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.resumeRollout<{ rolloutId: string; status: string }>("rollout-1");
    assert.equal(result.data.status, "in_progress");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.cancelRollout cancels rollout", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ rolloutId: "rollout-1", status: "cancelled" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.cancelRollout<{ rolloutId: string; status: string }>("rollout-1", "User cancelled");
    assert.equal(result.data.status, "cancelled");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.getRolloutStatus returns rollout status", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ rolloutId: "rollout-1", percentage: 75 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.getRolloutStatus<{ rolloutId: string; percentage: number }>("rollout-1");
    assert.equal(result.data.percentage, 75);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.rollbackRollout rolls back rollout", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ rolloutId: "rollout-1", status: "rolled_back" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.rollbackRollout<{ rolloutId: string; status: string }>("rollout-1");
    assert.equal(result.data.status, "rolled_back");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.advanceRolloutPercentage advances rollout percentage", async () => {
  const sdk = new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ rolloutId: "rollout-1", percentage: 50 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.advanceRolloutPercentage<{ rolloutId: string; percentage: number }>("rollout-1", 50);
    assert.equal(result.data.percentage, 50);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
