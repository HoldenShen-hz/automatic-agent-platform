// @ts-nocheck
/**
 * Integration Tests: Secret Lease
 *
 * Tests secret lease lifecycle including issuance, expiration, revocation,
 * status normalization, and integration with rotation policy.
 *
 * Uses SQLite with real SqliteDatabase and AuthoritativeTaskStore.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { EnvSecretProvider } from "../../../../../../src/platform/control-plane/iam/env-secret-provider.js";
import { SecretManagementService } from "../../../../../../src/platform/control-plane/iam/secret-management-service.js";
import { AuthoritativeTaskStore } from "../../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";

function createHarness(prefix) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "secret-lease-integration.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store };
}

function createService(harness, env = {}) {
  const provider = new EnvSecretProvider({ env });
  return new SecretManagementService(harness.db, harness.store, {
    providers: {
      environment: {
        providerKind: "environment",
        async describeSecret(secretRef) {
          return provider.describeSecret(secretRef);
        },
        async requireSecret(secretRef) {
          return provider.requireSecret(secretRef);
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Lease issuance
// ---------------------------------------------------------------------------

test("issueSecretLease creates lease record with correct expiration from ttlMinutes", async () => {
  const harness = createHarness("aa-int-lease-issue-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_LEASE_TEST: "lease-value-12345",
    });

    service.registerSecret({
      secretRef: "secret://system/int/lease/issue",
      displayName: "Lease Issue Test",
      category: "tenant_credential",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.lease.issue",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
    });

    const lease = await service.issueSecretLease({
      secretRef: "secret://system/int/lease/issue",
      requestedBy: "ops.worker",
      grantedTo: "lease-runner",
      usagePurpose: "test_lease",
      ttlMinutes: 30,
    });

    assert.equal(lease.metadata.leaseStatus, "active");
    assert.ok(lease.metadata.expiresAt != null);
    assert.ok(lease.metadata.leaseId != null);

    const issuedAt = new Date(lease.metadata.issuedAt);
    const expiresAt = new Date(lease.metadata.expiresAt);
    const expectedExpiry = new Date(issuedAt.getTime() + 30 * 60 * 1000);
    assert.ok(Math.abs(expiresAt.getTime() - expectedExpiry.getTime()) < 5000);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("issueSecretLease uses rotationPolicy.ttlMinutes when ttlMinutes not provided", async () => {
  const harness = createHarness("aa-int-lease-policy-ttl-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_LEASE_POLICY_TTL: "policy-ttl-value",
    });

    service.registerSecret({
      secretRef: "secret://system/int/lease/policy/ttl",
      displayName: "Policy TTL Test",
      category: "tenant_credential",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.lease.policy.ttl",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 45, breakGlass: false },
      currentVersion: "v1",
    });

    const lease = await service.issueSecretLease({
      secretRef: "secret://system/int/lease/policy/ttl",
      requestedBy: "ops.worker",
      grantedTo: "policy-ttl-runner",
      usagePurpose: "test_policy_ttl",
    });

    const issuedAt = new Date(lease.metadata.issuedAt);
    const expiresAt = new Date(lease.metadata.expiresAt);
    const expectedExpiry = new Date(issuedAt.getTime() + 45 * 60 * 1000);
    assert.ok(Math.abs(expiresAt.getTime() - expectedExpiry.getTime()) < 5000);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("issueSecretLease records taskId and executionId when provided", async () => {
  const harness = createHarness("aa-int-lease-ids-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_LEASE_IDS: "lease-ids-value",
    });

    service.registerSecret({
      secretRef: "secret://system/int/lease/ids",
      displayName: "Lease IDs Test",
      category: "tenant_credential",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.lease.ids",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 30, breakGlass: false },
      currentVersion: "v1",
    });

    const lease = await service.issueSecretLease({
      secretRef: "secret://system/int/lease/ids",
      requestedBy: "ops.worker",
      grantedTo: "ids-runner",
      usagePurpose: "test_ids",
      taskId: "task-lease-001",
      executionId: "exec-lease-001",
    });

    assert.equal(lease.lease.taskId, "task-lease-001");
    assert.equal(lease.lease.executionId, "exec-lease-001");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("issueSecretLease sets leaseSource to wrapped_secret when provider does not issue lease", async () => {
  const harness = createHarness("aa-int-lease-source-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_LEASE_SOURCE: "source-value",
    });

    service.registerSecret({
      secretRef: "secret://system/int/lease/source",
      displayName: "Lease Source Test",
      category: "tenant_credential",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.lease.source",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 30, breakGlass: false },
      currentVersion: "v1",
    });

    const lease = await service.issueSecretLease({
      secretRef: "secret://system/int/lease/source",
      requestedBy: "ops.worker",
      grantedTo: "source-runner",
      usagePurpose: "test_source",
    });

    assert.equal(lease.metadata.leaseSource, "wrapped_secret");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("issueSecretLease throws when secret registry status is disabled", async () => {
  const harness = createHarness("aa-int-lease-disabled-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_LEASE_DISABLED: "disabled-value",
    });

    service.registerSecret({
      secretRef: "secret://system/int/lease/disabled",
      displayName: "Lease Disabled Test",
      category: "tenant_credential",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.lease.disabled",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 30, breakGlass: false },
      currentVersion: "v1",
      status: "disabled",
    });

    await assert.rejects(
      async () =>
        service.issueSecretLease({
          secretRef: "secret://system/int/lease/disabled",
          requestedBy: "ops.worker",
          grantedTo: "disabled-runner",
          usagePurpose: "test_disabled",
        }),
      (err) => err.message.includes("secret.registry_unavailable"),
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// ---------------------------------------------------------------------------
// Lease revocation
// ---------------------------------------------------------------------------

test("revokeSecretLease sets status to revoked with reason and revokedBy", async () => {
  const harness = createHarness("aa-int-lease-revoke-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_LEASE_REVOKE: "revoke-value",
    });

    service.registerSecret({
      secretRef: "secret://system/int/lease/revoke",
      displayName: "Lease Revoke Test",
      category: "tenant_credential",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.lease.revoke",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
    });

    const issued = await service.issueSecretLease({
      secretRef: "secret://system/int/lease/revoke",
      requestedBy: "ops.worker",
      grantedTo: "revoke-runner",
      usagePurpose: "test_revoke",
      ttlMinutes: 60,
    });

    const revoked = service.revokeSecretLease({
      leaseId: issued.metadata.leaseId,
      revokedBy: "security.admin",
      reasonCode: "security_policy_violation",
    });

    assert.equal(revoked.status, "revoked");
    assert.equal(revoked.revokedBy, "security.admin");
    assert.equal(revoked.revocationReasonCode, "security_policy_violation");
    assert.ok(revoked.revokedAt != null);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("revokeSecretLease on already-revoked lease returns existing record unchanged", () => {
  const harness = createHarness("aa-int-lease-revoke-twice-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_LEASE_REVOKE_TWICE: "revoke-twice-value",
    });

    service.registerSecret({
      secretRef: "secret://system/int/lease/revoke/twice",
      displayName: "Lease Revoke Twice Test",
      category: "tenant_credential",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.lease.revoke.twice",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
    });

    const issued = service.issueSecretLeaseSync({
      secretRef: "secret://system/int/lease/revoke/twice",
      requestedBy: "ops.worker",
      grantedTo: "revoke-twice-runner",
      usagePurpose: "test_revoke_twice",
      ttlMinutes: 60,
    });

    const firstRevoked = service.revokeSecretLease({
      leaseId: issued.metadata.leaseId,
      revokedBy: "security.admin",
      reasonCode: "security_policy_violation",
    });

    const secondRevoked = service.revokeSecretLease({
      leaseId: issued.metadata.leaseId,
      revokedBy: "another.admin",
      reasonCode: "another_reason",
    });

    assert.equal(secondRevoked.status, "revoked");
    assert.equal(secondRevoked.revokedBy, "security.admin");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// ---------------------------------------------------------------------------
// Lease listing and status normalization
// ---------------------------------------------------------------------------

test("listSecretLeases returns leases for secret with status normalized to expired", () => {
  const harness = createHarness("aa-int-lease-list-expired-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_LEASE_LIST_EXPIRED: "list-expired-value",
    });

    service.registerSecret({
      secretRef: "secret://system/int/lease/list/expired",
      displayName: "Lease List Expired Test",
      category: "tenant_credential",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.lease.list.expired",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
    });

    await service.issueSecretLease({
      secretRef: "secret://system/int/lease/list/expired",
      requestedBy: "ops.worker",
      grantedTo: "list-expired-runner",
      usagePurpose: "test_list_expired",
      ttlMinutes: 1,
    });

    const leases = service.listSecretLeases("secret://system/int/lease/list/expired", "2026-04-25T12:00:00.000Z");
    assert.ok(leases.length >= 1);
    assert.equal(leases[0].status, "expired");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("listSecretLeases returns active leases when not expired", async () => {
  const harness = createHarness("aa-int-lease-list-active-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_LEASE_LIST_ACTIVE: "list-active-value",
    });

    service.registerSecret({
      secretRef: "secret://system/int/lease/list/active",
      displayName: "Lease List Active Test",
      category: "tenant_credential",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.lease.list.active",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
    });

    await service.issueSecretLease({
      secretRef: "secret://system/int/lease/list/active",
      requestedBy: "ops.worker",
      grantedTo: "list-active-runner",
      usagePurpose: "test_list_active",
      ttlMinutes: 120,
    });

    const leases = service.listSecretLeases("secret://system/int/lease/list/active", "2026-04-25T00:00:00.000Z");
    assert.ok(leases.length >= 1);
    assert.equal(leases[0].status, "active");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("listSecretLeases throws for non-existent secretRef", () => {
  const harness = createHarness("aa-int-lease-list-none-");
  try {
    const service = createService(harness);

    assert.throws(
      () => service.listSecretLeases("secret://system/nonexistent", "2026-04-15T00:00:00.000Z"),
      (err) => err.message.includes("secret.registry_not_found"),
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// ---------------------------------------------------------------------------
// Lease with fixed expiresAt
// ---------------------------------------------------------------------------

test("issueSecretLease accepts fixed expiresAt timestamp", async () => {
  const harness = createHarness("aa-int-lease-fixed-expiry-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_LEASE_FIXED: "fixed-expiry-value",
    });

    service.registerSecret({
      secretRef: "secret://system/int/lease/fixed/expiry",
      displayName: "Lease Fixed Expiry Test",
      category: "tenant_credential",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.lease.fixed.expiry",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
    });

    const fixedExpiry = "2026-04-26T00:00:00.000Z";
    const lease = await service.issueSecretLease({
      secretRef: "secret://system/int/lease/fixed/expiry",
      requestedBy: "ops.worker",
      grantedTo: "fixed-runner",
      usagePurpose: "test_fixed_expiry",
      expiresAt: fixedExpiry,
    });

    assert.equal(lease.metadata.expiresAt, fixedExpiry);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// ---------------------------------------------------------------------------
// Lease metadata integration
// ---------------------------------------------------------------------------

test("issueSecretLease includes providerKind, registryStatus, and sourceVersion in metadata", async () => {
  const harness = createHarness("aa-int-lease-metadata-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_LEASE_METADATA: "metadata-value",
    });

    service.registerSecret({
      secretRef: "secret://system/int/lease/metadata",
      displayName: "Lease Metadata Test",
      category: "oauth_client_secret",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.lease.metadata",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 30, breakGlass: false },
      currentVersion: "v3",
    });

    const lease = await service.issueSecretLease({
      secretRef: "secret://system/int/lease/metadata",
      requestedBy: "ops.worker",
      grantedTo: "metadata-runner",
      usagePurpose: "test_metadata",
      ttlMinutes: 30,
    });

    assert.equal(lease.metadata.providerKind, "environment");
    assert.equal(lease.metadata.registryStatus, "active");
    assert.equal(lease.metadata.lastRotatedAt, null);
    assert.equal(lease.metadata.nextRotationDueAt, null);
    assert.equal(lease.lease.sourceVersion, "v3");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// ---------------------------------------------------------------------------
// Multiple leases
// ---------------------------------------------------------------------------

test("multiple leases can be issued for the same secret", async () => {
  const harness = createHarness("aa-int-lease-multiple-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_LEASE_MULTIPLE: "multiple-value",
    });

    service.registerSecret({
      secretRef: "secret://system/int/lease/multiple",
      displayName: "Lease Multiple Test",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.lease.multiple",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
    });

    const lease1 = await service.issueSecretLease({
      secretRef: "secret://system/int/lease/multiple",
      requestedBy: "ops.worker1",
      grantedTo: "runner1",
      usagePurpose: "test_multiple_1",
      ttlMinutes: 30,
    });

    const lease2 = await service.issueSecretLease({
      secretRef: "secret://system/int/lease/multiple",
      requestedBy: "ops.worker2",
      grantedTo: "runner2",
      usagePurpose: "test_multiple_2",
      ttlMinutes: 60,
    });

    assert.notEqual(lease1.metadata.leaseId, lease2.metadata.leaseId);

    const leases = service.listSecretLeases("secret://system/int/lease/multiple");
    assert.ok(leases.length >= 2);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// ---------------------------------------------------------------------------
// Lease and rotation integration
// ---------------------------------------------------------------------------

test("lease remains active after secret rotation completes", async () => {
  const harness = createHarness("aa-int-lease-rotation-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_LEASE_ROTATION: "rotation-lease-value",
    });

    service.registerSecret({
      secretRef: "secret://system/int/lease/rotation",
      displayName: "Lease Rotation Test",
      category: "db_connection_secret",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.lease.rotation",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
    });

    const lease = await service.issueSecretLease({
      secretRef: "secret://system/int/lease/rotation",
      requestedBy: "ops.worker",
      grantedTo: "rotation-runner",
      usagePurpose: "test_lease_rotation",
      ttlMinutes: 120,
    });

    service.recordRotationEvent({
      secretRef: "secret://system/int/lease/rotation",
      rotationMode: "scheduled",
      status: "completed",
      reasonCode: "rotation_applied",
      requestedBy: "ops.rotation",
      previousVersion: "v1",
      nextVersion: "v2",
      occurredAt: "2026-04-25T00:00:00.000Z",
    });

    const leases = service.listSecretLeases("secret://system/int/lease/rotation");
    assert.ok(leases.length >= 1);
    const activeLease = leases.find((l) => l.status === "active");
    assert.ok(activeLease != null);
    assert.equal(activeLease.sourceVersion, "v1");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("buildAuditSummary includes leases for secret with rotation events", () => {
  const harness = createHarness("aa-int-lease-audit-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_LEASE_AUDIT: "audit-lease-value",
    });

    service.registerSecret({
      secretRef: "secret://system/int/lease/audit",
      displayName: "Lease Audit Test",
      category: "tenant_credential",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.lease.audit",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-01-01T00:00:00.000Z",
      nextRotationDueAt: "2026-04-01T00:00:00.000Z",
    });

    service.issueSecretLeaseSync({
      secretRef: "secret://system/int/lease/audit",
      requestedBy: "ops.worker",
      grantedTo: "audit-runner",
      usagePurpose: "test_audit",
      ttlMinutes: 120,
    });

    service.recordRotationEvent({
      secretRef: "secret://system/int/lease/audit",
      rotationMode: "scheduled",
      status: "requested",
      reasonCode: "rotation_window_open",
      requestedBy: "ops.rotation",
    });

    const summary = service.buildAuditSummary("secret://system/int/lease/audit", "2026-04-15T00:00:00.000Z");
    assert.ok(summary.leases.length >= 1);
    assert.equal(summary.rotationEvents.length, 1);
    assert.equal(summary.rotationDue, true);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});