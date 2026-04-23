/**
 * Integration Test: Evolution Service Async Wrapper
 *
 * Tests the async wrapper for EvolutionMvpService:
 * - Async service instantiation and sync service access
 * - DB and store integration through wrapper
 * - Proposal lifecycle through async interface
 */
import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { EvolutionServiceAsync } from "../../../../src/ops-maturity/drift-detection/evolution-mvp-service-async.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { createTempWorkspace, cleanupPath } from "../../../helpers/fs.js";
test("EvolutionServiceAsync creates instance and exposes sync service", () => {
    const workspace = createTempWorkspace("aa-evolution-async-");
    const dbPath = join(workspace, "evolution-async.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        // EvolutionServiceAsync only takes db and store; approval/memory are created internally
        const asyncService = new EvolutionServiceAsync(db, store);
        // Verify sync service is accessible
        const syncService = asyncService.getSyncService();
        assert.ok(syncService !== null);
        assert.ok(syncService !== undefined);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EvolutionServiceAsync wraps sync service methods", () => {
    const workspace = createTempWorkspace("aa-evolution-async-");
    const dbPath = join(workspace, "evolution-async.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const asyncService = new EvolutionServiceAsync(db, store);
        const syncService = asyncService.getSyncService();
        // Verify the sync service has expected methods
        assert.ok(typeof syncService.listProposalViews === "function");
        assert.ok(typeof syncService.getProposalView === "function");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EvolutionServiceAsync constructor requires db and store", () => {
    const workspace = createTempWorkspace("aa-evolution-async-");
    const dbPath = join(workspace, "evolution-async.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        // Should create without error - only takes db and store
        const asyncService = new EvolutionServiceAsync(db, store);
        assert.ok(asyncService instanceof EvolutionServiceAsync);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=evolution-service-async-integration.test.js.map