import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { GatewayTargetDirectoryService } from "../../../../src/platform/interface/channel-gateway/gateway-target-directory-service.js";
import { runBuiltCliExpectFailure } from "../../../helpers/cli.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
function runCli(env) {
    const stdout = execFileSync(process.execPath, [join(process.cwd(), "dist", "src", "cli", "channel-gateway.js")], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            ...env,
        },
        encoding: "utf8",
    });
    return JSON.parse(stdout);
}
test("channel-gateway CLI sends webhook messages through the persisted target directory", async () => {
    const workspace = createTempWorkspace("aa-channel-gateway-cli-");
    const dbPath = join(workspace, "channel-gateway-cli.db");
    const capturePath = join(workspace, "channel-gateway-capture.json");
    const mockFetchPath = join(workspace, "mock-fetch.mjs");
    const sinkUrl = "https://gateway.example.test/cli-hook";
    try {
        writeFileSync(mockFetchPath, `
        import { readFileSync, writeFileSync } from "node:fs";

        const capturePath = process.env.AA_FETCH_CAPTURE_PATH;
        globalThis.fetch = async (input, init) => {
          const current = (() => {
            try {
              return JSON.parse(readFileSync(capturePath, "utf8"));
            } catch {
              return [];
            }
          })();
          current.push({
            url: typeof input === "string" ? input : input.toString(),
            headers: Object.fromEntries(
              Object.entries(init?.headers ?? {}).map(([name, value]) => [String(name).toLowerCase(), String(value)]),
            ),
            body: init?.body ? JSON.parse(String(init.body)) : null,
          });
          writeFileSync(capturePath, JSON.stringify(current, null, 2), "utf8");
          return new Response(JSON.stringify({ ok: true }), {
            status: 202,
            headers: {
              "content-type": "application/json",
            },
          });
        };
      `, "utf8");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const targets = new GatewayTargetDirectoryService(store);
        const target = targets.registerTarget({
            channel: "webhook",
            targetKind: "room",
            externalTargetId: sinkUrl,
            displayName: "CLI Hook",
            aliases: ["cli-hook"],
        });
        db.close();
        const result = runCli({
            AA_DB_PATH: dbPath,
            AA_GATEWAY_CHANNEL: "webhook",
            AA_GATEWAY_QUERY: "cli-hook",
            AA_GATEWAY_MESSAGE: "CLI webhook delivery",
            AA_GATEWAY_WEBHOOK_DEFAULT_HEADERS_JSON: JSON.stringify({
                "x-cli-source": "channel-gateway-cli",
            }),
            AA_FETCH_CAPTURE_PATH: capturePath,
            NODE_OPTIONS: `--import=${mockFetchPath}`,
        });
        const received = JSON.parse(readFileSync(capturePath, "utf8"));
        assert.equal(result.channel, "webhook");
        assert.equal(result.targetId, target.targetId);
        assert.equal(result.requestUrl, sinkUrl);
        assert.equal(result.responseStatus, 202);
        assert.equal(received.length, 1);
        assert.equal(received[0]?.url, sinkUrl);
        assert.equal(received[0]?.headers["x-cli-source"], "channel-gateway-cli");
        assert.deepEqual(received[0]?.body, {
            targetId: target.targetId,
            text: "CLI webhook delivery",
            metadata: {},
        });
    }
    finally {
        cleanupPath(workspace);
    }
});
test("channel-gateway CLI fail-closes when postgres storage execution is requested", () => {
    const failure = runBuiltCliExpectFailure("channel-gateway.js", {
        AA_DB_PATH: "/tmp/channel-gateway-postgres.db",
        AA_GATEWAY_MESSAGE: "forbidden",
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgresql://prod-db.example.com/agent_os?sslmode=require",
    });
    assert.notEqual(failure.status, 0);
    assert.match(failure.stderr, /storage\.(cli_sync_shadow_sqlite_required|backend_driver_not_implemented:postgres|backend_config_invalid)/);
});
//# sourceMappingURL=channel-gateway-cli.test.js.map