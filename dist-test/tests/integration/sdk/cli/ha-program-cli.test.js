import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { runBuiltCliExpectFailure } from "../../../helpers/cli.js";
import { cleanupPath } from "../../../helpers/fs.js";
const repoRoot = process.cwd();
function runCli(env) {
    const stdout = execFileSync(process.execPath, [join(repoRoot, "dist", "src", "sdk", "cli", "ha-program.js")], {
        cwd: repoRoot,
        env: {
            ...process.env,
            ...env,
        },
        encoding: "utf8",
    });
    return JSON.parse(stdout);
}
test("ha-program CLI exports HA transition package", () => {
    const sandboxRoot = join(repoRoot, "data", "test-artifacts");
    mkdirSync(sandboxRoot, { recursive: true });
    const workspace = mkdtempSync(join(sandboxRoot, "aa-ha-program-cli-"));
    try {
        const dbPath = join(workspace, "ha-program.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        db.close();
        const artifactRoot = join(workspace, "artifacts");
        const report = runCli({
            AA_DB_PATH: dbPath,
            AA_ENVIRONMENT: "prod",
            AA_HA_PROGRAM_ACTION: "export",
            AA_HA_PROGRAM_ARTIFACT_ROOT: artifactRoot,
        });
        assert.ok(report.jsonArtifact?.artifactId);
        assert.equal(report.report?.components.length, 4);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("ha-program CLI fail-closes when postgres storage execution is requested", () => {
    const failure = runBuiltCliExpectFailure("ha-program.js", {
        AA_DB_PATH: "/tmp/ha-program-postgres.db",
        AA_ENVIRONMENT: "prod",
        AA_HA_PROGRAM_ACTION: "summary",
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgresql://prod-db.example.com/agent_os?sslmode=require",
    });
    assert.notEqual(failure.status, 0);
    assert.match(failure.stderr, /storage\.(cli_sync_shadow_sqlite_required|backend_driver_not_implemented:postgres|backend_config_invalid)/);
});
//# sourceMappingURL=ha-program-cli.test.js.map