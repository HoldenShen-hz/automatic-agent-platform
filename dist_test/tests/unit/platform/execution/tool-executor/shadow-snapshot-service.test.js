import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { ShadowSnapshotService } from "../../../../../src/platform/execution/tool-executor/shadow-snapshot-service.js";
import { cleanupPath, createFile, createTempWorkspace } from "../../../../helpers/fs.js";
test("ShadowSnapshotService creates an external snapshot and keeps workspace git metadata clean", () => {
    const workspace = createTempWorkspace("aa-shadow-workspace-");
    const shadowRoot = createTempWorkspace("aa-shadow-root-");
    try {
        createFile(join(workspace, "src", "index.ts"), "export const value = 1;\n");
        const service = new ShadowSnapshotService({
            workspaceRoot: workspace,
            shadowRoot,
        });
        const snapshot = service.createSnapshot({
            snapshotId: "snapshot-initial",
            label: "initial",
            reasonCode: "operator.capture",
        });
        assert.equal(snapshot.snapshotId, "snapshot-initial");
        assert.equal(snapshot.label, "initial");
        assert.equal(snapshot.reasonCode, "operator.capture");
        assert.equal(snapshot.changedPaths.includes("src/index.ts"), true);
        assert.equal(existsSync(join(workspace, ".git")), false);
        assert.equal(existsSync(join(shadowRoot, "HEAD")), true);
        const listed = service.listSnapshots();
        assert.equal(listed.length, 1);
        assert.equal(listed[0]?.snapshotId, "snapshot-initial");
    }
    finally {
        cleanupPath(workspace);
        cleanupPath(shadowRoot);
    }
});
test("ShadowSnapshotService restores tracked files and removes untracked files", () => {
    const workspace = createTempWorkspace("aa-shadow-workspace-");
    const shadowRoot = createTempWorkspace("aa-shadow-root-");
    try {
        const trackedFile = join(workspace, "src", "index.ts");
        createFile(trackedFile, "export const value = 1;\n");
        const service = new ShadowSnapshotService({
            workspaceRoot: workspace,
            shadowRoot,
        });
        const snapshot = service.createSnapshot({
            snapshotId: "snapshot-restore",
            label: "restore-base",
        });
        writeFileSync(trackedFile, "export const value = 2;\n", "utf8");
        createFile(join(workspace, "scratch.txt"), "temporary\n");
        const restored = service.restoreSnapshot({
            snapshotId: snapshot.snapshotId,
        });
        assert.equal(restored.snapshotId, snapshot.snapshotId);
        assert.equal(readFileSync(trackedFile, "utf8"), "export const value = 1;\n");
        assert.equal(existsSync(join(workspace, "scratch.txt")), false);
    }
    finally {
        cleanupPath(workspace);
        cleanupPath(shadowRoot);
    }
});
test("ShadowSnapshotService excludes common generated directories from tracked content", () => {
    const workspace = createTempWorkspace("aa-shadow-workspace-");
    const shadowRoot = createTempWorkspace("aa-shadow-root-");
    try {
        createFile(join(workspace, "src", "index.ts"), "export const value = 1;\n");
        createFile(join(workspace, "node_modules", "pkg", "index.js"), "module.exports = 1;\n");
        const service = new ShadowSnapshotService({
            workspaceRoot: workspace,
            shadowRoot,
        });
        const snapshot = service.createSnapshot({
            snapshotId: "snapshot-ignore",
        });
        assert.equal(snapshot.changedPaths.includes("src/index.ts"), true);
        assert.equal(snapshot.changedPaths.some((path) => path.startsWith("node_modules/")), false);
        assert.equal(snapshot.excludedPaths.includes("node_modules/"), true);
    }
    finally {
        cleanupPath(workspace);
        cleanupPath(shadowRoot);
    }
});
test("ShadowSnapshotService fail-closes when a non-ignored entry exceeds the configured size budget", () => {
    const workspace = createTempWorkspace("aa-shadow-workspace-");
    const shadowRoot = createTempWorkspace("aa-shadow-root-");
    try {
        createFile(join(workspace, "src", "huge.txt"), "x".repeat(4096));
        const service = new ShadowSnapshotService({
            workspaceRoot: workspace,
            shadowRoot,
            maxEntryBytes: 512,
        });
        assert.throws(() => service.createSnapshot(), /shadow_snapshot\.entry_too_large:src/);
    }
    finally {
        cleanupPath(workspace);
        cleanupPath(shadowRoot);
    }
});
//# sourceMappingURL=shadow-snapshot-service.test.js.map