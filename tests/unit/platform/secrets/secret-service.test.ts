import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SecretManagementService } from "../../../../src/platform/five-plane-control-plane/iam/secret-management-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { createTempWorkspace, cleanupPath } from "../../../helpers/fs.js";
import { EnvSecretProvider } from "../../../../src/platform/five-plane-control-plane/iam/env-secret-provider.js";
import { PolicyDeniedError, StorageError, ValidationError } from "../../../../src/platform/contracts/errors.js";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "secret-service-test.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db) as any;
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
// registerSecret validation
// ---------------------------------------------------------------------------

test("registerSecret throws ValidationError for empty secretRef", () => {
  const harness = createHarness("aa-svc-reg-empty-ref-");
  try {
    const service = createService(harness);
    assert.throws(
      () =>
        service.registerSecret({
          secretRef: "",
          displayName: "Test Secret",
          category: "provider_api_key",
          providerKind: "environment",
          scopeType: "system",
          scopeRef: "system.empty",
          rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
        }),
      (e: any) => e.code === "secret.invalid_ref",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("registerSecret throws ValidationError for whitespace-only secretRef", () => {
  const harness = createHarness("aa-svc-reg-whitespace-ref-");
  try {
    const service = createService(harness);
    assert.throws(
      () =>
        service.registerSecret({
          secretRef: "   ",
          displayName: "Test Secret",
          category: "provider_api_key",
          providerKind: "environment",
          scopeType: "system",
          scopeRef: "system.whitespace",
          rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
        }),
      (e: any) => e.code === "secret.invalid_ref",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("registerSecret throws ValidationError for invalid category", () => {
  const harness = createHarness("aa-svc-reg-invalid-cat-");
  try {
    const service = createService(harness);
    assert.throws(
      () =>
        service.registerSecret({
          secretRef: "secret://system/invalid/cat",
          displayName: "Test Secret",
          category: "invalid_category" as any,
          providerKind: "environment",
          scopeType: "system",
          scopeRef: "system.invalid.cat",
          rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
        }),
      (e: any) => e.code === "secret.invalid_category",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("registerSecret throws ValidationError for invalid providerKind", () => {
  const harness = createHarness("aa-svc-reg-invalid-prov-");
  try {
    const service = createService(harness);
    assert.throws(
      () =>
        service.registerSecret({
          secretRef: "secret://system/invalid/prov",
          displayName: "Test Secret",
          category: "provider_api_key",
          providerKind: "invalid_provider" as any,
          scopeType: "system",
          scopeRef: "system.invalid.prov",
          rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
        }),
      (e: any) => e.code === "secret.invalid_provider_kind",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("registerSecret throws ValidationError for invalid scopeType", () => {
  const harness = createHarness("aa-svc-reg-invalid-scope-");
  try {
    const service = createService(harness);
    assert.throws(
      () =>
        service.registerSecret({
          secretRef: "secret://system/invalid/scope",
          displayName: "Test Secret",
          category: "provider_api_key",
          providerKind: "environment",
          scopeType: "invalid_scope" as any,
          scopeRef: "system.invalid.scope",
          rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
        }),
      (e: any) => e.code === "secret.invalid_scope_type",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("registerSecret creates registry record with all valid inputs", () => {
  const harness = createHarness("aa-svc-reg-valid-");
  try {
    const service = createService(harness);
    const registry = service.registerSecret({
      secretRef: "secret://system/valid/secret",
      displayName: "Valid Test Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.valid.secret",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
    });
    assert.equal(registry.secretRef, "secret://system/valid/secret");
    assert.equal(registry.displayName, "Valid Test Secret");
    assert.equal(registry.category, "provider_api_key");
    assert.equal(registry.providerKind, "environment");
    assert.equal(registry.status, "active");
    assert.equal(registry.currentVersion, "v1");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// ---------------------------------------------------------------------------
// resolveSecret
// ---------------------------------------------------------------------------

test("resolveSecret throws StorageError for unregistered secret", async () => {
  const harness = createHarness("aa-svc-resolve-unreg-");
  try {
    const service = createService(harness);
    await assert.rejects(
      async () =>
        service.resolveSecret({
          secretRef: "secret://system/unregistered",
          requestedBy: "test.user",
          grantedTo: "test.worker",
          usagePurpose: "test",
        }),
      (e: any) => e.code === "secret.registry_not_found:secret://system/unregistered",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("resolveSecret throws PolicyDeniedError for disabled secret", async () => {
  const harness = createHarness("aa-svc-resolve-disabled-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/disabled",
      displayName: "Disabled Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.disabled",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      status: "disabled",
    });
    await assert.rejects(
      async () =>
        service.resolveSecret({
          secretRef: "secret://system/disabled",
          requestedBy: "test.user",
          grantedTo: "test.worker",
          usagePurpose: "test",
        }),
      (e: any) => e.code.startsWith("secret.registry_unavailable"),
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("resolveSecret throws PolicyDeniedError for revoked secret", async () => {
  const harness = createHarness("aa-svc-resolve-revoked-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/revoked",
      displayName: "Revoked Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.revoked",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      status: "revoked",
    });
    await assert.rejects(
      async () =>
        service.resolveSecret({
          secretRef: "secret://system/revoked",
          requestedBy: "test.user",
          grantedTo: "test.worker",
          usagePurpose: "test",
        }),
      (e: any) => e.code.startsWith("secret.registry_unavailable"),
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("resolveSecret returns secret value with audit record for active secret", async () => {
  const harness = createHarness("aa-svc-resolve-active-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_ACTIVE: "active-secret-value",
    });
    service.registerSecret({
      secretRef: "secret://system/active",
      displayName: "Active Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.active",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
    });
    const resolution = await service.resolveSecret({
      secretRef: "secret://system/active",
      requestedBy: "test.user",
      grantedTo: "test.worker",
      usagePurpose: "test_resolution",
    });
    assert.equal(resolution.value, "active-secret-value");
    assert.equal(resolution.usageAudit.requestedBy, "test.user");
    assert.equal(resolution.usageAudit.grantedTo, "test.worker");
    assert.equal(resolution.usageAudit.usagePurpose, "test_resolution");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("resolveSecret records usage in audit trail", async () => {
  const harness = createHarness("aa-svc-resolve-audit-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_AUDIT: "audit-secret-value",
    });
    service.registerSecret({
      secretRef: "secret://system/audit",
      displayName: "Audit Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.audit",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
    });
    await service.resolveSecret({
      secretRef: "secret://system/audit",
      requestedBy: "auditor",
      grantedTo: "audit-worker",
      usagePurpose: "audit_check",
    });
    const summary = service.buildAuditSummary("secret://system/audit");
    assert.equal(summary.usageAudits.length, 1);
    assert.equal(summary.usageAudits[0]?.requestedBy, "auditor");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// ---------------------------------------------------------------------------
// describeSecret
// ---------------------------------------------------------------------------

test("describeSecret returns metadata without value", async () => {
  const harness = createHarness("aa-svc-describe-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_DESCRIBE: "describe-secret-value",
    });
    service.registerSecret({
      secretRef: "secret://system/describe",
      displayName: "Describe Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.describe",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
    });
    const description = await service.describeSecret("secret://system/describe");
    assert.equal(description.registry.secretRef, "secret://system/describe");
    assert.ok(!("value" in description.metadata && description.metadata.value));
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// ---------------------------------------------------------------------------
// issueSecretLease
// ---------------------------------------------------------------------------

test("issueSecretLease creates a lease record with expiry", async () => {
  const harness = createHarness("aa-svc-lease-create-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_LEASE: "lease-secret-value",
    });
    service.registerSecret({
      secretRef: "secret://system/lease",
      displayName: "Lease Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.lease",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
    });
    const lease = await service.issueSecretLease({
      secretRef: "secret://system/lease",
      requestedBy: "lease-requester",
      grantedTo: "lease-holder",
      usagePurpose: "test_lease",
      ttlMinutes: 30,
    });
    assert.equal(lease.lease.status, "active");
    assert.ok(lease.metadata.expiresAt > lease.metadata.issuedAt);
    assert.equal(lease.metadata.leaseSource, "wrapped_secret");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("issueSecretLease throws when ttlMinutes not provided and policy has no ttlMinutes", async () => {
  const harness = createHarness("aa-svc-lease-no-ttl-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_NO_TTL: "no-ttl-secret",
    });
    service.registerSecret({
      secretRef: "secret://system/no/ttl",
      displayName: "No TTL Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.no.ttl",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: null, breakGlass: false },
    });
    await assert.rejects(
      async () =>
        service.issueSecretLease({
          secretRef: "secret://system/no/ttl",
          requestedBy: "requester",
          grantedTo: "holder",
          usagePurpose: "test",
        }),
      (e: any) => e.code.includes("secret.lease_ttl_required"),
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// ---------------------------------------------------------------------------
// revokeSecretLease
// ---------------------------------------------------------------------------

test("revokeSecretLease changes lease status to revoked", async () => {
  const harness = createHarness("aa-svc-revoke-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_REVOKE: "revoke-secret-value",
    });
    service.registerSecret({
      secretRef: "secret://system/revoke",
      displayName: "Revoke Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.revoke",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
    });
    const lease = await service.issueSecretLease({
      secretRef: "secret://system/revoke",
      requestedBy: "requester",
      grantedTo: "holder",
      usagePurpose: "test_revoke",
      ttlMinutes: 60,
    });
    const revoked = service.revokeSecretLease({
      leaseId: lease.lease.leaseId,
      revokedBy: "admin",
      reasonCode: "test_revoke",
    });
    assert.equal(revoked.status, "revoked");
    assert.equal(revoked.revokedBy, "admin");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("revokeSecretLease throws StorageError for non-existent lease", () => {
  const harness = createHarness("aa-svc-revoke-notfound-");
  try {
    const service = createService(harness);
    assert.throws(
      () =>
        service.revokeSecretLease({
          leaseId: "non-existent-lease-id",
          revokedBy: "admin",
          reasonCode: "test",
        }),
      (e: any) => e.code === "secret.lease_not_found:non-existent-lease-id",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// ---------------------------------------------------------------------------
// listSecretLeases
// ---------------------------------------------------------------------------

test("listSecretLeases returns active leases for secret", async () => {
  const harness = createHarness("aa-svc-list-leases-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_LIST: "list-secret-value",
    });
    service.registerSecret({
      secretRef: "secret://system/list",
      displayName: "List Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.list",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
    });
    await service.issueSecretLease({
      secretRef: "secret://system/list",
      requestedBy: "requester",
      grantedTo: "holder1",
      usagePurpose: "test1",
      ttlMinutes: 60,
    });
    await service.issueSecretLease({
      secretRef: "secret://system/list",
      requestedBy: "requester",
      grantedTo: "holder2",
      usagePurpose: "test2",
      ttlMinutes: 60,
    });
    const leases = service.listSecretLeases("secret://system/list");
    assert.equal(leases.length, 2);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// ---------------------------------------------------------------------------
// buildAuditSummary
// ---------------------------------------------------------------------------

test("buildAuditSummary returns complete audit information", async () => {
  const harness = createHarness("aa-svc-audit-summary-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_SUMMARY: "summary-secret-value",
    });
    service.registerSecret({
      secretRef: "secret://system/summary",
      displayName: "Summary Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.summary",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
    });
    await service.resolveSecret({
      secretRef: "secret://system/summary",
      requestedBy: "auditor",
      grantedTo: "audit-worker",
      usagePurpose: "audit",
    });
    const summary = service.buildAuditSummary("secret://system/summary");
    assert.equal(summary.registry.secretRef, "secret://system/summary");
    assert.equal(summary.usageAudits.length, 1);
    assert.equal(summary.rotationEvents.length, 0);
    assert.ok(summary.generatedAt.length > 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("buildAuditSummary throws StorageError for unregistered secret", () => {
  const harness = createHarness("aa-svc-audit-unreg-");
  try {
    const service = createService(harness);
    assert.throws(
      () => service.buildAuditSummary("secret://system/unregistered"),
      (e: any) => e.code === "secret.registry_not_found:secret://system/unregistered",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});