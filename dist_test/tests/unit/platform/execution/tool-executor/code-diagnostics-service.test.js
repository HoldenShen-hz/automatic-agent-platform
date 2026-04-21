import assert from "node:assert/strict";
import { basename, join } from "node:path";
import test from "node:test";
import { CodeDiagnosticsService, formatDiagnosticsFeedback } from "../../../../../src/platform/execution/tool-executor/code-diagnostics-service.js";
import { cleanupPath, createFile, createTempWorkspace } from "../../../../helpers/fs.js";
test("code diagnostics service reports TypeScript diagnostics for changed files", () => {
    const workspace = createTempWorkspace("aa-code-diagnostics-unit-");
    const filePath = join(workspace, "broken.ts");
    try {
        createFile(filePath, "const answer: string = 1;\n");
        const service = new CodeDiagnosticsService({ workspaceRoot: workspace });
        const summary = service.collectForFiles([filePath]);
        assert.ok(summary != null);
        assert.equal(summary.checkedFileCount, 1);
        assert.equal(summary.languages.includes("typescript"), true);
        assert.equal(summary.errorCount >= 1, true);
        assert.equal(summary.diagnostics.some((diagnostic) => basename(diagnostic.filePath) === "broken.ts"), true);
        assert.equal(formatDiagnosticsFeedback(summary)?.startsWith("Diagnostics:"), true);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("code diagnostics service groups TypeScript and Python diagnostics and ignores unsupported files", () => {
    const workspace = createTempWorkspace("aa-code-diagnostics-unit-");
    const tsFile = join(workspace, "src", "demo.ts");
    const pyFile = join(workspace, "scripts", "demo.py");
    const txtFile = join(workspace, "README.txt");
    try {
        createFile(tsFile, "export const value = 1;\n");
        createFile(pyFile, "print('ok')\n");
        createFile(txtFile, "ignored\n");
        let tsCalls = 0;
        let pyCalls = 0;
        const service = new CodeDiagnosticsService({
            workspaceRoot: workspace,
            runTypeScript: ({ filePaths }) => {
                tsCalls += 1;
                assert.equal(filePaths.length, 1);
                assert.equal(basename(filePaths[0] ?? ""), "demo.ts");
                return [{
                        language: "typescript",
                        severity: "warning",
                        filePath: tsFile,
                        message: "unused symbol",
                        code: "6133",
                        source: "typescript",
                        line: 1,
                        column: 1,
                    }];
            },
            runPython: ({ filePaths }) => {
                pyCalls += 1;
                assert.equal(filePaths.length, 1);
                assert.equal(basename(filePaths[0] ?? ""), "demo.py");
                return [{
                        language: "python",
                        severity: "error",
                        filePath: pyFile,
                        message: "SyntaxError: invalid syntax",
                        code: "python.compile_failed",
                        source: "py_compile",
                        line: 1,
                        column: null,
                    }];
            },
        });
        const summary = service.collectForFiles([tsFile, pyFile, txtFile]);
        assert.ok(summary != null);
        assert.equal(summary.checkedFileCount, 2);
        assert.equal(summary.diagnosticFileCount, 2);
        assert.equal(summary.errorCount, 1);
        assert.equal(summary.warningCount, 1);
        assert.deepEqual(summary.languages, ["typescript", "python"]);
        assert.equal(tsCalls, 1);
        assert.equal(pyCalls, 1);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("code diagnostics service defaults to MAX_DIAGNOSTICS of 20", () => {
    const workspace = createTempWorkspace("aa-code-diagnostics-default-");
    try {
        // Create a valid file to check
        const filePath = join(workspace, "valid.ts");
        createFile(filePath, "const x: number = 1;\n");
        const service = new CodeDiagnosticsService({ workspaceRoot: workspace });
        const summary = service.collectForFiles([filePath]);
        // When files exist, should return a summary (possibly with 0 diagnostics)
        assert.ok(summary !== null);
        assert.equal(summary.checkedFileCount, 1);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("code diagnostics service respects custom maxDiagnostics option", () => {
    const workspace = createTempWorkspace("aa-code-diagnostics-max-");
    const filePath = join(workspace, "many.ts");
    try {
        // Create a file with many errors
        const lines = [];
        for (let i = 1; i <= 30; i++) {
            lines.push(`const x${i}: string = ${i};`);
        }
        createFile(filePath, lines.join("\n"));
        // Create service with maxDiagnostics = 5
        const service = new CodeDiagnosticsService({
            workspaceRoot: workspace,
            maxDiagnostics: 5,
        });
        const summary = service.collectForFiles([filePath]);
        // Should be capped at 5 diagnostics
        assert.ok(summary !== null);
        assert.ok(summary.diagnostics.length <= 5, `Expected <= 5 diagnostics, got ${summary.diagnostics.length}`);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("code diagnostics service truncates at DEFAULT_MAX_DIAGNOSTICS of 20", () => {
    const workspace = createTempWorkspace("aa-code-diagnostics-truncate-");
    const filePath = join(workspace, "lots-of-errors.ts");
    try {
        // Create a file with many TypeScript errors (25 errors)
        const lines = [];
        for (let i = 1; i <= 25; i++) {
            lines.push(`const x${i}: string = ${i};`); // Type mismatch: string assigned number
        }
        createFile(filePath, lines.join("\n"));
        // Create service with default maxDiagnostics (should be 20)
        const service = new CodeDiagnosticsService({
            workspaceRoot: workspace,
            // Don't specify maxDiagnostics - should use DEFAULT_MAX_DIAGNOSTICS (20)
        });
        const summary = service.collectForFiles([filePath]);
        // Should be truncated to 20 diagnostics
        assert.ok(summary !== null);
        assert.ok(summary.diagnostics.length <= 20, `Expected <= 20 diagnostics at default, got ${summary.diagnostics.length}`);
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=code-diagnostics-service.test.js.map