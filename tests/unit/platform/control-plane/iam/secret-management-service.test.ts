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

test("secret management service registers secrets, resolves them with usage audit, and computes due rotations", async () => {
  const harness = createHarness("aa-secret-management-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store, {
      providers: {
        environment: {
          providerKind: "environment",
          async describeSecret(secretRef) {
            return new EnvSecretProvider({
              env: { AA_SECRET_SYSTEM_REGISTRY_GHCR_PROD: "registry-token-123456" },
            }).describeSecret(secretRef);
          },
          async requireSecret(secretRef) {
            return new EnvSecretProvider({
              env: { AA_SECRET_SYSTEM_REGISTRY_GHCR_PROD: "registry-token-123456" },
            }).requireSecret(secretRef);
          },
        },
      },
    });

    const registry = service.registerSecret({
      secretRef: "secret://system/registry/ghcr/prod",
      displayName: "GHCR Production Push Token",
      category: "tenant_credential",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "registry.ghcr.prod",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-03-01T00:00:00.000Z",
    });

    assert.equal(registry.providerKind, "environment");
    assert.equal(service.listRotationDueSecrets("2026-04-15T00:00:00.000Z").length, 1);

    const resolved = await service.resolveSecret({
      secretRef: registry.secretRef,
      requestedBy: "ops.release",
      grantedTo: "deploy-worker",
      usagePurpose: "publish_image",
    }, {
      callerScopeType: "system",
      callerScopeRef: "system",
    });

    assert.equal(resolved.metadata.providerKind, "environment");
    assert.equal(resolved.metadata.auditId != null, true);
    assert.equal(resolved.metadata.registryStatus, "active");
    assert.equal(resolved.value, "registry-token-123456");
    assert.equal(resolved.usageAudit.usagePurpose, "publish_image");
    assert.equal(harness.store.listSecretUsageAuditsBySecretRef(registry.secretRef).length, 1);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});


