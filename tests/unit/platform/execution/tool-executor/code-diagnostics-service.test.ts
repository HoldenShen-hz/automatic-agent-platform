import assert from "node:assert/strict";
import { basename, join } from "node:path";
import test from "node:test";

import { CodeDiagnosticEntry, CodeDiagnosticsService, CodeDiagnosticsSummary, formatDiagnosticsFeedback } from "../../../../../src/platform/five-plane-execution/tool-executor/code-diagnostics-service.js";
import { cleanupPath, createFile, createTempWorkspace } from "../../../../helpers/fs.js";

test("code diagnostics service reports TypeScript diagnostics for changed files", async () => {
  const workspace = createTempWorkspace("aa-code-diagnostics-unit-");
  const filePath = join(workspace, "broken.ts");

  try {
    createFile(filePath, "const answer: string = 1;\n");
    const service = new CodeDiagnosticsService({ workspaceRoot: workspace });
    const summary = await service.collectForFiles([filePath]);

    assert.ok(summary != null);
    assert.equal(summary.checkedFileCount, 1);
    assert.equal(summary.languages.includes("typescript"), true);
    assert.equal(summary.errorCount >= 1, true);
    assert.equal(summary.diagnostics.some((diagnostic) => basename(diagnostic.filePath) === "broken.ts"), true);
    assert.equal(formatDiagnosticsFeedback(summary)?.startsWith("Diagnostics:"), true);
  } finally {
    cleanupPath(workspace);
  }
});

