/**
 * Contract Test: Gateway Storage Port Adapter
 *
 * Verifies the GatewayStorageAdapter correctly implements the GatewayStoragePort
 * interface and correctly delegates to AuthoritativeTaskStore.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { GatewayStorageAdapter } from "../../../../src/platform/five-plane-interface/channel-gateway/storage-adapter.js";
import { GatewayStoragePort } from "../../../../src/platform/five-plane-interface/channel-gateway/storage-port.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import type { GatewayTargetRecord } from "../../../../src/platform/contracts/types/domain.js";

test("contract: GatewayStorageAdapter implements GatewayStoragePort interface", () => {
  const workspace = createTempWorkspace("aa-gateway-contract-");
  try {
    const db = new SqliteDatabase(join(workspace, "gateway-contract.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const adapter = new GatewayStorageAdapter(store);

    // Verify adapter has all required interface methods
    assert.equal(typeof adapter.getGatewayTarget, "function");
    assert.equal(typeof adapter.upsertGatewayTarget, "function");
    assert.equal(typeof adapter.listGatewayTargets, "function");
    assert.equal(typeof adapter.listGatewaySessionTargetCandidates, "function");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("contract: GatewayStorageAdapter.getGatewayTarget returns null for nonexistent target", () => {
  const workspace = createTempWorkspace("aa-gateway-contract-get-");
  try {
    const db = new SqliteDatabase(join(workspace, "gateway-contract-get.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const adapter = new GatewayStorageAdapter(store);

    const result = adapter.getGatewayTarget("nonexistent-target");
    assert.equal(result, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("contract: GatewayStorageAdapter.upsertGatewayTarget stores and retrieves target", () => {
  const workspace = createTempWorkspace("aa-gateway-contract-upsert-");
  try {
    const db = new SqliteDatabase(join(workspace, "gateway-contract-upsert.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const adapter = new GatewayStorageAdapter(store);

    const target: GatewayTargetRecord = {
      targetId: "test-target-1",
      channel: "cli",
      targetKind: "session",
      externalTargetId: null,
      displayName: "Test Target",
      aliasesJson: "[]",
      metadataJson: null,
      source: "directory",
      lastSeenAt: null,
      createdAt: "2026-04-15T10:00:00.000Z",
      updatedAt: "2026-04-15T10:00:00.000Z",
    };

    adapter.upsertGatewayTarget(target);

    const retrieved = adapter.getGatewayTarget("test-target-1");
    assert.ok(retrieved, "Should retrieve stored target");
    assert.equal(retrieved!.targetId, "test-target-1");
    assert.equal(retrieved!.channel, "cli");
    assert.equal(retrieved!.displayName, "Test Target");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("contract: GatewayStorageAdapter.listGatewayTargets returns stored targets", () => {
  const workspace = createTempWorkspace("aa-gateway-contract-list-");
  try {
    const db = new SqliteDatabase(join(workspace, "gateway-contract-list.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const adapter = new GatewayStorageAdapter(store);

    // Insert multiple targets
    adapter.upsertGatewayTarget({
      targetId: "target-1",
      channel: "cli",
      targetKind: "session",
      externalTargetId: null,
      displayName: "Target 1",
      aliasesJson: "[]",
      metadataJson: null,
      source: "directory",
      lastSeenAt: null,
      createdAt: "2026-04-15T10:00:00.000Z",
      updatedAt: "2026-04-15T10:00:00.000Z",
    });

    adapter.upsertGatewayTarget({
      targetId: "target-2",
      channel: "web",
      targetKind: "user",
      externalTargetId: null,
      displayName: "Target 2",
      aliasesJson: "[]",
      metadataJson: null,
      source: "directory",
      lastSeenAt: null,
      createdAt: "2026-04-15T10:00:00.000Z",
      updatedAt: "2026-04-15T10:00:00.000Z",
    });

    const allTargets = adapter.listGatewayTargets();
    assert.ok(allTargets.length >= 2, "Should return at least 2 targets");

    const cliTargets = adapter.listGatewayTargets(100, "cli");
    assert.ok(cliTargets.length >= 1, "Should return at least 1 CLI target");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("contract: GatewayStorageAdapter.upsertGatewayTarget updates existing target", () => {
  const workspace = createTempWorkspace("aa-gateway-contract-update-");
  try {
    const db = new SqliteDatabase(join(workspace, "gateway-contract-update.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const adapter = new GatewayStorageAdapter(store);

    adapter.upsertGatewayTarget({
      targetId: "update-target",
      channel: "cli",
      targetKind: "session",
      externalTargetId: null,
      displayName: "Original Name",
      aliasesJson: "[]",
      metadataJson: null,
      source: "directory",
      lastSeenAt: null,
      createdAt: "2026-04-15T10:00:00.000Z",
      updatedAt: "2026-04-15T10:00:00.000Z",
    });

    adapter.upsertGatewayTarget({
      targetId: "update-target",
      channel: "cli",
      targetKind: "session",
      externalTargetId: null,
      displayName: "Updated Name",
      aliasesJson: "[]",
      metadataJson: null,
      source: "directory",
      lastSeenAt: null,
      createdAt: "2026-04-15T10:00:00.000Z",
      updatedAt: "2026-04-15T11:00:00.000Z",
    });

    const retrieved = adapter.getGatewayTarget("update-target");
    assert.equal(retrieved!.displayName, "Updated Name");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
