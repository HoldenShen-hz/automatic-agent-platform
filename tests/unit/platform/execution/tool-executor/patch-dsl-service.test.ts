import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { CodeDiagnosticsService } from "../../../../../src/platform/execution/tool-executor/code-diagnostics-service.js";
import { takeFileSnapshot } from "../../../../../src/platform/control-plane/iam/file-freshness.js";
import { createWorkspaceWritePolicy } from "../../../../../src/platform/control-plane/iam/sandbox-policy.js";
import { PatchDslService, type FilePatch } from "../../../../../src/platform/execution/tool-executor/patch-dsl-service.js";
import { createFile, createTempWorkspace, cleanupPath } from "../../../../helpers/fs.js";

test("PatchDslService.parsePatchString handles single file patch header", () => {
  const service = new PatchDslService();
  const patchContent = [
    "--- a/test.ts",
    "+++ b/test.ts",
    "@@ -1,3 +1,4 @@",
    " const original",
    "-removed line",
    "+added line",
    " const end",
  ].join("\n");

  const patches = service.parsePatchString(patchContent);

  assert.equal(patches.length, 1);
  assert.equal(patches[0]!.oldPath, "test.ts");
  assert.equal(patches[0]!.newPath, "test.ts");
});

test("PatchDslService.parsePatchString handles Codex add/update/delete patch format", () => {
  const service = new PatchDslService();
  const patchContent = [
    "*** Begin Patch",
    "*** Add File: src/new.ts",
    "+export const created = true;",
    "*** Update File: src/existing.ts",
    "@@ -1,1 +1,1 @@",
    "-export const value = 1;",
    "+export const value = 2;",
    "*** Delete File: src/old.ts",
    "*** End Patch",
  ].join("\n");

  const patches = service.parsePatchString(patchContent);

  assert.equal(patches.length, 3);
  assert.equal(patches[0]!.oldPath, "");
  assert.equal(patches[0]!.newPath, "src/new.ts");
  assert.equal(patches[1]!.oldPath, "src/existing.ts");
  assert.equal(patches[2]!.newPath, "");
});

test("PatchDslService.applyPatches applies simple line replacement", () => {
  const workspace = createTempWorkspace("patch-unit-");
  const service = new PatchDslService();
  const filePath = join(workspace, "test.ts");

  createFile(filePath, "line1\nline2\nline3\n");

  const patches: FilePatch[] = [
    {
      oldPath: join(workspace, "test.ts"),
      newPath: join(workspace, "test.ts"),
      hunks: [
        {
          oldStart: 2,
          oldCount: 1,
          newStart: 2,
          newCount: 1,
          lines: ["@@ -2,1 +2,1 @@", "line2", "-line3", "+new_line3"],
        },
      ],
    },
  ];

  const result = service.applyPatches({
    callId: "call-1",
    taskId: "task-1",
    executionId: "exec-1",
    traceId: "trace-1",
    toolName: "apply_patch",
    sandboxPolicy: createWorkspaceWritePolicy(workspace),
    patches,
  });

  assert.equal(result.status, "succeeded");
  assert.equal(result.results[0]!.status, "applied");

  const content = readFileSync(filePath, "utf8");
  assert.match(content, /new_line3/);

  cleanupPath(workspace);
});

