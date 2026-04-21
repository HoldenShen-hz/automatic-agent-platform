import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createWorkspaceWritePolicy } from "../../../../src/platform/control-plane/iam/sandbox-policy.js";
import { StorageQuotaService } from "../../../../src/platform/state-evidence/truth/storage-quota-service.js";
import { cleanupPath, createFile, createSymlink, createTempWorkspace } from "../../../helpers/fs.js";
test("storage quota service blocks quota roots outside the workspace sandbox", () => {
    const workspace = createTempWorkspace("aa-storage-quota-sec-");
    const outside = createTempWorkspace("aa-storage-quota-outside-");
    try {
        createFile(join(outside, "artifacts", "task-1", "artifact.txt"), "outside");
        const service = new StorageQuotaService({
            sandboxPolicy: createWorkspaceWritePolicy(workspace),
            categories: [
                {
                    categoryId: "artifact",
                    roots: [join(outside, "artifacts")],
                    maxBytes: 64,
                    cleanupEnabled: true,
                },
            ],
        });
        assert.throws(() => service.enforce(), /sandbox\.path_outside_allowed_roots/);
    }
    finally {
        cleanupPath(workspace);
        cleanupPath(outside);
    }
});
test("storage quota service blocks symlink escapes inside managed roots", () => {
    const workspace = createTempWorkspace("aa-storage-quota-sec-");
    const outside = createTempWorkspace("aa-storage-quota-target-");
    try {
        const artifactRoot = join(workspace, "artifacts");
        createFile(join(artifactRoot, "task-1", "artifact.txt"), "inside");
        createFile(join(outside, "escaped.txt"), "outside");
        rmSync(join(artifactRoot, "task-1", "artifact.txt"));
        createSymlink(join(outside, "escaped.txt"), join(artifactRoot, "task-1", "artifact.txt"));
        const service = new StorageQuotaService({
            sandboxPolicy: createWorkspaceWritePolicy(workspace),
            categories: [
                {
                    categoryId: "artifact",
                    roots: [artifactRoot],
                    maxBytes: 64,
                    cleanupEnabled: true,
                },
            ],
        });
        assert.throws(() => service.enforce(), /sandbox\.path_outside_allowed_roots|sandbox\.symlink_denied|Path access denied/);
    }
    finally {
        cleanupPath(workspace);
        cleanupPath(outside);
    }
});
//# sourceMappingURL=storage-quota-service.test.js.map