import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SecretRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/secret-repository.js";
import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";

const now = "2026-04-15T10:00:00.000Z";

function insertSecretRegistry(repo: SecretRepository, secretRef = "secret://demo/api-key"): void {
  repo.upsertSecretRegistryRecord({
    secretRef,
    displayName: "Demo API Key",
    category: "provider_api_key",
    providerKind: "vault",
    scopeType: "tenant",
    scopeRef: "tenant-alpha",
    status: "active",
    rotationPolicyJson: "{\"intervalDays\":30}",
    metadataJson: "{\"env\":\"staging\"}",
    currentVersion: "v2",
    lastRotatedAt: now,
    nextRotationDueAt: "2026-05-15T10:00:00.000Z",
    createdAt: now,
    updatedAt: now,
  });
}

test("SecretRepository upsertSecretRegistryRecord and getSecretRegistryRecord", () => {
  const workspace = createTempWorkspace("aa-secret-registry-");
  const dbPath = join(workspace, "secret-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SecretRepository(db);

    repo.upsertSecretRegistryRecord({
      secretRef: "secret://demo/api-key",
      displayName: "Demo API Key",
      category: "provider_api_key",
      providerKind: "vault",
      scopeType: "tenant",
      scopeRef: "tenant-alpha",
      status: "active",
      rotationPolicyJson: "{\"intervalDays\":30}",
      metadataJson: "{\"env\":\"staging\"}",
      currentVersion: "v2",
      lastRotatedAt: now,
      nextRotationDueAt: "2026-05-15T10:00:00.000Z",
      createdAt: now,
      updatedAt: now,
    });

    const result = repo.getSecretRegistryRecord("secret://demo/api-key");
    assert.ok(result);
    assert.equal(result.displayName, "Demo API Key");
    assert.equal(result.category, "provider_api_key");
    assert.equal(result.status, "active");
    assert.equal(result.currentVersion, "v2");
  } finally {
    cleanupPath(workspace);
  }
});

test("SecretRepository upsertSecretRegistryRecord updates existing record", () => {
  const workspace = createTempWorkspace("aa-secret-registry-upd-");
  const dbPath = join(workspace, "secret-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SecretRepository(db);

    repo.upsertSecretRegistryRecord({
      secretRef: "secret://demo/api-key",
      displayName: "Original Name",
      category: "provider_api_key",
      providerKind: "vault",
      scopeType: "tenant",
      scopeRef: "tenant-alpha",
      status: "active",
      rotationPolicyJson: "{}",
      metadataJson: "{}",
      currentVersion: "v1",
      lastRotatedAt: now,
      nextRotationDueAt: "2026-05-15T10:00:00.000Z",
      createdAt: now,
      updatedAt: now,
    });

    repo.upsertSecretRegistryRecord({
      secretRef: "secret://demo/api-key",
      displayName: "Updated Name",
      category: "provider_api_key",
      providerKind: "vault",
      scopeType: "tenant",
      scopeRef: "tenant-alpha",
      status: "rotating",
      rotationPolicyJson: "{}",
      metadataJson: "{}",
      currentVersion: "v2",
      lastRotatedAt: now,
      nextRotationDueAt: "2026-05-15T10:00:00.000Z",
      createdAt: now,
      updatedAt: "2026-04-15T11:00:00.000Z",
    });

    const result = repo.getSecretRegistryRecord("secret://demo/api-key");
    assert.ok(result);
    assert.equal(result.displayName, "Updated Name");
    assert.equal(result.status, "rotating");
    assert.equal(result.currentVersion, "v2");
  } finally {
    cleanupPath(workspace);
  }
});

