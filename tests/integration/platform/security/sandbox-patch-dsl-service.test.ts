import assert from "node:assert/strict";
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { takeFileSnapshot } from "../../../../src/platform/control-plane/iam/file-freshness.js";
import { createWorkspaceWritePolicy } from "../../../../src/platform/control-plane/iam/sandbox-policy.js";
import { PatchDslService, type FilePatch } from "../../../../src/platform/execution/tool-executor/patch-dsl-service.js";
import { cleanupPath, createFile, createSymlink, createTempWorkspace } from "../../../helpers/fs.js";

test("apply_patch service blocks writes outside the workspace sandbox", async () => {
  const workspace = createTempWorkspace("aa-patch-security-");
  const outside = createTempWorkspace("aa-patch-outside-");

  try {
    const blockedPath = join(outside, "blocked.ts");
    createFile(blockedPath, "const blocked = true;\n");

    const service = new PatchDslService();
    const patches: FilePatch[] = [
      {
        oldPath: blockedPath,
        newPath: blockedPath,
        hunks: [
          {
            oldStart: 1,
            oldCount: 1,
            newStart: 1,
            newCount: 1,
            lines: ["@@ -1,1 +1,1 @@", "const blocked = true;", "-const blocked = true;", "+const blocked = false;"],
          },
        ],
      },
    ];

    const result = await service.applyPatches({
      callId: "security-call-1",
      taskId: "task-patch-security",
      executionId: null,
      traceId: "trace-patch-security",
      toolName: "apply_patch",
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      patches,
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.success, false);
    assert.equal(result.results[0]!.errorCode, "sandbox.write_path_denied");
    assert.equal(readFileSync(blockedPath, "utf8"), "const blocked = true;\n");
  } finally {
    cleanupPath(workspace);
    cleanupPath(outside);
  }
});

test("apply_patch service blocks symlink escapes", async () => {
  const workspace = createTempWorkspace("aa-patch-symlink-");
  const outside = createTempWorkspace("aa-patch-symlink-target-");

  try {
    const actualFile = join(outside, "real.ts");
    const symlinkPath = join(workspace, "linked.ts");
    createFile(actualFile, "const value = 1;\n");
    createSymlink(actualFile, symlinkPath);

    const service = new PatchDslService();
    const patches: FilePatch[] = [
      {
        oldPath: symlinkPath,
        newPath: symlinkPath,
        hunks: [
          {
            oldStart: 1,
            oldCount: 1,
            newStart: 1,
            newCount: 1,
            lines: ["@@ -1,1 +1,1 @@", "const value = 1;", "-const value = 1;", "+const value = 2;"],
          },
        ],
      },
    ];

    const result = await service.applyPatches({
      callId: "security-call-2",
      taskId: "task-patch-security",
      executionId: null,
      traceId: "trace-patch-security",
      toolName: "apply_patch",
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      patches,
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.results[0]!.errorCode, "sandbox.write_path_denied");
    assert.equal(readFileSync(actualFile, "utf8"), "const value = 1;\n");
  } finally {
    cleanupPath(workspace);
    cleanupPath(outside);
  }
});

test("apply_patch service respects freshness check", async () => {
  const workspace = createTempWorkspace("aa-patch-fresh-");

  try {
    const filePath = join(workspace, "fresh.ts");
    createFile(filePath, "const value = 1;\n");

    const service = new PatchDslService();
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
            lines: ["@@ -1,1 +1,1 @@", "const value = 1;", "-const value = 1;", "+const value = 2;"],
          },
        ],
      },
    ];

    const result = await service.applyPatches({
      callId: "security-call-fresh-1",
      taskId: "task-patch-security",
      executionId: null,
      traceId: "trace-patch-security",
      toolName: "apply_patch",
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      patches,
      freshnessConfig: {
        requireDigest: true,
      },
    });

    assert.equal(result.status, "succeeded");
    assert.equal(result.success, true);
    assert.equal(readFileSync(filePath, "utf8"), "const value = 2;\n");
  } finally {
    cleanupPath(workspace);
  }
});

