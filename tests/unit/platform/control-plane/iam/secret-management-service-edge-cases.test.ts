import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { EnvSecretProvider } from "../../../../../src/platform/five-plane-control-plane/iam/env-secret-provider.js";
import { SecretManagementService } from "../../../../../src/platform/five-plane-control-plane/iam/secret-management-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "secret-management.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store };
}

function createStubSecretMetadata(secretRef = "secret://system/test/secret") {
  return {
    secretRef,
    envName: "AA_TEST_SECRET",
    scope: "system/test/secret",
    source: "environment" as const,
    resolved: true,
    maskedValue: "****",
  };
}

function createStubSecretValue(secretRef = "secret://system/test/secret") {
  return {
    ...createStubSecretMetadata(secretRef),
    value: "secret-value",
  };
}

test("secret management service throws StorageError when resolving unknown secret", async () => {
  const harness = createHarness("aa-secret-unknown-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);
    await assert.rejects(
      async () =>
        service.resolveSecret({
          secretRef: "secret://system/unknown/secret",
          requestedBy: "test",
          grantedTo: "test",
          usagePurpose: "test",
        }),
      (err: any) => err.code === "secret.registry_not_found",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service throws PolicyDeniedError when resolving disabled secret", async () => {
  const harness = createHarness("aa-secret-disabled-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store, {
      providers: {
        environment: {
          providerKind: "environment",
          async describeSecret(secretRef) {
            return createStubSecretMetadata(secretRef);
          },
          async requireSecret(secretRef) {
            return createStubSecretValue(secretRef);
          },
        },
      },
    });

    service.registerSecret({
      secretRef: "secret://system/disabled/secret",
      displayName: "Disabled Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.disabled",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      status: "disabled",
    });

    await assert.rejects(
      async () =>
        service.resolveSecret({
          secretRef: "secret://system/disabled/secret",
          requestedBy: "test",
          grantedTo: "test",
          usagePurpose: "test",
        }),
      (err: any) => err.code.startsWith("secret.registry_unavailable"),
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service throws PolicyDeniedError when resolving revoked secret", async () => {
  const harness = createHarness("aa-secret-revoked-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store, {
      providers: {
        environment: {
          providerKind: "environment",
          async describeSecret(secretRef) {
            return createStubSecretMetadata(secretRef);
          },
          async requireSecret(secretRef) {
            return createStubSecretValue(secretRef);
          },
        },
      },
    });

    service.registerSecret({
      secretRef: "secret://system/revoked/secret",
      displayName: "Revoked Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.revoked",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      status: "revoked",
    });

    await assert.rejects(
      async () =>
        service.resolveSecret({
          secretRef: "secret://system/revoked/secret",
          requestedBy: "test",
          grantedTo: "test",
          usagePurpose: "test",
        }),
      (err: any) => err.code.startsWith("secret.registry_unavailable"),
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service rejects leases above the platform maximum TTL", async () => {
  const harness = createHarness("aa-secret-max-ttl-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store, {
      providers: {
        environment: {
          providerKind: "environment",
          async describeSecret(secretRef) {
            return createStubSecretMetadata(secretRef);
          },
          async requireSecret(secretRef) {
            return createStubSecretValue(secretRef);
          },
        },
      },
    });

    service.registerSecret({
      secretRef: "secret://system/max-ttl/secret",
      displayName: "Max TTL Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.max-ttl",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 10, breakGlass: false },
      status: "active",
    });

    await assert.rejects(
      async () =>
        service.issueSecretLease({
          secretRef: "secret://system/max-ttl/secret",
          requestedBy: "test",
          grantedTo: "test",
          usagePurpose: "test",
          ttlMinutes: 60 * 24 * 30,
        }),
      (err: any) => err.code?.startsWith("secret.lease_ttl_exceeds_maximum:"),
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service recursively sanitizes metadata keys that could pollute prototypes", () => {
  const harness = createHarness("aa-secret-metadata-sanitize-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);
    service.registerSecret({
      secretRef: "secret://system/sanitize/secret",
      displayName: "Sanitized Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.sanitize",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 30, breakGlass: false },
      metadata: {
        safe: "ok",
        nested: {
          ...JSON.parse('{"__proto__":{"polluted":true}}'),
          child: {
            constructor: "blocked",
            keep: "value",
          },
        },
      } as Record<string, unknown>,
    });

    const stored = harness.store.getSecretRegistryRecord("secret://system/sanitize/secret");
    assert.ok(stored);
    const metadata = JSON.parse(stored.metadataJson ?? "{}") as Record<string, unknown>;
    assert.equal((metadata.safe as string), "ok");
    assert.equal("nested" in metadata, true);
    const nested = metadata["nested"] as Record<string, unknown>;
    assert.equal(Object.hasOwn(nested, "__proto__"), false);
    const child = nested["child"] as Record<string, unknown>;
    assert.equal(Object.hasOwn(child, "constructor"), false);
    assert.equal(child["keep"], "value");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service redacts lease identifiers when leases are missing", () => {
  const harness = createHarness("aa-secret-lease-redact-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);
    assert.throws(
      () => service.revokeSecretLease({ leaseId: "secret_lease_sensitive_identifier", revokedBy: "ops" }),
      (err: any) => {
        assert.equal(err.code, "secret.lease_not_found:secret_lease_sensitive_identifier");
        assert.equal(String(err.details?.leaseId ?? ""), "secret_lease<redacted>");
        return true;
      },
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service throws ProviderError when provider is not registered", async () => {
  const harness = createHarness("aa-secret-no-provider-unit-");
  try {
    // Use a custom provider kind that has no registered provider
    const service = new SecretManagementService(harness.db, harness.store, {
      providers: {
        // Only environment provider is configured
        environment: {
          providerKind: "environment",
          async describeSecret(secretRef) {
            return createStubSecretMetadata(secretRef);
          },
          async requireSecret(secretRef) {
            return createStubSecretValue(secretRef);
          },
        },
        // kms provider is not configured, so when we try to resolve a kms secret,
        // it will fail because the provider lookup returns undefined
        kms: undefined as any,
      },
    });

    service.registerSecret({
      secretRef: "secret://system/unknown-provider",
      displayName: "Unknown Provider Secret",
      category: "provider_api_key",
      providerKind: "kms",
      scopeType: "system",
      scopeRef: "system.unknown-provider",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
    });

    await assert.rejects(
      async () =>
        service.resolveSecret({
          secretRef: "secret://system/unknown-provider",
          requestedBy: "test",
          grantedTo: "test",
          usagePurpose: "test",
        }, {
          callerScopeType: "system",
          callerScopeRef: "system.unknown-provider",
        }),
      (err: any) => {
        assert.equal(err.code, "secret.provider_not_registered:kms");
        assert.equal(err.details?.providerKind, undefined);
        assert.equal(err.details?.providerConfigured, false);
        assert.equal(err.details?.secretRef, "secret://system/<redacted>");
        return true;
      },
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service minimizes unauthorized scope error details", async () => {
  const harness = createHarness("aa-secret-authz-redact-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);
    service.registerSecret({
      secretRef: "secret://tenant/acme/payments/api-key",
      displayName: "Tenant Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "tenant",
      scopeRef: "tenant.acme",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 30, breakGlass: false },
      status: "active",
    });

    await assert.rejects(
      async () =>
        service.issueSecretLease({
          secretRef: "secret://tenant/acme/payments/api-key",
          requestedBy: "test",
          grantedTo: "worker",
          usagePurpose: "test",
          ttlMinutes: 5,
        }, {
          callerScopeType: "workspace",
          callerScopeRef: "workspace.other",
        }),
      (err: any) => {
        assert.equal(err.code, "secret.unauthorized_scope:secret://tenant/acme/payments/api-key");
        assert.equal(err.details?.secretRef, "secret://tenant/<redacted>");
        assert.equal(err.details?.callerScopeType, undefined);
        assert.equal(err.details?.callerScopeRef, undefined);
        assert.equal(err.details?.secretScopeRef, undefined);
        assert.equal(err.details?.reason, "scope_mismatch");
        return true;
      },
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service describeSecret returns metadata without value", async () => {
  const harness = createHarness("aa-secret-describe-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store, {
      providers: {
        environment: {
          providerKind: "environment",
          async describeSecret(secretRef) {
            return new EnvSecretProvider({
              env: { AA_SECRET_SYSTEM_DESCRIBE_TEST: "describe-secret-value" },
            }).describeSecret(secretRef);
          },
          async requireSecret(secretRef) {
            return new EnvSecretProvider({
              env: { AA_SECRET_SYSTEM_DESCRIBE_TEST: "describe-secret-value" },
            }).requireSecret(secretRef);
          },
        },
      },
    });

    service.registerSecret({
      secretRef: "secret://system/describe/test",
      displayName: "Describe Test Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.describe",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-04-01T00:00:00.000Z",
    });

    const description = await service.describeSecret("secret://system/describe/test");

    assert.equal(description.metadata.providerKind, "environment");
    assert.equal(description.metadata.registryStatus, "active");
    assert.equal(description.registry.secretRef, "secret://system/describe/test");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service buildAuditSummary returns complete audit trail", async () => {
  const harness = createHarness("aa-secret-audit-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store, {
      providers: {
        environment: {
          providerKind: "environment",
          async describeSecret(secretRef) {
            return new EnvSecretProvider({
              env: { AA_SECRET_SYSTEM_AUDIT_TEST: "audit-secret-value" },
            }).describeSecret(secretRef);
          },
          async requireSecret(secretRef) {
            return new EnvSecretProvider({
              env: { AA_SECRET_SYSTEM_AUDIT_TEST: "audit-secret-value" },
            }).requireSecret(secretRef);
          },
        },
      },
    });

    service.registerSecret({
      secretRef: "secret://system/audit/test",
      displayName: "Audit Test Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.audit",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-04-01T00:00:00.000Z",
      nextRotationDueAt: "2026-04-15T00:00:00.000Z",
    });

    await service.resolveSecret({
      secretRef: "secret://system/audit/test",
      requestedBy: "ops.audit",
      grantedTo: "test-worker",
      usagePurpose: "audit_test",
    }, {
      callerScopeType: "system",
      callerScopeRef: "system.audit",
    });

    const summary = service.buildAuditSummary("secret://system/audit/test", "2026-04-20T00:00:00.000Z");

    assert.equal(summary.registry.secretRef, "secret://system/audit/test");
    assert.equal(summary.usageAudits.length, 1);
    assert.equal(summary.rotationEvents.length, 0);
    assert.equal(summary.generatedAt, "2026-04-20T00:00:00.000Z");
    assert.equal(summary.rotationDue, true);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service listSecretLeases returns normalized statuses", async () => {
  const harness = createHarness("aa-secret-list-leases-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store, {
      providers: {
        environment: {
          providerKind: "environment",
          async describeSecret(secretRef) {
            return new EnvSecretProvider({
              env: { AA_SECRET_SYSTEM_LEASES_TEST: "leases-secret-value" },
            }).describeSecret(secretRef);
          },
          async requireSecret(secretRef) {
            return new EnvSecretProvider({
              env: { AA_SECRET_SYSTEM_LEASES_TEST: "leases-secret-value" },
            }).requireSecret(secretRef);
          },
        },
      },
    });

    service.registerSecret({
      secretRef: "secret://system/leases/test",
      displayName: "Leases Test Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.leases",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
    });

    const lease = await service.issueSecretLease({
      secretRef: "secret://system/leases/test",
      requestedBy: "ops.leases",
      grantedTo: "test-worker",
      usagePurpose: "leases_test",
      ttlMinutes: 1,
    });

    const leasesBeforeExpiry = service.listSecretLeases("secret://system/leases/test");
    assert.equal(leasesBeforeExpiry.length, 1);
    assert.equal(leasesBeforeExpiry[0]?.status, "active");

    const expiredTime = new Date(Date.parse(lease.lease.expiresAt) + 1000).toISOString();
    const leasesAfterExpiry = service.listSecretLeases("secret://system/leases/test", expiredTime);
    assert.equal(leasesAfterExpiry.length, 1);
    assert.equal(leasesAfterExpiry[0]?.status, "expired");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service revokeSecretLease updates already-expired lease", async () => {
  const harness = createHarness("aa-secret-revoke-expired-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store, {
      providers: {
        environment: {
          providerKind: "environment",
          async describeSecret(secretRef) {
            return new EnvSecretProvider({
              env: { AA_SECRET_SYSTEM_REVOKE_TEST: "revoke-secret-value" },
            }).describeSecret(secretRef);
          },
          async requireSecret(secretRef) {
            return new EnvSecretProvider({
              env: { AA_SECRET_SYSTEM_REVOKE_TEST: "revoke-secret-value" },
            }).requireSecret(secretRef);
          },
        },
      },
    });

    service.registerSecret({
      secretRef: "secret://system/revoke/test",
      displayName: "Revoke Test Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.revoke",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
    });

    const lease = await service.issueSecretLease({
      secretRef: "secret://system/revoke/test",
      requestedBy: "ops.revoke",
      grantedTo: "test-worker",
      usagePurpose: "revoke_test",
      ttlMinutes: 1,
    });

    const expiredTime = new Date(Date.parse(lease.lease.expiresAt) + 1000).toISOString();
    const revoked = service.revokeSecretLease({
      leaseId: lease.lease.leaseId,
      revokedBy: "ops.revoke",
      reasonCode: "test_revocation",
      revokedAt: expiredTime,
    });

    assert.equal(revoked.status, "expired");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service throws StorageError when revoking unknown lease", () => {
  const harness = createHarness("aa-secret-revoke-unknown-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);

    assert.throws(
      () =>
        service.revokeSecretLease({
          leaseId: "unknown-lease-id",
          revokedBy: "ops.revoke",
          reasonCode: "test",
        }),
      (err: any) => err.code === "secret.lease_not_found:unknown-lease-id",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service throws ValidationError for invalid status on registration", () => {
  const harness = createHarness("aa-secret-invalid-status-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);

    assert.throws(
      () =>
        service.registerSecret({
          secretRef: "secret://system/invalid/status",
          displayName: "Invalid Status Secret",
          category: "provider_api_key",
          providerKind: "environment",
          scopeType: "system",
          scopeRef: "system.invalid.status",
          rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
          status: "invalid_status" as any,
        }),
      (err: any) => err.code === "secret.invalid_status",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service throws ValidationError for invalid category on registration", () => {
  const harness = createHarness("aa-secret-invalid-category-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);

    assert.throws(
      () =>
        service.registerSecret({
          secretRef: "secret://system/invalid/category",
          displayName: "Invalid Category Secret",
          category: "invalid_category" as any,
          providerKind: "environment",
          scopeType: "system",
          scopeRef: "system.invalid.category",
          rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
        }),
      (err: any) => err.code === "secret.invalid_category",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service throws ValidationError for invalid provider kind on registration", () => {
  const harness = createHarness("aa-secret-invalid-provider-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);

    assert.throws(
      () =>
        service.registerSecret({
          secretRef: "secret://system/invalid/provider",
          displayName: "Invalid Provider Secret",
          category: "provider_api_key",
          providerKind: "invalid_provider" as any,
          scopeType: "system",
          scopeRef: "system.invalid.provider",
          rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
        }),
      (err: any) => err.code === "secret.invalid_provider_kind",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service throws ValidationError for invalid scope type on registration", () => {
  const harness = createHarness("aa-secret-invalid-scope-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);

    assert.throws(
      () =>
        service.registerSecret({
          secretRef: "secret://system/invalid/scope",
          displayName: "Invalid Scope Secret",
          category: "provider_api_key",
          providerKind: "environment",
          scopeType: "invalid_scope" as any,
          scopeRef: "system.invalid.scope",
          rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
        }),
      (err: any) => err.code === "secret.invalid_scope_type",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service throws ValidationError for empty secret ref", () => {
  const harness = createHarness("aa-secret-empty-ref-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);

    assert.throws(
      () =>
        service.registerSecret({
          secretRef: "   ",
          displayName: "Empty Ref Secret",
          category: "provider_api_key",
          providerKind: "environment",
          scopeType: "system",
          scopeRef: "system.empty.ref",
          rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
        }),
      (err: any) => err.code === "secret.invalid_ref",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service throws ValidationError for empty display name", () => {
  const harness = createHarness("aa-secret-empty-name-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);

    assert.throws(
      () =>
        service.registerSecret({
          secretRef: "secret://system/empty/name",
          displayName: "   ",
          category: "provider_api_key",
          providerKind: "environment",
          scopeType: "system",
          scopeRef: "system.empty.name",
          rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
        }),
      (err: any) => err.code === "secret.invalid_display_name",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service throws ValidationError for invalid lease expiry", async () => {
  const harness = createHarness("aa-secret-invalid-expiry-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store, {
      providers: {
        environment: {
          providerKind: "environment",
          async describeSecret(secretRef) {
            return new EnvSecretProvider({
              env: { AA_SECRET_SYSTEM_EXPIRY_TEST: "expiry-secret-value" },
            }).describeSecret(secretRef);
          },
          async requireSecret(secretRef) {
            return new EnvSecretProvider({
              env: { AA_SECRET_SYSTEM_EXPIRY_TEST: "expiry-secret-value" },
            }).requireSecret(secretRef);
          },
        },
      },
    });

    service.registerSecret({
      secretRef: "secret://system/expiry/test",
      displayName: "Expiry Test Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.expiry",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
    });

    await assert.rejects(
      async () =>
        service.issueSecretLease({
          secretRef: "secret://system/expiry/test",
          requestedBy: "ops.expiry",
          grantedTo: "test-worker",
          usagePurpose: "expiry_test",
          expiresAt: "2020-01-01T00:00:00.000Z",
        }),
      (err: any) => err.code.startsWith("secret.invalid_lease_expiry"),
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service records rotation event with emergency mode", () => {
  const harness = createHarness("aa-secret-emergency-rotation-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);
    service.registerSecret({
      secretRef: "secret://system/emergency/rotation",
      displayName: "Emergency Rotation Secret",
      category: "break_glass_secret",
      providerKind: "vault",
      scopeType: "system",
      scopeRef: "system.emergency.rotation",
      rotationPolicy: { cadenceDays: 14, ttlMinutes: 30, breakGlass: true },
      currentVersion: "v1",
    });

    const event = service.recordRotationEvent({
      secretRef: "secret://system/emergency/rotation",
      rotationMode: "emergency",
      status: "requested",
      reasonCode: "security_incident",
      requestedBy: "security.team",
      previousVersion: "v1",
    });

    assert.equal(event.rotationMode, "emergency");
    assert.equal(event.status, "requested");
    assert.equal(event.reasonCode, "security_incident");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service throws ValidationError for invalid rotation mode", () => {
  const harness = createHarness("aa-secret-invalid-rotation-mode-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);
    service.registerSecret({
      secretRef: "secret://system/invalid/rotation/mode",
      displayName: "Invalid Rotation Mode Secret",
      category: "provider_api_key",
      providerKind: "vault",
      scopeType: "system",
      scopeRef: "system.invalid.rotation.mode",
      rotationPolicy: { cadenceDays: 14, ttlMinutes: 30, breakGlass: false },
      currentVersion: "v1",
    });

    assert.throws(
      () =>
        service.recordRotationEvent({
          secretRef: "secret://system/invalid/rotation/mode",
          rotationMode: "invalid_mode" as any,
          status: "requested",
          reasonCode: "test",
          requestedBy: "test",
        }),
      (err: any) => err.code === "secret.invalid_rotation_mode",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service throws ValidationError for invalid rotation status", () => {
  const harness = createHarness("aa-secret-invalid-rotation-status-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);
    service.registerSecret({
      secretRef: "secret://system/invalid/rotation/status",
      displayName: "Invalid Rotation Status Secret",
      category: "provider_api_key",
      providerKind: "vault",
      scopeType: "system",
      scopeRef: "system.invalid.rotation.status",
      rotationPolicy: { cadenceDays: 14, ttlMinutes: 30, breakGlass: false },
      currentVersion: "v1",
    });

    assert.throws(
      () =>
        service.recordRotationEvent({
          secretRef: "secret://system/invalid/rotation/status",
          rotationMode: "scheduled",
          status: "invalid_status" as any,
          reasonCode: "test",
          requestedBy: "test",
        }),
      (err: any) => err.code === "secret.invalid_rotation_status",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service describeSecret throws on disabled secret", async () => {
  const harness = createHarness("aa-secret-describe-disabled-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store, {
      providers: {
        environment: {
          providerKind: "environment",
          async describeSecret(secretRef) {
            return createStubSecretMetadata(secretRef);
          },
          async requireSecret(secretRef) {
            return createStubSecretValue(secretRef);
          },
        },
      },
    });

    service.registerSecret({
      secretRef: "secret://system/describe/disabled",
      displayName: "Describe Disabled Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.describe.disabled",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      status: "disabled",
    });

    await assert.rejects(
      async () => service.describeSecret("secret://system/describe/disabled"),
      (err: any) => err.code.startsWith("secret.registry_unavailable"),
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service requireSecret throws on revoked secret", async () => {
  const harness = createHarness("aa-secret-require-revoked-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store, {
      providers: {
        environment: {
          providerKind: "environment",
          async describeSecret(secretRef) {
            return createStubSecretMetadata(secretRef);
          },
          async requireSecret(secretRef) {
            return createStubSecretValue(secretRef);
          },
        },
      },
    });

    service.registerSecret({
      secretRef: "secret://system/require/revoked",
      displayName: "Require Revoked Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.require.revoked",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      status: "revoked",
    });

    await assert.rejects(
      async () => service.requireSecret("secret://system/require/revoked"),
      (err: any) => err.code.startsWith("secret.registry_unavailable"),
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service refreshSecret falls back to describeSecret when refreshSecret is not implemented", async () => {
  const harness = createHarness("aa-secret-refresh-fallback-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store, {
      providers: {
        environment: {
          providerKind: "environment",
          async describeSecret(secretRef) {
            return new EnvSecretProvider({
              env: { AA_SECRET_SYSTEM_REFRESH_FALLBACK: "refresh-fallback-value" },
            }).describeSecret(secretRef);
          },
          async requireSecret(secretRef) {
            return new EnvSecretProvider({
              env: { AA_SECRET_SYSTEM_REFRESH_FALLBACK: "refresh-fallback-value" },
            }).requireSecret(secretRef);
          },
        },
      },
    });

    service.registerSecret({
      secretRef: "secret://system/refresh/fallback",
      displayName: "Refresh Fallback Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.refresh.fallback",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
    });

    const refreshed = await service.refreshSecret("secret://system/refresh/fallback");
    assert.equal(refreshed.metadata.providerKind, "environment");
    assert.equal(refreshed.registry.secretRef, "secret://system/refresh/fallback");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service listRotationDueSecrets returns empty when no secrets due", () => {
  const harness = createHarness("aa-secret-no-due-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);
    service.registerSecret({
      secretRef: "secret://system/not/due",
      displayName: "Not Due Secret",
      category: "provider_api_key",
      providerKind: "vault",
      scopeType: "system",
      scopeRef: "system.not.due",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-01-01T00:00:00.000Z",
      nextRotationDueAt: "2026-06-01T00:00:00.000Z",
    });

    const dueSecrets = service.listRotationDueSecrets("2026-04-01T00:00:00.000Z");
    assert.equal(dueSecrets.length, 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service requestDueRotations returns empty when no secrets due", () => {
  const harness = createHarness("aa-secret-no-due-request-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);
    service.registerSecret({
      secretRef: "secret://system/not/due/request",
      displayName: "Not Due Request Secret",
      category: "provider_api_key",
      providerKind: "vault",
      scopeType: "system",
      scopeRef: "system.not.due.request",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-01-01T00:00:00.000Z",
      nextRotationDueAt: "2026-06-01T00:00:00.000Z",
    });

    const events = service.requestDueRotations("2026-04-01T00:00:00.000Z", "ops.rotation");
    assert.equal(events.length, 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service requireSecret throws PolicyDeniedError without authContext", async () => {
  const harness = createHarness("aa-secret-require-no-auth-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store, {
      providers: {
        environment: {
          providerKind: "environment",
          async describeSecret(secretRef) {
            return createStubSecretMetadata(secretRef);
          },
          async requireSecret(secretRef) {
            return createStubSecretValue(secretRef);
          },
        },
      },
    });

    service.registerSecret({
      secretRef: "secret://system/no-auth/secret",
      displayName: "No Auth Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.no-auth",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
    });

    // Calling requireSecret without authContext should throw PolicyDeniedError
    await assert.rejects(
      async () => service.requireSecret("secret://system/no-auth/secret"),
      (err: any) => err.code === "secret.authorization_required:secret://system/no-auth/secret",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service requireSecret succeeds with valid authContext", async () => {
  const harness = createHarness("aa-secret-require-auth-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store, {
      providers: {
        environment: {
          providerKind: "environment",
          async describeSecret(secretRef) {
            return createStubSecretMetadata(secretRef);
          },
          async requireSecret(secretRef) {
            return createStubSecretValue(secretRef);
          },
        },
      },
    });

    service.registerSecret({
      secretRef: "secret://system/auth/secret",
      displayName: "Auth Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.auth",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
    });

    // Calling requireSecret with valid authContext should succeed
    const result = await service.requireSecret("secret://system/auth/secret", {
      callerScopeType: "system",
      callerScopeRef: "system.auth",
    });
    assert.equal(result.value, "secret-value");
    assert.equal(result.metadata.providerKind, "environment");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service requireSecret throws PolicyDeniedError for scope mismatch", async () => {
  const harness = createHarness("aa-secret-require-scope-mismatch-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store, {
      providers: {
        environment: {
          providerKind: "environment",
          async describeSecret(secretRef) {
            return createStubSecretMetadata(secretRef);
          },
          async requireSecret(secretRef) {
            return createStubSecretValue(secretRef);
          },
        },
      },
    });

    service.registerSecret({
      secretRef: "secret://tenant/private/secret",
      displayName: "Tenant Private Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "tenant",
      scopeRef: "tenant.acme",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
    });

    // Calling requireSecret with wrong scope should throw PolicyDeniedError
    await assert.rejects(
      async () => service.requireSecret("secret://tenant/private/secret", {
        callerScopeType: "tenant",
        callerScopeRef: "tenant.wrong-tenant",
      }),
      (err: any) => err.code.startsWith("secret.unauthorized_scope:"),
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});
