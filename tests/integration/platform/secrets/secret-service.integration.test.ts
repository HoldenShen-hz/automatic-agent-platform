import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SecretManagementService } from "../../../../src/platform/five-plane-control-plane/iam/secret-management-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { createTempWorkspace, cleanupPath } from "../../../helpers/fs.js";
import { EnvSecretProvider } from "../../../../src/platform/five-plane-control-plane/iam/env-secret-provider.js";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "secret-service-integration.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store };
}

function createService(harness: ReturnType<typeof createHarness>, env: Record<string, string> = {}) {
  const provider = new EnvSecretProvider({ env });
  return new SecretManagementService(harness.db, harness.store, {
    providers: {
      environment: {
        providerKind: "environment",
        async describeSecret(secretRef: string) {
          return provider.describeSecret(secretRef);
        },
        async requireSecret(secretRef: string) {
          return provider.requireSecret(secretRef);
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// End-to-end secret lifecycle
// ---------------------------------------------------------------------------

test("complete secret lifecycle: register, resolve, lease, revoke", async () => {
  const harness = createHarness("aa-int-lifecycle-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_LIFECYCLE: "lifecycle-secret-value",
    });

    // Register secret
    const registry = service.registerSecret({
      secretRef: "secret://system/lifecycle",
      displayName: "Lifecycle Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.lifecycle",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
    });
    assert.equal(registry.status, "active");
    assert.equal(registry.currentVersion, "v1");

    // Resolve secret
    const resolution = await service.resolveSecret({
      secretRef: "secret://system/lifecycle",
      requestedBy: "lifecycle.user",
      grantedTo: "lifecycle.worker",
      usagePurpose: "initial_resolution",
    });
    assert.equal(resolution.value, "lifecycle-secret-value");

    // Issue lease
    const lease = await service.issueSecretLease({
      secretRef: "secret://system/lifecycle",
      requestedBy: "lease.requester",
      grantedTo: "lease.holder",
      usagePurpose: "leased_access",
      ttlMinutes: 30,
    });
    assert.equal(lease.lease.status, "active");

    // Revoke lease
    const revoked = service.revokeSecretLease({
      leaseId: lease.lease.leaseId,
      revokedBy: "admin",
      reasonCode: "lifecycle_complete",
    });
    assert.equal(revoked.status, "revoked");

    // Verify audit trail
    const summary = service.buildAuditSummary("secret://system/lifecycle");
    assert.equal(summary.usageAudits.length, 1);
    assert.equal(summary.rotationEvents.length, 0);
    assert.equal(summary.leases.length, 1); // one lease (now revoked)
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("registerSecret with lastRotatedAt computes nextRotationDueAt correctly", () => {
  const harness = createHarness("aa-int-reg-nextdue-");
  try {
    const service = createService(harness);
    const lastRotated = "2026-01-01T00:00:00.000Z";
    const registry = service.registerSecret({
      secretRef: "secret://system/int/reg/nextdue",
      displayName: "Next Due Secret",
      category: "oauth_client_secret",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.reg.nextdue",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: lastRotated,
    });
    assert.ok(registry.nextRotationDueAt != null);
    const nextDue = new Date(registry.nextRotationDueAt!);
    const expected = new Date("2026-01-31T00:00:00.000Z");
    assert.ok(Math.abs(nextDue.getTime() - expected.getTime()) < 1000);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("registerSecret with null cadenceDays uses default 90-day cadence for nextRotationDueAt", () => {
  const harness = createHarness("aa-int-reg-nocadence-");
  try {
    const service = createService(harness);
    const registry = service.registerSecret({
      secretRef: "secret://system/int/reg/nocadence",
      displayName: "No Cadence Secret",
      category: "oauth_client_secret",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.reg.nocadence",
      rotationPolicy: { cadenceDays: null, ttlMinutes: null, breakGlass: false },
    });
    // normalizeRotationPolicy defaults cadenceDays to 90 when null, so nextRotationDueAt is computed
    assert.notEqual(registry.nextRotationDueAt, null);
    const policy = JSON.parse(registry.rotationPolicyJson);
    assert.equal(policy.cadenceDays, 90);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("multiple secrets can be registered and resolved independently", async () => {
  const harness = createHarness("aa-int-multiple-");
  try {
    const service = createService(harness, {
      AA_SECRET_TENANT_API_KEY: "tenant-api-key-value",
      AA_SECRET_WORKSPACE_DB: "workspace-db-password",
      AA_SECRET_OAUTH_CLIENT: "oauth-client-secret",
    });

    // Register multiple secrets
    service.registerSecret({
      secretRef: "secret://tenant/api/key",
      displayName: "Tenant API Key",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "tenant",
      scopeRef: "tenant.api",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
    });

    service.registerSecret({
      secretRef: "secret://workspace/db",
      displayName: "Workspace DB Secret",
      category: "db_connection_secret",
      providerKind: "environment",
      scopeType: "workspace",
      scopeRef: "workspace.db",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 30, breakGlass: true },
    });

    service.registerSecret({
      secretRef: "secret://oauth/client",
      displayName: "OAuth Client Secret",
      category: "oauth_client_secret",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "oauth.client",
      rotationPolicy: { cadenceDays: 180, ttlMinutes: null, breakGlass: false },
    });

    // Resolve each secret
    const tenantResolution = await service.resolveSecret({
      secretRef: "secret://tenant/api/key",
      requestedBy: "user1",
      grantedTo: "worker1",
      usagePurpose: "api_access",
    });
    assert.equal(tenantResolution.value, "tenant-api-key-value");

    const workspaceResolution = await service.resolveSecret({
      secretRef: "secret://workspace/db",
      requestedBy: "user2",
      grantedTo: "worker2",
      usagePurpose: "db_access",
    });
    assert.equal(workspaceResolution.value, "workspace-db-password");

    const oauthResolution = await service.resolveSecret({
      secretRef: "secret://oauth/client",
      requestedBy: "user3",
      grantedTo: "worker3",
      usagePurpose: "oauth_flow",
    });
    assert.equal(oauthResolution.value, "oauth-client-secret");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("describeSecret does not expose secret value", async () => {
  const harness = createHarness("aa-int-describe-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_DESCRIBE: "sensitive-describe-value",
    });
    service.registerSecret({
      secretRef: "secret://system/int/describe",
      displayName: "Describe Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.describe",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
    });

    const description = await service.describeSecret("secret://system/int/describe");

    // Metadata should not contain the actual value
    assert.ok(!("value" in description));
    assert.equal(description.registry.secretRef, "secret://system/int/describe");
    assert.equal(description.metadata.registryStatus, "active");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("leases are tracked separately per secret", async () => {
  const harness = createHarness("aa-int-leases-separate-");
  try {
    const service = createService(harness, {
      AA_SECRET_LEASE_FIRST: "first-secret",
      AA_SECRET_LEASE_SECOND: "second-secret",
    });

    service.registerSecret({
      secretRef: "secret://lease/first",
      displayName: "First Lease Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "lease.first",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
    });

    service.registerSecret({
      secretRef: "secret://lease/second",
      displayName: "Second Lease Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "lease.second",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
    });

    // Issue multiple leases on first secret
    await service.issueSecretLease({
      secretRef: "secret://lease/first",
      requestedBy: "user",
      grantedTo: "holder1",
      usagePurpose: "first_lease",
      ttlMinutes: 60,
    });
    await service.issueSecretLease({
      secretRef: "secret://lease/first",
      requestedBy: "user",
      grantedTo: "holder2",
      usagePurpose: "second_lease",
      ttlMinutes: 60,
    });

    // Issue one lease on second secret
    await service.issueSecretLease({
      secretRef: "secret://lease/second",
      requestedBy: "user",
      grantedTo: "holder3",
      usagePurpose: "third_lease",
      ttlMinutes: 60,
    });

    const firstLeases = service.listSecretLeases("secret://lease/first");
    const secondLeases = service.listSecretLeases("secret://lease/second");

    assert.equal(firstLeases.length, 2);
    assert.equal(secondLeases.length, 1);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("audit summary aggregates usage audits, rotation events, and leases", async () => {
  const harness = createHarness("aa-int-audit-agg-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_AUDIT_AGG: "audit-agg-value",
    });

    service.registerSecret({
      secretRef: "secret://system/audit/agg",
      displayName: "Audit Aggregate Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.audit.agg",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
    });

    // Multiple resolutions
    await service.resolveSecret({
      secretRef: "secret://system/audit/agg",
      requestedBy: "user1",
      grantedTo: "worker1",
      usagePurpose: "first_access",
    });
    await service.resolveSecret({
      secretRef: "secret://system/audit/agg",
      requestedBy: "user2",
      grantedTo: "worker2",
      usagePurpose: "second_access",
    });

    // Rotation event
    service.recordRotationEvent({
      secretRef: "secret://system/audit/agg",
      rotationMode: "scheduled",
      status: "requested",
      reasonCode: "rotation_due",
      requestedBy: "system",
    });

    // Lease
    await service.issueSecretLease({
      secretRef: "secret://system/audit/agg",
      requestedBy: "user3",
      grantedTo: "worker3",
      usagePurpose: "leased_access",
      ttlMinutes: 60,
    });

    const summary = service.buildAuditSummary("secret://system/audit/agg");

    assert.equal(summary.usageAudits.length, 2);
    assert.equal(summary.rotationEvents.length, 1);
    assert.equal(summary.leases.length, 1);
    assert.equal(summary.registry.secretRef, "secret://system/audit/agg");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});