import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { CodeDiagnosticsService } from "../../../../src/platform/execution/tool-executor/code-diagnostics-service.js";
import { cleanupPath, createFile, createTempWorkspace } from "../../../helpers/fs.js";
test("code diagnostics service keeps diagnostics scans inside the workspace boundary", async () => {
    const workspace = createTempWorkspace("aa-code-diagnostics-security-");
    const outsideWorkspace = createTempWorkspace("aa-code-diagnostics-outside-");
    const insideFile = join(workspace, "safe.ts");
    const outsideFile = join(outsideWorkspace, "escape.ts");
    try {
        createFile(insideFile, "export const safe = true;\n");
        createFile(outsideFile, "export const escape = true;\n");
        let tsCalls = 0;
        const service = new CodeDiagnosticsService({
            workspaceRoot: workspace,
            runTypeScript: ({ filePaths }) => {
                tsCalls += 1;
                assert.deepEqual(filePaths, [insideFile]);
                return [];
            },
        });
        const summary = await service.collectForFiles([insideFile, outsideFile]);
        assert.ok(summary != null);
        assert.equal(summary.checkedFileCount, 1);
        assert.equal(summary.diagnostics.length, 0);
        assert.equal(tsCalls, 1);
    }
    finally {
        cleanupPath(workspace);
        cleanupPath(outsideWorkspace);
    }
});
//# sourceMappingURL=code-diagnostics-service.test.js.map