test("secret management service records rotation events and advances registry version metadata", () => {
  const harness = createHarness("aa-secret-rotation-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);
    service.registerSecret({
      secretRef: "secret://system/deploy/kubeconfig/prod",
      displayName: "Prod Deployment Credential",
      category: "db_connection_secret",
      providerKind: "vault",
      scopeType: "system",
      scopeRef: "deploy.kubeconfig.prod",
      rotationPolicy: { cadenceDays: 14, ttlMinutes: 30, breakGlass: true },
      currentVersion: "v1",
      lastRotatedAt: "2026-04-01T00:00:00.000Z",
    });

    service.recordRotationEvent({
      secretRef: "secret://system/deploy/kubeconfig/prod",
      rotationMode: "scheduled",
      status: "requested",
      reasonCode: "rotation_window_open",
      requestedBy: "ops.rotation",
      previousVersion: "v1",
      nextVersion: "v2",
    });
    assert.equal(harness.store.getSecretRegistryRecord("secret://system/deploy/kubeconfig/prod")?.status, "rotating");

    service.recordRotationEvent({
      secretRef: "secret://system/deploy/kubeconfig/prod",
      rotationMode: "scheduled",
      status: "completed",
      reasonCode: "rotation_applied",
      requestedBy: "ops.rotation",
      previousVersion: "v1",
      nextVersion: "v2",
      occurredAt: "2026-04-10T00:00:00.000Z",
    });

    const registry = harness.store.getSecretRegistryRecord("secret://system/deploy/kubeconfig/prod");
    assert.equal(registry?.status, "active");
    assert.equal(registry?.currentVersion, "v2");
    assert.equal(registry?.lastRotatedAt, "2026-04-10T00:00:00.000Z");
    assert.equal(harness.store.listSecretRotationEventsBySecretRef("secret://system/deploy/kubeconfig/prod").length, 2);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service resolves vault-managed secrets from provider-specific JSON config", async () => {
  const harness = createHarness("aa-secret-vault-json-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store, {
      providerEnv: {
        AA_VAULT_SECRETS_JSON: JSON.stringify({
          "secret://system/deploy/kubeconfig/prod": {
            value: "vault-prod-deploy-token-9876",
            locator: "vault://kv/team/prod/deploy",
          },
        }),
      },
    });

    service.registerSecret({
      secretRef: "secret://system/deploy/kubeconfig/prod",
      displayName: "Prod Deployment Credential",
      category: "db_connection_secret",
      providerKind: "vault",
      scopeType: "system",
      scopeRef: "deploy.kubeconfig.prod",
      rotationPolicy: { cadenceDays: 14, ttlMinutes: 30, breakGlass: true },
      currentVersion: "v3",
      lastRotatedAt: "2026-04-01T00:00:00.000Z",
    });

    const resolved = await service.resolveSecret({
      secretRef: "secret://system/deploy/kubeconfig/prod",
      requestedBy: "ops.deploy",
      grantedTo: "deploy-worker",
      usagePurpose: "apply_manifest",
    }, {
      callerScopeType: "system",
      callerScopeRef: "system",
    });

    assert.equal(resolved.metadata.providerKind, "vault");
    assert.equal(resolved.metadata.source, "vault");
    assert.equal(resolved.metadata.envName, "vault://kv/team/prod/deploy");
    assert.equal(resolved.metadata.maskedValue?.endsWith("9876"), true);
    assert.equal(resolved.value, "vault-prod-deploy-token-9876");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service can require a managed secret without creating a usage audit", async () => {
  const harness = createHarness("aa-secret-require-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store, {
      providerEnv: {
        AA_VAULT_SECRETS_JSON: JSON.stringify({
          "secret://providers/openai/default": {
            value: "sk-openai-managed-1234",
            locator: "vault://kv/providers/openai/default",
          },
        }),
      },
    });

    service.registerSecret({
      secretRef: "secret://providers/openai/default",
      displayName: "OpenAI Default Provider Credential",
      category: "provider_api_key",
      providerKind: "vault",
      scopeType: "system",
      scopeRef: "providers.openai.default",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-04-01T00:00:00.000Z",
    });

    const required = await service.requireSecret("secret://providers/openai/default", {
      callerScopeType: "system",
      callerScopeRef: "system",
    });

    assert.equal(required.metadata.providerKind, "vault");
    assert.equal(required.metadata.auditId, null);
    assert.equal(required.metadata.source, "vault");
    assert.equal(required.value, "sk-openai-managed-1234");
    assert.equal(harness.store.listSecretUsageAuditsBySecretRef("secret://providers/openai/default").length, 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service issues, expires, and revokes short-lived secret leases", async () => {
  const harness = createHarness("aa-secret-lease-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store, {
      providers: {
        environment: {
          providerKind: "environment",
          async describeSecret(secretRef) {
            return new EnvSecretProvider({
              env: { AA_SECRET_SYSTEM_REGISTRY_GHCR_PROD: "registry-token-lease-123456" },
            }).describeSecret(secretRef);
          },
          async requireSecret(secretRef) {
            return new EnvSecretProvider({
              env: { AA_SECRET_SYSTEM_REGISTRY_GHCR_PROD: "registry-token-lease-123456" },
            }).requireSecret(secretRef);
          },
        },
      },
    });

    service.registerSecret({
      secretRef: "secret://system/registry/ghcr/prod",
      displayName: "GHCR Production Push Token",
      category: "tenant_credential",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "registry.ghcr.prod",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 15, breakGlass: false },
      currentVersion: "v2",
      lastRotatedAt: "2026-04-01T00:00:00.000Z",
    });

    const issued = await service.issueSecretLease({
      secretRef: "secret://system/registry/ghcr/prod",
      requestedBy: "ops.release",
      grantedTo: "publish-worker",
      usagePurpose: "publish_image",
    });

    assert.equal(issued.metadata.leaseId, issued.lease.leaseId);
    assert.equal(issued.metadata.leaseStatus, "active");
    assert.equal(issued.value, "registry-token-lease-123456");
    assert.equal(issued.lease.sourceVersion, "v2");
    assert.equal(harness.store.getSecretLeaseRecord(issued.lease.leaseId)?.status, "active");

    const revoked = service.revokeSecretLease({
      leaseId: issued.lease.leaseId,
      revokedBy: "ops.release",
      reasonCode: "manual_cleanup",
      revokedAt: new Date(Date.parse(issued.lease.issuedAt) + 60 * 1000).toISOString(),
      metadata: { source: "unit-test" },
    });
    assert.equal(revoked.status, "revoked");
    assert.equal(revoked.revokedBy, "ops.release");
    assert.equal(revoked.revocationReasonCode, "manual_cleanup");

    const expiringLease = await service.issueSecretLease({
      secretRef: "secret://system/registry/ghcr/prod",
      requestedBy: "ops.release",
      grantedTo: "publish-worker",
      usagePurpose: "publish_image",
      ttlMinutes: 1,
    });
    const expired = service.listSecretLeases(
      "secret://system/registry/ghcr/prod",
      new Date(Date.parse(expiringLease.lease.expiresAt) + 1).toISOString(),
    );
    assert.equal(expired.length, 2);
    assert.equal(expired.find((record) => record.leaseId === expiringLease.lease.leaseId)?.status, "expired");

    const summary = service.buildAuditSummary("secret://system/registry/ghcr/prod");
    assert.equal(summary.leases.length, 2);
    assert.equal(summary.leases.find((record) => record.leaseId === issued.lease.leaseId)?.status, "revoked");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service refreshes provider metadata without creating a usage audit", async () => {
  const harness = createHarness("aa-secret-refresh-unit-");
  let refreshCount = 0;
  try {
    const service = new SecretManagementService(harness.db, harness.store, {
      providers: {
        environment: {
          providerKind: "environment",
          async describeSecret(secretRef) {
            return new EnvSecretProvider({
              env: { AA_SECRET_SYSTEM_REFRESHABLE: "refresh-token-1234" },
            }).describeSecret(secretRef);
          },
          async requireSecret(secretRef) {
            return new EnvSecretProvider({
              env: { AA_SECRET_SYSTEM_REFRESHABLE: "refresh-token-1234" },
            }).requireSecret(secretRef);
          },
          async refreshSecret(secretRef) {
            refreshCount += 1;
            return new EnvSecretProvider({
              env: { AA_SECRET_SYSTEM_REFRESHABLE: "refresh-token-1234" },
            }).describeSecret(secretRef);
          },
        },
      },
    });

    service.registerSecret({
      secretRef: "secret://system/refreshable",
      displayName: "Refreshable Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.refreshable",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-04-01T00:00:00.000Z",
    });

    const refreshed = await service.refreshSecret("secret://system/refreshable");
    assert.equal(refreshCount, 1);
    assert.equal(refreshed.metadata.providerKind, "environment");
    assert.equal(refreshed.metadata.auditId, null);
    assert.equal(harness.store.listSecretUsageAuditsBySecretRef("secret://system/refreshable").length, 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service requests due rotations and marks registry rotating", () => {
  const harness = createHarness("aa-secret-due-request-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);
    service.registerSecret({
      secretRef: "secret://system/due/rotation",
      displayName: "Due Rotation Secret",
      category: "tenant_credential",
      providerKind: "vault",
      scopeType: "system",
      scopeRef: "system.due.rotation",
      rotationPolicy: { cadenceDays: 7, ttlMinutes: 30, breakGlass: false },
      currentVersion: "v9",
      lastRotatedAt: "2026-03-01T00:00:00.000Z",
      nextRotationDueAt: "2026-04-01T00:00:00.000Z",
    });

    const events = service.requestDueRotations("2026-04-15T00:00:00.000Z", "ops.rotation");
    assert.equal(events.length, 1);
    assert.equal(events[0]?.status, "requested");
    assert.equal(events[0]?.reasonCode, "secret.rotation_due");
    assert.equal(harness.store.getSecretRegistryRecord("secret://system/due/rotation")?.status, "rotating");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service fails closed when issuing a lease without any TTL policy", async () => {
  const harness = createHarness("aa-secret-lease-ttl-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store, {
      providers: {
        environment: {
          providerKind: "environment",
          async describeSecret(secretRef) {
            return new EnvSecretProvider({
              env: { AA_SECRET_SYSTEM_REGISTRY_GHCR_PROD: "registry-token-lease-123456" },
            }).describeSecret(secretRef);
          },
          async requireSecret(secretRef) {
            return new EnvSecretProvider({
              env: { AA_SECRET_SYSTEM_REGISTRY_GHCR_PROD: "registry-token-lease-123456" },
            }).requireSecret(secretRef);
          },
        },
      },
    });

    service.registerSecret({
      secretRef: "secret://system/registry/ghcr/prod",
      displayName: "GHCR Production Push Token",
      category: "tenant_credential",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "registry.ghcr.prod",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: null, breakGlass: false },
    });

    await assert.rejects(
      async () =>
        service.issueSecretLease({
          secretRef: "secret://system/registry/ghcr/prod",
          requestedBy: "ops.release",
          grantedTo: "publish-worker",
          usagePurpose: "publish_image",
        }),
      /secret\.lease_ttl_required:secret:\/\/system\/registry\/ghcr\/prod/,
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("secret management service prefers provider-issued short-lived leases when available", async () => {
  const harness = createHarness("aa-secret-provider-issued-lease-unit-");
  try {
    const service = new SecretManagementService(harness.db, harness.store, {
      providerEnv: {
        AA_VAULT_SECRETS_JSON: JSON.stringify({
          "secret://system/registry/ghcr/prod": {
            value: "vault-registry-token-123456",
            locator: "vault://kv/release/prod/registry",
            issued_lease: {
              value: "vault-issued-lease-token-654321",
              locator: "vault://lease/release/prod/registry",
              lease_id: "vault-lease-001",
              expires_at: "2099-01-01T00:00:00.000Z",
              renewable: true,
              issued_by: "vault.dynamic.release",
            },
          },
        }),
      },
    });

    service.registerSecret({
      secretRef: "secret://system/registry/ghcr/prod",
      displayName: "GHCR Production Push Token",
      category: "tenant_credential",
      providerKind: "vault",
      scopeType: "system",
      scopeRef: "registry.ghcr.prod",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: null, breakGlass: false },
      currentVersion: "v5",
      lastRotatedAt: "2026-04-01T00:00:00.000Z",
    });

    const issued = await service.issueSecretLease({
      secretRef: "secret://system/registry/ghcr/prod",
      requestedBy: "ops.release",
      grantedTo: "publish-worker",
      usagePurpose: "publish_image",
    });

    assert.equal(issued.value, "vault-issued-lease-token-654321");
    assert.equal(issued.metadata.leaseSource, "provider_issued");
    assert.equal(issued.metadata.providerLeaseId, "vault-lease-001");
    assert.equal(issued.metadata.expiresAt, "2099-01-01T00:00:00.000Z");
    assert.equal(issued.metadata.renewable, true);
    assert.equal(issued.metadata.issuedBy, "vault.dynamic.release");
    assert.match(harness.store.getSecretLeaseRecord(issued.lease.leaseId)?.metadataJson ?? "", /provider_issued/);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});