test("apply_patch service fails with stale freshness check", async () => {
  const workspace = createTempWorkspace("aa-patch-stale-");

  try {
    const filePath = join(workspace, "stale.ts");
    createFile(filePath, "const value = 1;\n");
    const expectedSnapshot = takeFileSnapshot(filePath, { includeDigest: true });
    writeFileSync(filePath, "const value = 3;\n", "utf8");

    const service = new PatchDslService();
    const stalePatches: FilePatch[] = [
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

    const result = await service.applyPatches({
      callId: "security-call-stale-1",
      taskId: "task-patch-security",
      executionId: null,
      traceId: "trace-patch-security",
      toolName: "apply_patch",
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      patches: stalePatches,
      freshnessConfig: {
        requireDigest: true,
      },
    });

    assert.equal(result.status, "failed");
    assert.equal(result.results[0]!.errorCode, "tool.file_stale_modification_denied");
    assert.equal(readFileSync(filePath, "utf8"), "const value = 3;\n");
  } finally {
    cleanupPath(workspace);
  }
});

// TODO: fix - PatchDslService.applyPatches returns status "blocked" even with allowCreation=true.
// The file doesn't exist and the service is blocking the create operation instead of creating the file.
// Need to investigate why applyPatches blocks the creation even when allowCreation is set.
test("apply_patch service creates new file when allowCreation is true", async () => {
  const workspace = createTempWorkspace("aa-patch-create-");

  try {
    const newFilePath = join(workspace, "new.ts");

    const service = new PatchDslService();
    const patches: FilePatch[] = [
      {
        oldPath: newFilePath,
        newPath: newFilePath,
        hunks: [
          {
            oldStart: 1,
            oldCount: 0,
            newStart: 1,
            newCount: 1,
            lines: ["@@ -1,0 +1,1 @@", "+const created = true;"],
          },
        ],
      },
    ];

    const result = await service.applyPatches({
      callId: "security-call-create-1",
      taskId: "task-patch-security",
      executionId: null,
      traceId: "trace-patch-security",
      toolName: "apply_patch",
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      patches,
      allowCreation: true,
    });

    assert.equal(result.status, "succeeded");
    assert.equal(result.results[0]!.status, "created");
    assert.equal(readFileSync(newFilePath, "utf8"), "const created = true;\n");
  } finally {
    cleanupPath(workspace);
  }
});

// TODO: fix - Similar to test "creates new file", when allowCreation=false and file doesn't exist,
// PatchDslService may return "blocked" instead of "failed" with "patch.file_not_found" error.
// Need to investigate why the service returns wrong status/error code for non-existent files.
test("apply_patch service fails when target file does not exist and allowCreation is false", async () => {
  const workspace = createTempWorkspace("aa-patch-nocreate-");

  try {
    const missingFilePath = join(workspace, "missing.ts");

    const service = new PatchDslService();
    const patches: FilePatch[] = [
      {
        oldPath: missingFilePath,
        newPath: missingFilePath,
        hunks: [
          {
            oldStart: 1,
            oldCount: 0,
            newStart: 1,
            newCount: 1,
            lines: ["@@ -1,0 +1,1 @@", "+const created = true;"],
          },
        ],
      },
    ];

    const result = await service.applyPatches({
      callId: "security-call-nocreate-1",
      taskId: "task-patch-security",
      executionId: null,
      traceId: "trace-patch-security",
      toolName: "apply_patch",
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      patches,
      allowCreation: false,
    });

    assert.equal(result.status, "failed");
    assert.equal(result.results[0]!.errorCode, "patch.file_not_found");
  } finally {
    cleanupPath(workspace);
  }
});

test("apply_patch service handles multiple patches across files atomically", async () => {
  const workspace = createTempWorkspace("aa-patch-multi-");

  try {
    const file1Path = join(workspace, "file1.ts");
    const file2Path = join(workspace, "file2.ts");
    createFile(file1Path, "const first = 1;\n");
    createFile(file2Path, "const second = 2;\n");

    const service = new PatchDslService();
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
            lines: ["@@ -1,1 +1,1 @@", "const first = 1;", "-const first = 1;", "+const first = 10;"],
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
            lines: ["@@ -1,1 +1,1 @@", "const second = 2;", "-const second = 2;", "+const second = 20;"],
          },
        ],
      },
    ];

    const result = await service.applyPatches({
      callId: "security-call-multi-1",
      taskId: "task-patch-security",
      executionId: null,
      traceId: "trace-patch-security",
      toolName: "apply_patch",
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      patches,
    });

    assert.equal(result.status, "succeeded");
    assert.equal(result.results[0]!.status, "applied");
    assert.equal(result.results[1]!.status, "applied");
    assert.equal(readFileSync(file1Path, "utf8"), "const first = 10;\n");
    assert.equal(readFileSync(file2Path, "utf8"), "const second = 20;\n");
  } finally {
    cleanupPath(workspace);
  }
});

test("apply_patch service rolls back all files when a later patch cannot be applied", async () => {
  const workspace = createTempWorkspace("aa-patch-rollback-");

  try {
    const file1Path = join(workspace, "file1.ts");
    const file2Path = join(workspace, "file2.ts");
    createFile(file1Path, "const first = 1;\n");
    createFile(file2Path, "const second = 2;\n");

    const service = new PatchDslService();
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

    const result = await service.applyPatches({
      callId: "security-call-rollback-1",
      taskId: "task-patch-security",
      executionId: null,
      traceId: "trace-patch-security",
      toolName: "apply_patch",
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
      patches,
    });

    assert.equal(result.status, "failed");
    assert.equal(readFileSync(file1Path, "utf8"), "const first = 1;\n");
    assert.equal(readFileSync(file2Path, "utf8"), "const second = 2;\n");
  } finally {
    cleanupPath(workspace);
  }
});