test("PatchDslService.applyPatches appends diagnostics feedback for changed source files", () => {
  const workspace = createTempWorkspace("patch-unit-");
  const filePath = join(workspace, "demo.ts");
  const diagnostics = new CodeDiagnosticsService({
    workspaceRoot: workspace,
    runTypeScript: ({ filePaths }) => [{
      language: "typescript",
      severity: "error",
      filePath: filePaths[0] ?? filePath,
      message: "Type 'number' is not assignable to type 'string'.",
      code: "2322",
      source: "typescript",
      line: 1,
      column: 1,
    }],
  });
  const service = new PatchDslService(diagnostics);

  try {
    createFile(filePath, "export const value = 1;\n");
    const result = service.applyPatches({
      callId: "call-diag",
      taskId: "task-diag",
      executionId: "exec-diag",
      traceId: "trace-diag",
      toolName: "apply_patch",
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      patches: [{
        oldPath: filePath,
        newPath: filePath,
        hunks: [{
          oldStart: 1,
          oldCount: 1,
          newStart: 1,
          newCount: 1,
          lines: [
            "@@ -1,1 +1,1 @@",
            "-export const value = 1;",
            "+export const value: string = 1;",
          ],
        }],
      }],
    });

    assert.equal(result.status, "succeeded");
    assert.equal(result.output?.includes("Diagnostics:"), true);
    assert.equal(result.diagnostics?.errorCount, 1);
    assert.equal(result.diagnostics?.diagnostics[0]?.filePath.endsWith("/demo.ts"), true);
  } finally {
    cleanupPath(workspace);
  }
});