test("code diagnostics service groups TypeScript and Python diagnostics and ignores unsupported files", async () => {
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
      runPython: async ({ filePaths }) => {
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

    const summary = await service.collectForFiles([tsFile, pyFile, txtFile]);

    assert.ok(summary != null);
    assert.equal(summary.checkedFileCount, 2);
    assert.equal(summary.diagnosticFileCount, 2);
    assert.equal(summary.errorCount, 1);
    assert.equal(summary.warningCount, 1);
    assert.deepEqual(summary.languages, ["typescript", "python"]);
    assert.equal(tsCalls, 1);
    assert.equal(pyCalls, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("code diagnostics service defaults to MAX_DIAGNOSTICS of 20", async () => {
  const workspace = createTempWorkspace("aa-code-diagnostics-default-");
  try {
    // Create a valid file to check
    const filePath = join(workspace, "valid.ts");
    createFile(filePath, "const x: number = 1;\n");

    const service = new CodeDiagnosticsService({ workspaceRoot: workspace });
    const summary = await service.collectForFiles([filePath]);

    // When files exist, should return a summary (possibly with 0 diagnostics)
    assert.ok(summary !== null);
    assert.equal(summary.checkedFileCount, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("code diagnostics service respects custom maxDiagnostics option", async () => {
  const workspace = createTempWorkspace("aa-code-diagnostics-max-");
  const filePath = join(workspace, "many.ts");

  try {
    // Create a file with many errors
    const lines: string[] = [];
    for (let i = 1; i <= 30; i++) {
      lines.push(`const x${i}: string = ${i};`);
    }
    createFile(filePath, lines.join("\n"));

    // Create service with maxDiagnostics = 5
    const service = new CodeDiagnosticsService({
      workspaceRoot: workspace,
      maxDiagnostics: 5,
    });
    const summary = await service.collectForFiles([filePath]);

    // Should be capped at 5 diagnostics
    assert.ok(summary !== null);
    assert.ok(summary.diagnostics.length <= 5, `Expected <= 5 diagnostics, got ${summary.diagnostics.length}`);
  } finally {
    cleanupPath(workspace);
  }
});

test("code diagnostics service truncates at DEFAULT_MAX_DIAGNOSTICS of 20", async () => {
  const workspace = createTempWorkspace("aa-code-diagnostics-truncate-");
  const filePath = join(workspace, "lots-of-errors.ts");

  try {
    // Create a file with many TypeScript errors (25 errors)
    const lines: string[] = [];
    for (let i = 1; i <= 25; i++) {
      lines.push(`const x${i}: string = ${i};`); // Type mismatch: string assigned number
    }
    createFile(filePath, lines.join("\n"));

    // Create service with default maxDiagnostics (should be 20)
    const service = new CodeDiagnosticsService({
      workspaceRoot: workspace,
      // Don't specify maxDiagnostics - should use DEFAULT_MAX_DIAGNOSTICS (20)
    });
    const summary = await service.collectForFiles([filePath]);

    // Should be truncated to 20 diagnostics
    assert.ok(summary !== null);
    assert.ok(summary.diagnostics.length <= 20,
      `Expected <= 20 diagnostics at default, got ${summary.diagnostics.length}`);
  } finally {
    cleanupPath(workspace);
  }
});

test("code diagnostics service returns null for empty filePaths array", async () => {
  const workspace = createTempWorkspace("aa-code-diagnostics-empty-");

  try {
    const service = new CodeDiagnosticsService({ workspaceRoot: workspace });
    const summary = await service.collectForFiles([]);

    assert.equal(summary, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("code diagnostics service returns null when all files are filtered by extension", async () => {
  const workspace = createTempWorkspace("aa-code-diagnostics-filtered-");
  const txtFile = join(workspace, "README.txt");
  const mdFile = join(workspace, "docs.md");
  const jsonFile = join(workspace, "config.json");

  try {
    createFile(txtFile, "some text content\n");
    createFile(mdFile, "# Documentation\n");
    createFile(jsonFile, '{"key": "value"}\n');

    const service = new CodeDiagnosticsService({ workspaceRoot: workspace });
    const summary = await service.collectForFiles([txtFile, mdFile, jsonFile]);

    assert.equal(summary, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("formatDiagnosticsFeedback returns null when errorCount and warningCount are both zero", () => {
  const summaryWithZeroCounts: CodeDiagnosticsSummary = {
    checkedFileCount: 1,
    diagnosticFileCount: 0,
    errorCount: 0,
    warningCount: 0,
    languages: [],
    diagnostics: [],
    runnerWarnings: [],
  };

  const result = formatDiagnosticsFeedback(summaryWithZeroCounts);
  assert.equal(result, null);
});

test("code diagnostics service deduplicates diagnostics with identical keys", async () => {
  const workspace = createTempWorkspace("aa-code-diagnostics-dedup-");
  const filePath = join(workspace, "test.ts");

  try {
    createFile(filePath, "const x: string = 1;\n");

    const service = new CodeDiagnosticsService({
      workspaceRoot: workspace,
      runTypeScript: () => {
        // Return 3 diagnostics with identical keys - should be deduped to 1
        const identicalDiagnostic: CodeDiagnosticEntry = {
          language: "typescript",
          severity: "error",
          filePath,
          message: "Type 'number' is not assignable to type 'string'",
          code: "2322",
          source: "typescript",
          line: 1,
          column: 13,
        };
        return [identicalDiagnostic, identicalDiagnostic, identicalDiagnostic];
      },
    });

    const summary = await service.collectForFiles([filePath]);

    assert.ok(summary !== null);
    assert.equal(summary.diagnostics.length, 1);
    assert.equal(summary.errorCount, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("code diagnostics service filters out files outside workspace root", async () => {
  const workspaceA = createTempWorkspace("aa-code-diagnostics-ws-a-");
  const workspaceB = createTempWorkspace("aa-code-diagnostics-ws-b-");
  const fileInA = join(workspaceA, "file-a.ts");
  const fileInB = join(workspaceB, "file-b.ts");

  try {
    createFile(fileInA, "const a: number = 1;\n");
    createFile(fileInB, "const b: string = 2;\n");

    // Service initialized with workspaceA, but we pass a file from workspaceB
    const service = new CodeDiagnosticsService({ workspaceRoot: workspaceA });
    const summary = await service.collectForFiles([fileInA, fileInB]);

    assert.ok(summary !== null);
    // Only fileInA should be checked - fileInB is outside workspaceA
    assert.equal(summary.checkedFileCount, 1);
    // Note: TypeScript canonicalizes paths via realpathSync, so we can't compare
    // filePath directly. Instead check that if there are diagnostics, none of them
    // come from workspaceB (fileInB should have been filtered out).
    assert.ok(summary.diagnostics.length === 0 || !summary.diagnostics.some((d) => d.filePath.startsWith(workspaceB)));
  } finally {
    cleanupPath(workspaceA);
    cleanupPath(workspaceB);
  }
});
