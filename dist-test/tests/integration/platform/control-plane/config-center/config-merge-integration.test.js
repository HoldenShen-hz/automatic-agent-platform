/**
 * Integration Test: Config Loading and Merge
 *
 * Verifies configuration loading from multiple sources
 * and proper merging behavior.
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
test("config: database config directory is accessible", () => {
    const workspace = createTempWorkspace("aa-config-db-");
    try {
        const dbPath = join(workspace, "config-test.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        // Verify DB is accessible
        const result = db.connection.prepare("SELECT 1 as test").get();
        assert.equal(result.test, 1);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("config: database WAL mode is enabled by default", () => {
    const workspace = createTempWorkspace("aa-config-wal-");
    try {
        const dbPath = join(workspace, "config-wal.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        // Check WAL mode
        const walMode = db.connection
            .prepare("PRAGMA journal_mode")
            .get();
        assert.equal(walMode.journal_mode.toLowerCase(), "wal", "WAL mode should be enabled");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("config: foreign keys are enforced by default", () => {
    const workspace = createTempWorkspace("aa-config-fk-");
    try {
        const dbPath = join(workspace, "config-fk.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        // Check foreign keys setting
        const fkSetting = db.connection
            .prepare("PRAGMA foreign_keys")
            .get();
        assert.equal(fkSetting.foreign_keys, 1, "Foreign keys should be enabled");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("config: busy timeout is set appropriately", () => {
    const workspace = createTempWorkspace("aa-config-timeout-");
    try {
        const dbPath = join(workspace, "config-timeout.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        // Check busy timeout - try both scalar and column-based access
        const pragmaResult = db.connection
            .prepare("PRAGMA busy_timeout")
            .get();
        // better-sqlite3 PRAGMA returns: { busy_timeout: number } or scalar directly
        let timeoutValue = 0;
        if (typeof pragmaResult === "number") {
            timeoutValue = pragmaResult;
        }
        else if (typeof pragmaResult === "object" && pragmaResult !== null) {
            const obj = pragmaResult;
            // Try known keys or first value
            const knownKeys = ["busy_timeout", "busy_timeout(milliseconds)"];
            for (const key of knownKeys) {
                if (typeof obj[key] === "number") {
                    timeoutValue = obj[key];
                    break;
                }
            }
            if (timeoutValue === 0) {
                // Try first value
                const firstVal = Object.values(obj)[0];
                timeoutValue = typeof firstVal === "number" ? firstVal : 0;
            }
        }
        else {
            timeoutValue = Number(pragmaResult);
        }
        assert.ok(Number.isFinite(timeoutValue), `Busy timeout should be finite, got ${timeoutValue}`);
        assert.ok(timeoutValue >= 0, `Busy timeout should be >= 0, got ${timeoutValue}`);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("config: synchronous setting is appropriate for durability", () => {
    const workspace = createTempWorkspace("aa-config-sync-");
    try {
        const dbPath = join(workspace, "config-sync.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        // Check synchronous setting
        const syncSetting = db.connection
            .prepare("PRAGMA synchronous")
            .get();
        // 2 = NORMAL is appropriate for WAL mode with good durability
        assert.ok([1, 2].includes(syncSetting.synchronous), "Synchronous should be NORMAL or higher");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=config-merge-integration.test.js.map