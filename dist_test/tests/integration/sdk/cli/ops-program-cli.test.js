import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { runBuiltCliExpectFailure } from "../../../helpers/cli.js";
import { cleanupPath } from "../../../helpers/fs.js";
const repoRoot = fileURLToPath(new URL("../../../..", import.meta.url));
function runCli(env) {
    const stdout = execFileSync(process.execPath, [join(repoRoot, "dist", "src", "cli", "ops-program.js")], {
        cwd: repoRoot,
        env: {
            ...process.env,
            ...env,
        },
        encoding: "utf8",
    });
    return JSON.parse(stdout);
}
test("ops-program CLI exports industrial ops package", () => {
    const sandboxRoot = join(repoRoot, "data", "test-artifacts");
    mkdirSync(sandboxRoot, { recursive: true });
    const workspace = mkdtempSync(join(sandboxRoot, "aa-ops-program-cli-"));
    try {
        const dbPath = join(workspace, "ops-program.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        db.close();
        const artifactRoot = join(workspace, "artifacts");
        const report = runCli({
            AA_DB_PATH: dbPath,
            AA_ENVIRONMENT: "prod",
            AA_OPS_PROGRAM_ACTION: "export",
            AA_OPS_PROGRAM_ARTIFACT_ROOT: artifactRoot,
        });
        assert.ok(report.jsonArtifact?.artifactId);
        assert.ok(report.report?.programId);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("ops-program CLI fail-closes when postgres storage execution is requested", () => {
    const failure = runBuiltCliExpectFailure("ops-program.js", {
        AA_DB_PATH: "/tmp/ops-program-postgres.db",
        AA_ENVIRONMENT: "prod",
        AA_OPS_PROGRAM_ACTION: "summary",
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgresql://prod-db.example.com/agent_os?sslmode=require",
    });
    assert.notEqual(failure.status, 0);
    assert.match(failure.stderr, /storage\.(cli_sync_shadow_sqlite_required|backend_driver_not_implemented:postgres|backend_config_invalid)/);
});
//# sourceMappingURL=ops-program-cli.test.js.map