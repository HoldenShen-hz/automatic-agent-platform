import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { runSingleTaskExecution } from "../../../../../src/platform/execution/execution-engine/single-task-execution.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { getLatestSqliteMigrationVersion } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-migration-plan.js";
import { SqliteReliabilityService } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-reliability-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
test("sqlite reliability service checkpoints, backs up, and verifies the copied database", async () => {
    const workspace = createTempWorkspace("aa-sqlite-reliability-");
    const dbPath = join(workspace, "runtime.db");
    const backupPath = join(workspace, "backup", "runtime.backup.db");
    try {
        await runSingleTaskExecution({
            dbPath,
            title: "Reliability backup test",
            request: "Create a stable backup validation baseline.",
        });
        const db = new SqliteDatabase(dbPath);
        const reliability = new SqliteReliabilityService(db);
        const report = reliability.getReport();
        const backup = reliability.createBackup(backupPath);
        const latestSchemaVersion = getLatestSqliteMigrationVersion();
        assert.equal(report.integrityPassed, true);
        assert.equal(report.schemaStatus.upToDate, true);
        assert.equal(report.schemaStatus.expectedVersion, latestSchemaVersion);
        assert.equal(report.appliedMigrations.length, latestSchemaVersion);
        assert.equal(backup.valid, true);
        assert.equal(existsSync(backupPath), true);
        assert.ok(backup.sizeBytes > 0);
        assert.deepEqual(backup.sourceIntegrity, ["ok"]);
        assert.deepEqual(backup.backupIntegrity, ["ok"]);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=sqlite-reliability.test.js.map