import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { BillingServiceAsync } from "../../../../src/scale-ecosystem/marketplace/billing-service-async.js";
import { DataPlaneFlowServiceAsync } from "../../../../src/scale-ecosystem/marketplace/data-plane-flow-service-async.js";
import { PerceptionServiceAsync } from "../../../../src/scale-ecosystem/marketplace/perception-service-async.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("BillingServiceAsync wraps sync BillingService and provides async createAccount", async () => {
  const workspace = createTempWorkspace("aa-billing-async-");
  const dbPath = join(workspace, "billing-async.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const asyncService = new BillingServiceAsync(db, store);

    const result = await asyncService.createAccount({
      accountId: "acct_async_1",
      ownerId: "owner_async_1",
      planId: "pro",
    });

    assert.equal(result.accountId, "acct_async_1");
    assert.equal(result.ownerId, "owner_async_1");

    // Verify sync service is accessible
    const syncService = asyncService.getSyncService();
    assert.ok(syncService != null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("DataPlaneFlowServiceAsync wraps sync DataPlaneFlowService", async () => {
  const workspace = createTempWorkspace("aa-data-plane-async-");
  const dbPath = join(workspace, "data-plane-async.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const asyncService = new DataPlaneFlowServiceAsync(db, store);

    // Verify sync service is accessible
    const syncService = asyncService.getSyncService();
    assert.ok(syncService != null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("PerceptionServiceAsync wraps sync PerceptionService and provides async ingestIntel", async () => {
  const workspace = createTempWorkspace("aa-perception-async-");
  const dbPath = join(workspace, "perception-async.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const asyncService = new PerceptionServiceAsync(db, store);

    const source = asyncService.getSyncService().registerSource({
      sourceId: "source_async_1",
      type: "rss",
      name: "Async Test Source",
      priority: 5,
    });

    const result = await asyncService.ingestIntelAsync({
      sourceId: source.sourceId,
      items: [
        {
          title: "Async intel item",
          summary: "This intel was ingested via async wrapper",
          rawRef: "https://example.test/async",
          relevanceScore: 0.8,
          importance: 0.75,
          tags: ["async_test"],
          ttlHours: 24,
        },
      ],
    });

    assert.equal(result.insertedItems.length, 1);
    assert.equal(result.insertedItems[0]?.title, "Async intel item");

    // Verify sync service is accessible
    const syncService = asyncService.getSyncService();
    assert.ok(syncService != null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
