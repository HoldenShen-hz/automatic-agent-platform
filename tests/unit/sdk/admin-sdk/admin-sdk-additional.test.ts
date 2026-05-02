/**
 * @fileoverview Unit tests for Admin SDK - Additional Coverage
 *
 * Tests for audit log access, bulk operations, and miscellaneous methods.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { AdminSdk } from "../../../../src/sdk/admin-sdk/index.js";

// Mock principal for testing
const mockPrincipal = {
  principalId: "admin_123",
  tenantId: "tenant_abc",
  roles: ["admin"],
};

function createTestSdk(): AdminSdk {
  return new AdminSdk({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
  });
}

// ============================================================================
// Audit Log Access Tests
// ============================================================================

test("AdminSdk.listAuditLogs sends correct query parameters", async () => {
  const sdk = createTestSdk();

  let capturedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    capturedUrl = url as string;
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await sdk.listAuditLogs("tenant_abc", {
      limit: 50,
      cursor: "next-cursor",
      principalId: "user_456",
      action: "create_task",
      fromTimestamp: "2026-04-01T00:00:00.000Z",
      toTimestamp: "2026-04-30T23:59:59.999Z",
    });

    assert.ok(capturedUrl.includes("tenantId=tenant_abc"));
    assert.ok(capturedUrl.includes("limit=50"));
    assert.ok(capturedUrl.includes("cursor=next-cursor"));
    assert.ok(capturedUrl.includes("principalId=user_456"));
    assert.ok(capturedUrl.includes("action=create_task"));
    assert.ok(capturedUrl.includes("fromTimestamp=2026-04-01"));
    assert.ok(capturedUrl.includes("toTimestamp=2026-04-30"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.listAuditLogs works without options", async () => {
  const sdk = createTestSdk();

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.listAuditLogs("tenant_abc");
    assert.ok(result);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.getAuditEntry fetches specific audit entry", async () => {
  const sdk = createTestSdk();

  let capturedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    capturedUrl = url as string;
    return new Response(
      JSON.stringify({
        entryId: "audit_123",
        action: "task.created",
        timestamp: "2026-04-15T10:30:00.000Z",
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  try {
    const result = await sdk.getAuditEntry<{
      entryId: string;
      action: string;
      timestamp: string;
    }>("audit_123");
    assert.equal(result.data.entryId, "audit_123");
    assert.ok(capturedUrl.includes("/audit/logs/audit_123"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// Bulk Operations Tests
// ============================================================================

test("AdminSdk.bulkCreateTenants sends array of tenants", async () => {
  const sdk = createTestSdk();

  let capturedBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options?.body as string);
    return new Response(
      JSON.stringify({
        successes: [{ tenantId: "tenant_1" }, { tenantId: "tenant_2" }],
        failures: [],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  try {
    const result = await sdk.bulkCreateTenants<{ tenantId: string }>([
      { tenantId: "tenant_1", name: "Tenant One", status: "active" },
      { tenantId: "tenant_2", name: "Tenant Two", status: "active" },
    ]);

    assert.deepEqual(capturedBody.tenants.length, 2);
    assert.equal(result.successes.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.bulkUpdateTenants sends array of updates", async () => {
  const sdk = createTestSdk();

  let capturedBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options?.body as string);
    return new Response(
      JSON.stringify({
        successes: [{ tenantId: "tenant_1" }],
        failures: [],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  try {
    const result = await sdk.bulkUpdateTenants<{ tenantId: string }>([
      { tenantId: "tenant_1", patch: { name: "Updated Name" } },
    ]);

    assert.deepEqual(capturedBody.updates.length, 1);
    assert.equal(result.successes.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.bulkDeleteTenants sends tenant IDs", async () => {
  const sdk = createTestSdk();

  let capturedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    capturedUrl = url as string;
    return new Response(
      JSON.stringify({
        successes: [{ tenantId: "tenant_1" }],
        failures: [],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  try {
    const result = await sdk.bulkDeleteTenants<{ tenantId: string }>([
      "tenant_1",
      "tenant_2",
    ]);

    assert.ok(capturedUrl.includes("tenant_1"));
    assert.ok(capturedUrl.includes("tenant_2"));
    assert.equal(result.successes.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.bulkCreatePolicies sends array of policies", async () => {
  const sdk = createTestSdk();

  let capturedBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options?.body as string);
    return new Response(
      JSON.stringify({
        successes: [{ policyId: "policy_1" }],
        failures: [],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  try {
    const result = await sdk.bulkCreatePolicies<{ policyId: string }>([
      {
        policyId: "policy_1",
        name: "Policy One",
        effect: "allow",
        actions: ["read"],
        resources: ["resource:*"],
        priority: 1,
      },
    ]);

    assert.deepEqual(capturedBody.policies.length, 1);
    assert.equal(result.successes.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.bulkAttachPolicies sends array of attachments", async () => {
  const sdk = createTestSdk();

  let capturedBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options?.body as string);
    return new Response(
      JSON.stringify({
        successes: [{ attached: true }],
        failures: [],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  try {
    const result = await sdk.bulkAttachPolicies<{ attached: boolean }>([
      { targetType: "tenant", targetId: "tenant_1", policyId: "policy_1" },
      { targetType: "domain", targetId: "domain_1", policyId: "policy_2" },
    ]);

    assert.deepEqual(capturedBody.attachments.length, 2);
    assert.equal(result.successes.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.bulkDomainLifecycle sends array of operations", async () => {
  const sdk = createTestSdk();

  let capturedBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options?.body as string);
    return new Response(
      JSON.stringify({
        successes: [{ domainId: "domain_1" }],
        failures: [],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  try {
    const result = await sdk.bulkDomainLifecycle<{ domainId: string }>([
      { domainId: "domain_1", action: "activate" },
      { domainId: "domain_2", action: "suspend", reason: "Maintenance" },
    ]);

    assert.deepEqual(capturedBody.operations.length, 2);
    assert.equal(result.successes.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// Additional Methods Tests
// ============================================================================

test("AdminSdk.listWorkers returns workers list", async () => {
  const sdk = createTestSdk();

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([{ workerId: "worker_1" }, { workerId: "worker_2" }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.listWorkers();
    assert.equal(result.data.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.listWorkers with tenantId filter", async () => {
  const sdk = createTestSdk();

  let capturedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    capturedUrl = url as string;
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await sdk.listWorkers("tenant_xyz");
    assert.ok(capturedUrl.includes("tenantId=tenant_xyz"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.getConfig returns configuration", async () => {
  const sdk = createTestSdk();

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ maxTasks: 100, timeout: 30 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.getConfig();
    assert.equal(result.data.maxTasks, 100);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.getConfig with path parameter", async () => {
  const sdk = createTestSdk();

  let capturedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    capturedUrl = url as string;
    return new Response(JSON.stringify({ key: "value" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await sdk.getConfig("database/connection");
    assert.ok(capturedUrl.includes("/config/database/connection"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.listDomains returns paginated domains", async () => {
  const sdk = createTestSdk();

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([{ domainId: "domain_1" }, { domainId: "domain_2" }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.listDomains<{ domainId: string }>();
    assert.equal(result.data.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.registerDomain creates new domain", async () => {
  const sdk = createTestSdk();

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ domainId: "new_domain" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.registerDomain<{ domainId: string }>({
      domainId: "new_domain",
      name: "New Domain",
    });
    assert.equal(result.data.domainId, "new_domain");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.publishPack publishes a pack", async () => {
  const sdk = createTestSdk();

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ packId: "pack_123", status: "published" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.publishPack<{ packId: string; status: string }>("pack_123", {
      version: "1.0.0",
    });
    assert.equal(result.data.status, "published");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.triggerPanic triggers panic mode", async () => {
  const sdk = createTestSdk();

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ triggered: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.triggerPanic<{ triggered: boolean }>({
      reason: "Critical failure detected",
    });
    assert.equal(result.data.triggered, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.resumePanic resumes from panic", async () => {
  const sdk = createTestSdk();

  let capturedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    capturedUrl = url as string;
    return new Response(JSON.stringify({ resumed: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await sdk.resumePanic<{ resumed: boolean }>("global", {
      initiatedBy: "admin",
    });
    assert.ok(capturedUrl.includes("/panic/global/resume"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.manageAgentLifecycle performs agent action", async () => {
  const sdk = createTestSdk();

  let capturedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    capturedUrl = url as string;
    return new Response(JSON.stringify({ agentId: "agent_123", status: "paused" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await sdk.manageAgentLifecycle<{
      agentId: string;
      status: string;
    }>("agent_123", "pause", { reason: "Maintenance" });
    assert.ok(capturedUrl.includes("/agents/agent_123/pause"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.rotateSecrets rotates secrets", async () => {
  const sdk = createTestSdk();

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ rotated: true, timestamp: "2026-05-01T00:00:00.000Z" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await sdk.rotateSecrets<{ rotated: boolean; timestamp: string }>({
      secretIds: ["secret_1", "secret_2"],
    });
    assert.equal(result.data.rotated, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.resumeHarnessRun creates resume directive", () => {
  const sdk = createTestSdk();

  const directive = sdk.resumeHarnessRun("harness_run_789", {
    principalId: "p_admin",
    tenantId: "t_tenant",
    roles: ["admin"],
  });

  assert.equal(directive.type, "resume");
  assert.equal(directive.scope?.harnessRunId, "harness_run_789");
  assert.equal(directive.issuedBy.principalId, "p_admin");
});

// ============================================================================
// Direct OperationalDirective Tests
// ============================================================================

test("AdminSdk.issueOperationalDirective creates quota_adjust directive", () => {
  const sdk = createTestSdk();

  const directive = sdk.issueOperationalDirective({
    type: "quota_adjust",
    scope: { tenantId: "t_tenant" },
    issuedBy: {
      principalId: "p_admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
    reason: "Quota adjustment for production",
    params: { maxConcurrentTasks: 500 },
    expiresAt: "2026-06-01T00:00:00.000Z",
  });

  assert.equal(directive.type, "quota_adjust");
  assert.deepEqual(directive.params, { maxConcurrentTasks: 500 });
  assert.equal(directive.expiresAt, "2026-06-01T00:00:00.000Z");
});

test("AdminSdk.issueOperationalDirective handles scope with multiple fields", () => {
  const sdk = createTestSdk();

  const directive = sdk.issueOperationalDirective({
    type: "resource_release",
    scope: {
      tenantId: "t_tenant",
      harnessRunId: "harness_123",
      nodeRunId: "node_456",
      workerId: "worker_789",
    },
    issuedBy: {
      principalId: "p_admin",
      tenantId: "t_tenant",
      roles: ["admin"],
    },
    reason: "Release resources for terminated run",
  });

  assert.equal(directive.scope?.tenantId, "t_tenant");
  assert.equal(directive.scope?.harnessRunId, "harness_123");
  assert.equal(directive.scope?.nodeRunId, "node_456");
  assert.equal(directive.scope?.workerId, "worker_789");
});

test("AdminSdk.issueDecisionDirective creates escalate decision directive", () => {
  const sdk = createTestSdk();

  const directive = sdk.issueDecisionDirective({
    type: "escalate",
    targetRef: "execution_escalation_123",
    payload: { priority: "high", reason: "SLA breach imminent" },
    reason: "Escalate to senior reviewer",
    issuedBy: {
      principalId: "p_reviewer",
      tenantId: "t_tenant",
      roles: ["reviewer"],
    },
    riskAcknowledged: true,
  });

  assert.equal(directive.type, "escalate");
  assert.equal(directive.targetRef, "execution_escalation_123");
  assert.deepEqual(directive.payload, { priority: "high", reason: "SLA breach imminent" });
  assert.equal(directive.riskAcknowledged, true);
});

// ============================================================================
// Helper Methods Tests
// ============================================================================

test("AdminSdk.listDomains works with type parameter", async () => {
  const sdk = createTestSdk();

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify([
        { domainId: "domain_1", name: "Domain 1", status: "active" },
      ]),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );

  try {
    const result = await sdk.listDomains<{ domainId: string; name: string; status: string }>();
    assert.equal(result.data[0]?.domainId, "domain_1");
    assert.equal(result.data[0]?.status, "active");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.createTenant includes all input fields", async () => {
  const sdk = createTestSdk();

  let capturedBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options?.body as string);
    return new Response(JSON.stringify({ tenantId: "new_tenant" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await sdk.createTenant<{ tenantId: string }>({
      tenantId: "new_tenant",
      name: "New Tenant Name",
      displayName: "New Tenant Display",
      status: "active",
      metadata: { region: "us-east-1" },
    });

    assert.equal(capturedBody.tenantId, "new_tenant");
    assert.equal(capturedBody.name, "New Tenant Name");
    assert.equal(capturedBody.displayName, "New Tenant Display");
    assert.equal(capturedBody.status, "active");
    assert.deepEqual(capturedBody.metadata, { region: "us-east-1" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.updateTenant sends partial update", async () => {
  const sdk = createTestSdk();

  let capturedBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options?.body as string);
    return new Response(JSON.stringify({ tenantId: "tenant_1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await sdk.updateTenant<{ tenantId: string }>("tenant_1", {
      name: "Updated Name",
      status: "suspended",
    });

    assert.equal(capturedBody.name, "Updated Name");
    assert.equal(capturedBody.status, "suspended");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.suspendTenant includes reason in body", async () => {
  const sdk = createTestSdk();

  let capturedBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options?.body as string);
    return new Response(JSON.stringify({ tenantId: "tenant_1", status: "suspended" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await sdk.suspendTenant<{ tenantId: string; status: string }>("tenant_1", "Policy violation #123");
    assert.equal(capturedBody.reason, "Policy violation #123");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.resumeTenant sends empty body", async () => {
  const sdk = createTestSdk();

  let capturedBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options?.body as string);
    return new Response(JSON.stringify({ tenantId: "tenant_1", status: "active" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await sdk.resumeTenant<{ tenantId: string; status: string }>("tenant_1");
    assert.deepEqual(capturedBody, {});
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.createPolicy includes all policy fields", async () => {
  const sdk = createTestSdk();

  let capturedBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options?.body as string);
    return new Response(JSON.stringify({ policyId: "new_policy" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await sdk.createPolicy<{ policyId: string }>({
      policyId: "new_policy",
      name: "New Policy",
      description: "A test policy",
      effect: "allow",
      actions: ["read", "write", "delete"],
      resources: ["resource:task", "resource:execution"],
      conditions: { ipRange: ["10.0.0.0/8"] },
      priority: 10,
    });

    assert.equal(capturedBody.policyId, "new_policy");
    assert.equal(capturedBody.description, "A test policy");
    assert.equal(capturedBody.effect, "allow");
    assert.deepEqual(capturedBody.actions, ["read", "write", "delete"]);
    assert.deepEqual(capturedBody.resources, ["resource:task", "resource:execution"]);
    assert.deepEqual(capturedBody.conditions, { ipRange: ["10.0.0.0/8"] });
    assert.equal(capturedBody.priority, 10);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.updatePolicy sends partial update", async () => {
  const sdk = createTestSdk();

  let capturedBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options?.body as string);
    return new Response(JSON.stringify({ policyId: "policy_1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await sdk.updatePolicy<{ policyId: string }>("policy_1", {
      priority: 5,
      description: "Updated description",
    });

    assert.equal(capturedBody.priority, 5);
    assert.equal(capturedBody.description, "Updated description");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.activateDomain includes optional reason", async () => {
  const sdk = createTestSdk();

  let capturedBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options?.body as string);
    return new Response(JSON.stringify({ domainId: "domain_1", status: "active" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await sdk.activateDomain<{ domainId: string; status: string }>("domain_1", "Enabling for production");
    assert.equal(capturedBody.reason, "Enabling for production");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.deactivateDomain includes optional reason", async () => {
  const sdk = createTestSdk();

  let capturedBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options?.body as string);
    return new Response(JSON.stringify({ domainId: "domain_1", status: "inactive" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await sdk.deactivateDomain<{ domainId: string; status: string }>("domain_1", "Maintenance window");
    assert.equal(capturedBody.reason, "Maintenance window");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.suspendDomain includes reason", async () => {
  const sdk = createTestSdk();

  let capturedBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options?.body as string);
    return new Response(JSON.stringify({ domainId: "domain_1", status: "suspended" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await sdk.suspendDomain<{ domainId: string; status: string }>("domain_1", "Policy violation");
    assert.equal(capturedBody.reason, "Policy violation");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.resumeDomain sends empty body", async () => {
  const sdk = createTestSdk();

  let capturedBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options?.body as string);
    return new Response(JSON.stringify({ domainId: "domain_1", status: "active" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await sdk.resumeDomain<{ domainId: string; status: string }>("domain_1");
    assert.deepEqual(capturedBody, {});
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.pauseRollout includes optional reason", async () => {
  const sdk = createTestSdk();

  let capturedBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options?.body as string);
    return new Response(JSON.stringify({ rolloutId: "rollout_1", status: "paused" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await sdk.pauseRollout<{ rolloutId: string; status: string }>("rollout_1", "Manual pause for testing");
    assert.equal(capturedBody.reason, "Manual pause for testing");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.cancelRollout includes optional reason", async () => {
  const sdk = createTestSdk();

  let capturedBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options?.body as string);
    return new Response(JSON.stringify({ rolloutId: "rollout_1", status: "cancelled" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await sdk.cancelRollout<{ rolloutId: string; status: string }>("rollout_1", "No longer needed");
    assert.equal(capturedBody.reason, "No longer needed");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AdminSdk.advanceRolloutPercentage sends targetPercentage", async () => {
  const sdk = createTestSdk();

  let capturedBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options?.body as string);
    return new Response(JSON.stringify({ rolloutId: "rollout_1", percentage: 50 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await sdk.advanceRolloutPercentage<{ rolloutId: string; percentage: number }>("rollout_1", 50);
    assert.equal(capturedBody.targetPercentage, 50);
  } finally {
    globalThis.fetch = originalFetch;
  }
});