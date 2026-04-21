import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
test("worker handshake CLI fails closed on malformed remote log payloads", () => {
    const workspace = createTempWorkspace("aa-remote-log-cli-security-");
    const dbPath = join(workspace, "remote-log-cli-security.db");
    try {
        assert.throws(() => execFileSync(process.execPath, [join(process.cwd(), "dist", "src", "cli", "worker-handshake.js")], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                AA_DB_PATH: dbPath,
                AA_WORKER_HANDSHAKE_ACTION: "claim",
                AA_WORKER_ID: "worker-test",
                AA_LEASE_ID: "lease-test",
                AA_FENCING_TOKEN: "1",
                AA_REMOTE_LOGS_JSON: "{\"level\":\"info\"}",
            },
            encoding: "utf8",
        }), /invalid_env:AA_REMOTE_LOGS_JSON/);
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=remote-log-cli-validation.test.js.map