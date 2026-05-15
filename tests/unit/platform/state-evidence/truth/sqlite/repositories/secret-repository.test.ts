import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SecretRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/secret-repository.js";
import { SqliteDatabase } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../../helpers/fs.js";
import type { SecretRegistryRecord } from "../../../../../../../src/platform/contracts/types/domain.js";

test("SecretRepository upsertSecretRegistryRecord and getSecretRegistryRecord work", () => {
  const workspace = createTempWorkspace("aa-secret-repo-");
  const dbPath = join(workspace, "secret.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SecretRepository(db);
    const now = "2026-04-14T10:00:00.000Z";

    const secret: SecretRegistryRecord = {
      secretRef: "secret-ref-1",
      displayName: "Database Password",
      category: "credential",
      providerKind: "vault",
      scopeType: "workspace",
      scopeRef: "ws-1",
      status: "active",
      rotationPolicyJson: '{"rotation_interval_days":90}',
      metadataJson: '{"owner":"team-a"}',
      currentVersion: 1,
      lastRotatedAt: now,
      nextRotationDueAt: now,
      createdAt: now,
      updatedAt: now,
    };

    repo.upsertSecretRegistryRecord(secret);

    const result = repo.getSecretRegistryRecord("secret-ref-1");
    assert.ok(result);
    assert.equal(result.displayName, "Database Password");
    assert.equal(result.category, "credential");
    assert.equal(Number(result.currentVersion), 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("SecretRepository upsertSecretRegistryRecord updates existing record", () => {
  const workspace = createTempWorkspace("aa-secret-repo-");
  const dbPath = join(workspace, "secret.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SecretRepository(db);
    const now = "2026-04-14T10:00:00.000Z";
    const later = "2026-04-14T12:00:00.000Z";

    repo.upsertSecretRegistryRecord({
      secretRef: "secret-upsert-1",
      displayName: "Original Name",
      category: "credential",
      providerKind: "vault",
      scopeType: "workspace",
      scopeRef: "ws-1",
      status: "active",
      rotationPolicyJson: "{}",
      metadataJson: "{}",
      currentVersion: 1,
      lastRotatedAt: now,
      nextRotationDueAt: now,
      createdAt: now,
      updatedAt: now,
    });

    repo.upsertSecretRegistryRecord({
      secretRef: "secret-upsert-1",
      displayName: "Updated Name",
      category: "credential",
      providerKind: "vault",
      scopeType: "workspace",
      scopeRef: "ws-1",
      status: "active",
      rotationPolicyJson: "{}",
      metadataJson: "{}",
      currentVersion: 2,
      lastRotatedAt: later,
      nextRotationDueAt: later,
      createdAt: now,
      updatedAt: later,
    });

    const result = repo.getSecretRegistryRecord("secret-upsert-1");
    assert.ok(result);
    assert.equal(result.displayName, "Updated Name");
    assert.equal(Number(result.currentVersion), 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("SecretRepository getSecretRegistryRecord returns null for non-existent", () => {
  const workspace = createTempWorkspace("aa-secret-repo-");
  const dbPath = join(workspace, "secret.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SecretRepository(db);

    const result = repo.getSecretRegistryRecord("nonexistent");
    assert.strictEqual(result, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("SecretRepository listSecretRegistryRecords returns all records", () => {
  const workspace = createTempWorkspace("aa-secret-repo-");
  const dbPath = join(workspace, "secret.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SecretRepository(db);
    const now = "2026-04-14T10:00:00.000Z";

    repo.upsertSecretRegistryRecord({
      secretRef: "secret-list-1",
      displayName: "Secret 1",
      category: "credential",
      providerKind: "vault",
      scopeType: "workspace",
      scopeRef: "ws-1",
      status: "active",
      rotationPolicyJson: "{}",
      metadataJson: "{}",
      currentVersion: 1,
      lastRotatedAt: now,
      nextRotationDueAt: now,
      createdAt: now,
      updatedAt: now,
    });

    repo.upsertSecretRegistryRecord({
      secretRef: "secret-list-2",
      displayName: "Secret 2",
      category: "api_key",
      providerKind: "aws",
      scopeType: "workspace",
      scopeRef: "ws-1",
      status: "active",
      rotationPolicyJson: "{}",
      metadataJson: "{}",
      currentVersion: 1,
      lastRotatedAt: now,
      nextRotationDueAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const results = repo.listSecretRegistryRecords();
    assert.equal(results.length, 2);
  } finally {
    cleanupPath(workspace);
  }
});
