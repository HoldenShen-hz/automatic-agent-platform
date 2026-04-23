import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
function runCli(env) {
    const stdout = execFileSync(process.execPath, [join(process.cwd(), "dist", "src", "sdk", "cli", "gateway-targets.js")], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            ...env,
        },
        encoding: "utf8",
    });
    return JSON.parse(stdout);
}
function runCliExpectFailure(env) {
    try {
        execFileSync(process.execPath, [join(process.cwd(), "dist", "src", "sdk", "cli", "gateway-targets.js")], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                ...env,
            },
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        });
        throw new Error("expected_cli_failure:gateway-targets.js");
    }
    catch (error) {
        if (error instanceof Error && error.message === "expected_cli_failure:gateway-targets.js") {
            throw error;
        }
        const failure = error;
        return {
            stderr: failure.stderr ?? "",
            status: failure.status ?? 1,
        };
    }
}
test("gateway targets CLI can upsert list and resolve canonical targets", () => {
    const workspace = createTempWorkspace("aa-gateway-targets-cli-");
    const dbPath = join(workspace, "gateway-targets-cli.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        db.close();
        const created = runCli({
            AA_DB_PATH: dbPath,
            AA_GATEWAY_TARGET_ACTION: "upsert",
            AA_GATEWAY_CHANNEL: "telegram",
            AA_GATEWAY_TARGET_KIND: "user",
            AA_GATEWAY_EXTERNAL_TARGET_ID: "finance-team",
            AA_GATEWAY_DISPLAY_NAME: "Finance Team",
            AA_GATEWAY_ALIASES_JSON: JSON.stringify(["finance", "fin-team"]),
        });
        assert.equal(created.displayName, "Finance Team");
        assert.match(created.targetId, /^telegram:user:/);
        const listed = runCli({
            AA_DB_PATH: dbPath,
            AA_GATEWAY_TARGET_ACTION: "list",
            AA_GATEWAY_CHANNEL: "telegram",
        });
        assert.ok(listed.some((entry) => entry.targetId === created.targetId));
        const resolved = runCli({
            AA_DB_PATH: dbPath,
            AA_GATEWAY_TARGET_ACTION: "resolve",
            AA_GATEWAY_CHANNEL: "telegram",
            AA_GATEWAY_QUERY: "finance",
        });
        assert.equal(resolved.entry.targetId, created.targetId);
        assert.equal(resolved.matchedBy, "alias_exact");
        const db2 = new SqliteDatabase(dbPath);
        db2.migrate();
        const store2 = new AuthoritativeTaskStore(db2);
        assert.ok(store2.getGatewayTarget(created.targetId));
        db2.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("gateway targets CLI fail-closes when postgres storage execution is requested", () => {
    const failure = runCliExpectFailure({
        AA_GATEWAY_TARGET_ACTION: "list",
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgresql://prod-db.example.com/agent_os?sslmode=require",
    });
    assert.notEqual(failure.status, 0);
    assert.match(failure.stderr, /storage\.(cli_sync_shadow_sqlite_required|backend_driver_not_implemented:postgres|backend_config_invalid)/);
});
//# sourceMappingURL=gateway-targets-cli.test.js.map