test("PatchDslService.applyPatches respects sandbox policy", () => {
  const workspace = createTempWorkspace("patch-unit-");
  const service = new PatchDslService();
  const filePath = join(workspace, "demo.ts");
  createFile(filePath, "content\n");

  const patches: FilePatch[] = [
    {
      oldPath: "/etc/passwd",
      newPath: "/etc/passwd",
      hunks: [
        {
          oldStart: 1,
          oldCount: 1,
          newStart: 1,
          newCount: 1,
          lines: ["@@ -1,1 +1,1 @@", " line", "-old", "+new"],
        },
      ],
    },
  ];

  const result = service.applyPatches({
    callId: "call-1",
    taskId: "task-1",
    executionId: "exec-1",
    traceId: "trace-1",
    toolName: "apply_patch",
    sandboxPolicy: createWorkspaceWritePolicy(workspace),
    patches,
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.results[0]!.errorCode, "sandbox.write_path_denied");

  cleanupPath(workspace);
});

test("PatchDslService.applyPatches handles multiple hunks", () => {
  const workspace = createTempWorkspace("patch-unit-");
  const service = new PatchDslService();
  const filePath = join(workspace, "test.ts");

  createFile(filePath, "line1\nline2\nline3\nline4\nline5\n");

  const patches: FilePatch[] = [
    {
      oldPath: filePath,
      newPath: filePath,
      hunks: [
        {
          oldStart: 1,
          oldCount: 1,
          newStart: 1,
          newCount: 1,
          lines: ["@@ -1,1 +1,1 @@", "line1", "-line2", "+new_line2"],
        },
        {
          oldStart: 4,
          oldCount: 1,
          newStart: 4,
          newCount: 1,
          lines: ["@@ -4,1 +4,1 @@", "line4", "-line5", "+new_line5"],
        },
      ],
    },
  ];

  const result = service.applyPatches({
    callId: "call-1",
    taskId: "task-1",
    executionId: "exec-1",
    traceId: "trace-1",
    toolName: "apply_patch",
    sandboxPolicy: createWorkspaceWritePolicy(workspace),
    patches,
  });

  assert.equal(result.status, "succeeded");
  assert.equal(result.results[0]!.hunksApplied, 2);
  assert.equal(result.results[0]!.hunksTotal, 2);

  cleanupPath(workspace);
});

test("PatchDslService.applyPatches fails when oldPath and newPath are empty", () => {
  const workspace = createTempWorkspace("patch-unit-");
  const service = new PatchDslService();

  const patches: FilePatch[] = [
    {
      oldPath: "",
      newPath: "",
      hunks: [],
    },
  ];

  const result = service.applyPatches({
    callId: "call-1",
    taskId: "task-1",
    executionId: "exec-1",
    traceId: "trace-1",
    toolName: "apply_patch",
    sandboxPolicy: createWorkspaceWritePolicy(workspace),
    patches,
  });

  assert.equal(result.status, "failed");
  assert.equal(result.results[0]!.errorCode, "patch.invalid_path");

  cleanupPath(workspace);
});

test("PatchDslService.applyPatches writes to correct file path", () => {
  const workspace = createTempWorkspace("patch-unit-");
  const service = new PatchDslService();
  const filePath = join(workspace, "output.ts");

  createFile(filePath, "original\n");

  const patches: FilePatch[] = [
    {
      oldPath: filePath,
      newPath: filePath,
      hunks: [
        {
          oldStart: 1,
          oldCount: 1,
          newStart: 1,
          newCount: 1,
          lines: ["@@ -1,1 +1,1 @@", "original", "-original", "+modified"],
        },
      ],
    },
  ];

  const result = service.applyPatches({
    callId: "call-1",
    taskId: "task-1",
    executionId: "exec-1",
    traceId: "trace-1",
    toolName: "apply_patch",
    sandboxPolicy: createWorkspaceWritePolicy(workspace),
    patches,
  });

  assert.equal(result.status, "succeeded");
  assert.equal(result.results[0]!.filePath, filePath);

  cleanupPath(workspace);
});

test("PatchDslService.applyPatches creates a file when allowCreation is true", () => {
  const workspace = createTempWorkspace("patch-unit-");
  const service = new PatchDslService();
  const filePath = join(workspace, "created.ts");

  const patches: FilePatch[] = [
    {
      oldPath: "",
      newPath: filePath,
      hunks: [
        {
          oldStart: 1,
          oldCount: 0,
          newStart: 1,
          newCount: 1,
          lines: ["@@ -0,0 +1,1 @@", "+export const created = true;"],
        },
      ],
    },
  ];

  const result = service.applyPatches({
    callId: "call-create",
    taskId: "task-create",
    executionId: null,
    traceId: "trace-create",
    toolName: "apply_patch",
    sandboxPolicy: createWorkspaceWritePolicy(workspace),
    patches,
    allowCreation: true,
  });

  assert.equal(result.status, "succeeded");
  assert.equal(result.results[0]!.status, "created");
  assert.equal(readFileSync(filePath, "utf8"), "export const created = true;\n");

  cleanupPath(workspace);
});

test("PatchDslService.applyPatches handles file with context before and after changes", () => {
  const workspace = createTempWorkspace("patch-unit-");
  const service = new PatchDslService();
  const filePath = join(workspace, "test.ts");

  createFile(filePath, "line1\nline2\nline3\nline4\nline5\n");

  const patches: FilePatch[] = [
    {
      oldPath: filePath,
      newPath: filePath,
      hunks: [
        {
          oldStart: 2,
          oldCount: 2,
          newStart: 2,
          newCount: 2,
          lines: [
            "@@ -2,2 +2,2 @@",
            " line2",
            "-line3",
            "+modified_line3",
            " line4",
          ],
        },
      ],
    },
  ];

  const result = service.applyPatches({
    callId: "call-1",
    taskId: "task-1",
    executionId: "exec-1",
    traceId: "trace-1",
    toolName: "apply_patch",
    sandboxPolicy: createWorkspaceWritePolicy(workspace),
    patches,
  });

  assert.equal(result.status, "succeeded");
  assert.equal(result.results[0]!.status, "applied");

  const content = readFileSync(filePath, "utf8");
  assert.match(content, /modified_line3/);
  const lines = content.split("\n").filter(l => l.length > 0);
  assert.ok(!lines.includes("line3"), "line3 should be replaced");

  cleanupPath(workspace);
});

test("PatchDslService.applyPatches reports correct hunks total", () => {
  const workspace = createTempWorkspace("patch-unit-");
  const service = new PatchDslService();
  const filePath = join(workspace, "test.ts");

  createFile(filePath, "line1\nline2\nline3\n");

  const patches: FilePatch[] = [
    {
      oldPath: filePath,
      newPath: filePath,
      hunks: [
        {
          oldStart: 1,
          oldCount: 1,
          newStart: 1,
          newCount: 1,
          lines: ["@@ -1,1 +1,1 @@", "line1", "-line2", "+new_line2"],
        },
        {
          oldStart: 2,
          oldCount: 1,
          newStart: 2,
          newCount: 1,
          lines: ["@@ -2,1 +2,1 @@", "line3", "-line3", "+new_line3"],
        },
      ],
    },
  ];

  const result = service.applyPatches({
    callId: "call-1",
    taskId: "task-1",
    executionId: "exec-1",
    traceId: "trace-1",
    toolName: "apply_patch",
    sandboxPolicy: createWorkspaceWritePolicy(workspace),
    patches,
  });

  assert.equal(result.results[0]!.hunksTotal, 2);

  cleanupPath(workspace);
});

test("PatchDslService.applyPatches rolls back earlier files when a later patch fails", () => {
  const workspace = createTempWorkspace("patch-unit-");
  const service = new PatchDslService();
  const file1Path = join(workspace, "file1.ts");
  const file2Path = join(workspace, "file2.ts");

  createFile(file1Path, "const first = 1;\n");
  createFile(file2Path, "const second = 2;\n");

  const patches: FilePatch[] = [
    {
      oldPath: file1Path,
      newPath: file1Path,
      hunks: [
        {
          oldStart: 1,
          oldCount: 1,
          newStart: 1,
          newCount: 1,
          lines: ["@@ -1,1 +1,1 @@", "-const first = 1;", "+const first = 10;"],
        },
      ],
    },
    {
      oldPath: file2Path,
      newPath: file2Path,
      hunks: [
        {
          oldStart: 1,
          oldCount: 1,
          newStart: 1,
          newCount: 1,
          lines: ["@@ -1,1 +1,1 @@", "-const missing = 2;", "+const missing = 20;"],
        },
      ],
    },
  ];

  const result = service.applyPatches({
    callId: "call-rollback",
    taskId: "task-rollback",
    executionId: null,
    traceId: "trace-rollback",
    toolName: "apply_patch",
    sandboxPolicy: createWorkspaceWritePolicy(workspace),
    patches,
  });

  assert.equal(result.status, "failed");
  assert.equal(readFileSync(file1Path, "utf8"), "const first = 1;\n");
  assert.equal(readFileSync(file2Path, "utf8"), "const second = 2;\n");

  cleanupPath(workspace);
});

test("PatchDslService.applyPatches fails when caller snapshot is stale", () => {
  const workspace = createTempWorkspace("patch-unit-");
  const service = new PatchDslService();
  const filePath = join(workspace, "stale.ts");

  createFile(filePath, "const value = 1;\n");
  const expectedSnapshot = takeFileSnapshot(filePath, { includeDigest: true });
  writeFileSync(filePath, "const value = 3;\n", "utf8");

  const patches: FilePatch[] = [
    {
      oldPath: filePath,
      newPath: filePath,
      expectedSnapshot,
      hunks: [
        {
          oldStart: 1,
          oldCount: 1,
          newStart: 1,
          newCount: 1,
          lines: ["@@ -1,1 +1,1 @@", "-const value = 3;", "+const value = 4;"],
        },
      ],
    },
  ];

  const result = service.applyPatches({
    callId: "call-stale",
    taskId: "task-stale",
    executionId: null,
    traceId: "trace-stale",
    toolName: "apply_patch",
    sandboxPolicy: createWorkspaceWritePolicy(workspace),
    patches,
    freshnessConfig: {
      requireDigest: true,
    },
  });

  assert.equal(result.status, "failed");
  assert.equal(result.results[0]!.errorCode, "tool.file_stale_modification_denied");
  assert.equal(readFileSync(filePath, "utf8"), "const value = 3;\n");

  cleanupPath(workspace);
});
