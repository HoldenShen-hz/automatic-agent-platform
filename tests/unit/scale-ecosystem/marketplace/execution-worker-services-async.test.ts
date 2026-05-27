/**
 * Unit tests for Execution Worker Async Services
 *
 * Tests for:
 * - execution-dispatch-service-async.ts
 * - execution-worker-handshake-service-async.ts
 * - execution-worker-writeback-service-async.ts
 * - human-takeover-service-async.ts
 * - tenant-platform-service-async.ts
 *
 * @see src/scale-ecosystem/marketplace/
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { ExecutionDispatchServiceAsync } from "../../../../src/scale-ecosystem/marketplace/execution-dispatch-service-async.js";
import { ExecutionWorkerHandshakeServiceAsync } from "../../../../src/scale-ecosystem/marketplace/execution-worker-handshake-service-async.js";
import { ExecutionWorkerWritebackServiceAsync } from "../../../../src/scale-ecosystem/marketplace/execution-worker-writeback-service-async.js";
import { HumanTakeoverServiceAsync } from "../../../../src/scale-ecosystem/marketplace/human-takeover-service-async.js";
import { TenantPlatformServiceAsync } from "../../../../src/scale-ecosystem/marketplace/tenant-platform-service-async.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

function disposeAsyncService(service: unknown): void {
  if (typeof (service as { dispose?: () => void }).dispose === "function") {
    (service as { dispose: () => void }).dispose();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ExecutionDispatchServiceAsync Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ExecutionDispatchServiceAsync getSyncService returns sync service [execution-worker-services-async]", () => {
  const workspace = createTempWorkspace("aa-exec-dispatch-");
  const dbPath = join(workspace, "exec-dispatch.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new ExecutionDispatchServiceAsync(db, store);
    const syncService = service.getSyncService();

    assert.ok(syncService != null);

    disposeAsyncService(service);
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ExecutionWorkerHandshakeServiceAsync Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ExecutionWorkerHandshakeServiceAsync getSyncService returns sync service [execution-worker-services-async]", () => {
  const workspace = createTempWorkspace("aa-exec-handshake-");
  const dbPath = join(workspace, "exec-handshake.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new ExecutionWorkerHandshakeServiceAsync(db, store);
    const syncService = service.getSyncService();

    assert.ok(syncService != null);

    disposeAsyncService(service);
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ExecutionWorkerWritebackServiceAsync Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ExecutionWorkerWritebackServiceAsync getSyncService returns sync service [execution-worker-services-async]", () => {
  const workspace = createTempWorkspace("aa-exec-writeback-");
  const dbPath = join(workspace, "exec-writeback.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new ExecutionWorkerWritebackServiceAsync(db, store);
    const syncService = service.getSyncService();

    assert.ok(syncService != null);

    disposeAsyncService(service);
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HumanTakeoverServiceAsync Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HumanTakeoverServiceAsync getSyncService returns sync service [execution-worker-services-async]", () => {
  const workspace = createTempWorkspace("aa-human-takeover-");
  const dbPath = join(workspace, "human-takeover.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HumanTakeoverServiceAsync(db, store);
    const syncService = service.getSyncService();

    assert.ok(syncService != null);

    disposeAsyncService(service);
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TenantPlatformServiceAsync Tests
// ─────────────────────────────────────────────────────────────────────────────

test("TenantPlatformServiceAsync getSyncService returns sync service [execution-worker-services-async]", () => {
  const workspace = createTempWorkspace("aa-tenant-platform-");
  const dbPath = join(workspace, "tenant-platform.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new TenantPlatformServiceAsync(db, store);
    const syncService = service.getSyncService();

    assert.ok(syncService != null);

    disposeAsyncService(service);
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
