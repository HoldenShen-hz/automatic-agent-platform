import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { cleanupPath, createFile, createTempWorkspace } from "../../../helpers/fs.js";
function runShadowSnapshotCli(env) {
    const stdout = execFileSync(process.execPath, [join(process.cwd(), "dist", "src", "sdk", "cli", "shadow-snapshot.js")], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            ...env,
        },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(stdout);
}
test("shadow snapshot CLI creates, lists, and restores external snapshots", () => {
    const workspace = createTempWorkspace("aa-shadow-cli-workspace-");
    const shadowRoot = createTempWorkspace("aa-shadow-cli-root-");
    try {
        const filePath = join(workspace, "src", "index.ts");
        createFile(filePath, "export const version = 1;\n");
        const created = runShadowSnapshotCli({
            AA_WORKSPACE_ROOT: workspace,
            AA_SHADOW_ROOT: shadowRoot,
            AA_SHADOW_SNAPSHOT_ACTION: "create",
            AA_SHADOW_SNAPSHOT_ID: "snapshot-cli",
            AA_SHADOW_SNAPSHOT_LABEL: "cli-checkpoint",
        });
        assert.equal(created.snapshotId, "snapshot-cli");
        assert.equal(typeof created.commitSha, "string");
        assert.equal(created.changedPaths.includes("src/index.ts"), true);
        const listed = runShadowSnapshotCli({
            AA_WORKSPACE_ROOT: workspace,
            AA_SHADOW_ROOT: shadowRoot,
            AA_SHADOW_SNAPSHOT_ACTION: "list",
        });
        assert.equal(listed.length, 1);
        assert.equal(listed[0]?.snapshotId, "snapshot-cli");
        writeFileSync(filePath, "export const version = 2;\n", "utf8");
        createFile(join(workspace, "scratch.txt"), "ephemeral\n");
        const restored = runShadowSnapshotCli({
            AA_WORKSPACE_ROOT: workspace,
            AA_SHADOW_ROOT: shadowRoot,
            AA_SHADOW_SNAPSHOT_ACTION: "restore",
            AA_SHADOW_SNAPSHOT_ID: "snapshot-cli",
        });
        assert.equal(restored.snapshotId, "snapshot-cli");
        assert.equal(typeof restored.restoredAt, "string");
        assert.equal(readFileSync(filePath, "utf8"), "export const version = 1;\n");
        assert.equal(existsSync(join(workspace, "scratch.txt")), false);
        assert.equal(existsSync(join(workspace, ".git")), false);
    }
    finally {
        cleanupPath(workspace);
        cleanupPath(shadowRoot);
    }
});
//# sourceMappingURL=shadow-snapshot-cli.test.js.map