test("SecretRepository listSecretRegistryRecords returns all records", () => {
  const workspace = createTempWorkspace("aa-secret-registry-list-");
  const dbPath = join(workspace, "secret-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SecretRepository(db);

    repo.upsertSecretRegistryRecord({
      secretRef: "secret://demo/api-key-1",
      displayName: "API Key 1",
      category: "provider_api_key",
      providerKind: "vault",
      scopeType: "tenant",
      scopeRef: "tenant-alpha",
      status: "active",
      rotationPolicyJson: "{}",
      metadataJson: "{}",
      currentVersion: "v1",
      lastRotatedAt: now,
      nextRotationDueAt: "2026-05-15T10:00:00.000Z",
      createdAt: now,
      updatedAt: now,
    });
    repo.upsertSecretRegistryRecord({
      secretRef: "secret://demo/api-key-2",
      displayName: "API Key 2",
      category: "provider_api_key",
      providerKind: "vault",
      scopeType: "tenant",
      scopeRef: "tenant-alpha",
      status: "active",
      rotationPolicyJson: "{}",
      metadataJson: "{}",
      currentVersion: "v1",
      lastRotatedAt: now,
      nextRotationDueAt: "2026-05-15T10:00:00.000Z",
      createdAt: now,
      updatedAt: now,
    });

    const results = repo.listSecretRegistryRecords();
    assert.equal(results.length, 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("SecretRepository insertSecretUsageAudit and listSecretUsageAuditsBySecretRef", () => {
  const workspace = createTempWorkspace("aa-secret-audit-");
  const dbPath = join(workspace, "secret-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SecretRepository(db);

    // Insert parent secret registry first
    insertSecretRegistry(repo);

    repo.insertSecretUsageAudit({
      auditId: "audit-1",
      secretRef: "secret://demo/api-key",
      providerKind: "vault",
      taskId: null,
      executionId: null,
      requestedBy: "worker-1",
      grantedTo: "runtime-1",
      usagePurpose: "publish",
      resolvedAt: now,
      expiresAt: null,
      maskedValue: "****",
      metadataJson: "{\"scope\":\"ci\"}",
    });

    const results = repo.listSecretUsageAuditsBySecretRef("secret://demo/api-key");
    assert.equal(results.length, 1);
    assert.equal(results[0]?.auditId, "audit-1");
    assert.equal(results[0]?.usagePurpose, "publish");
  } finally {
    cleanupPath(workspace);
  }
});

test("SecretRepository listSecretUsageAuditsBySecretRef returns empty for non-existent", () => {
  const workspace = createTempWorkspace("aa-secret-audit-empty-");
  const dbPath = join(workspace, "secret-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SecretRepository(db);

    const results = repo.listSecretUsageAuditsBySecretRef("secret://nonexistent");
    assert.equal(results.length, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("SecretRepository insertSecretRotationEvent and listSecretRotationEventsBySecretRef", () => {
  const workspace = createTempWorkspace("aa-secret-rotation-");
  const dbPath = join(workspace, "secret-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SecretRepository(db);

    // Insert parent secret registry first
    insertSecretRegistry(repo);

    repo.insertSecretRotationEvent({
      eventId: "rotation-1",
      secretRef: "secret://demo/api-key",
      providerKind: "vault",
      rotationMode: "scheduled",
      status: "completed",
      reasonCode: "routine",
      requestedBy: "ops-1",
      previousVersion: "v1",
      nextVersion: "v2",
      occurredAt: now,
      metadataJson: null,
    });

    const results = repo.listSecretRotationEventsBySecretRef("secret://demo/api-key");
    assert.equal(results.length, 1);
    assert.equal(results[0]?.eventId, "rotation-1");
    assert.equal(results[0]?.status, "completed");
    assert.equal(results[0]?.nextVersion, "v2");
  } finally {
    cleanupPath(workspace);
  }
});

test("SecretRepository listSecretRotationEventsBySecretRef returns multiple events", () => {
  const workspace = createTempWorkspace("aa-secret-rotation-list-");
  const dbPath = join(workspace, "secret-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SecretRepository(db);

    // Insert parent secret registry first
    insertSecretRegistry(repo);

    repo.insertSecretRotationEvent({
      eventId: "rotation-1",
      secretRef: "secret://demo/api-key",
      providerKind: "vault",
      rotationMode: "scheduled",
      status: "completed",
      reasonCode: "routine",
      requestedBy: "ops-1",
      previousVersion: "v1",
      nextVersion: "v2",
      occurredAt: "2026-04-14T10:00:00.000Z",
      metadataJson: null,
    });
    repo.insertSecretRotationEvent({
      eventId: "rotation-2",
      secretRef: "secret://demo/api-key",
      providerKind: "vault",
      rotationMode: "emergency",
      status: "completed",
      reasonCode: "security_breach",
      requestedBy: "ops-1",
      previousVersion: "v2",
      nextVersion: "v3",
      occurredAt: now,
      metadataJson: null,
    });

    const results = repo.listSecretRotationEventsBySecretRef("secret://demo/api-key");
    assert.equal(results.length, 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("SecretRepository upsertSecretLeaseRecord and getSecretLeaseRecord", () => {
  const workspace = createTempWorkspace("aa-secret-lease-");
  const dbPath = join(workspace, "secret-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SecretRepository(db);

    // Insert parent secret registry first
    insertSecretRegistry(repo);

    repo.upsertSecretLeaseRecord({
      leaseId: "lease-1",
      secretRef: "secret://demo/api-key",
      providerKind: "vault",
      taskId: null,
      executionId: null,
      requestedBy: "worker-1",
      grantedTo: "runtime-1",
      usagePurpose: "publish",
      issuedAt: now,
      expiresAt: "2026-04-15T11:00:00.000Z",
      status: "active",
      revokedAt: null,
      revokedBy: null,
      revocationReasonCode: null,
      sourceVersion: "v2",
      maskedValue: "****",
      metadataJson: "{\"channel\":\"deploy\"}",
    });

    const result = repo.getSecretLeaseRecord("lease-1");
    assert.ok(result);
    assert.equal(result.leaseId, "lease-1");
    assert.equal(result.status, "active");
    assert.equal(result.sourceVersion, "v2");
  } finally {
    cleanupPath(workspace);
  }
});

test("SecretRepository upsertSecretLeaseRecord updates existing record", () => {
  const workspace = createTempWorkspace("aa-secret-lease-upd-");
  const dbPath = join(workspace, "secret-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SecretRepository(db);

    // Insert parent secret registry first
    insertSecretRegistry(repo);

    repo.upsertSecretLeaseRecord({
      leaseId: "lease-1",
      secretRef: "secret://demo/api-key",
      providerKind: "vault",
      taskId: null,
      executionId: null,
      requestedBy: "worker-1",
      grantedTo: "runtime-1",
      usagePurpose: "publish",
      issuedAt: now,
      expiresAt: "2026-04-15T11:00:00.000Z",
      status: "active",
      revokedAt: null,
      revokedBy: null,
      revocationReasonCode: null,
      sourceVersion: "v2",
      maskedValue: "****",
      metadataJson: "{}",
    });

    repo.upsertSecretLeaseRecord({
      leaseId: "lease-1",
      secretRef: "secret://demo/api-key",
      providerKind: "vault",
      taskId: null,
      executionId: null,
      requestedBy: "worker-1",
      grantedTo: "runtime-2",
      usagePurpose: "deploy",
      issuedAt: now,
      expiresAt: "2026-04-15T12:00:00.000Z",
      status: "active",
      revokedAt: null,
      revokedBy: null,
      revocationReasonCode: null,
      sourceVersion: "v2",
      maskedValue: "****",
      metadataJson: "{}",
    });

    const result = repo.getSecretLeaseRecord("lease-1");
    assert.ok(result);
    // Note: grantedTo and usagePurpose are NOT updated by upsert - only status, revoked_* fields, masked_value, metadata_json
    assert.equal(result.grantedTo, "runtime-1"); // unchanged from original insert
    assert.equal(result.status, "active"); // unchanged
  } finally {
    cleanupPath(workspace);
  }
});

test("SecretRepository listSecretLeasesBySecretRef returns all leases", () => {
  const workspace = createTempWorkspace("aa-secret-lease-list-");
  const dbPath = join(workspace, "secret-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SecretRepository(db);

    // Insert parent secret registry first
    insertSecretRegistry(repo);

    repo.upsertSecretLeaseRecord({
      leaseId: "lease-1",
      secretRef: "secret://demo/api-key",
      providerKind: "vault",
      taskId: null,
      executionId: null,
      requestedBy: "worker-1",
      grantedTo: "runtime-1",
      usagePurpose: "publish",
      issuedAt: now,
      expiresAt: "2026-04-15T11:00:00.000Z",
      status: "active",
      revokedAt: null,
      revokedBy: null,
      revocationReasonCode: null,
      sourceVersion: "v2",
      maskedValue: "****",
      metadataJson: "{}",
    });
    repo.upsertSecretLeaseRecord({
      leaseId: "lease-2",
      secretRef: "secret://demo/api-key",
      providerKind: "vault",
      taskId: null,
      executionId: null,
      requestedBy: "worker-2",
      grantedTo: "runtime-2",
      usagePurpose: "deploy",
      issuedAt: now,
      expiresAt: "2026-04-15T11:00:00.000Z",
      status: "active",
      revokedAt: null,
      revokedBy: null,
      revocationReasonCode: null,
      sourceVersion: "v2",
      maskedValue: "****",
      metadataJson: "{}",
    });

    const results = repo.listSecretLeasesBySecretRef("secret://demo/api-key");
    assert.equal(results.length, 2);
  } finally {
    cleanupPath(workspace);
  }
});
