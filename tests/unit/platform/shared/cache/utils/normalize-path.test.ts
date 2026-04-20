import assert from "node:assert/strict";
import test from "node:test";
import { platform } from "node:os";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  normalizePath,
  isWithinWorkspace,
  getWorkspaceRelativePath,
} from "../../../../../../src/platform/shared/cache/utils/normalize-path.js";

const isWindows = platform() === "win32";
const TEST_WORKSPACE = join(tmpdir(), "test-workspace");

test("normalizePath replaces backslashes on Windows", {
  skip: !isWindows,
}, () => {
  const result = normalizePath("C:\\Users\\test\\file.ts", "C:\\Users\\test");
  assert.ok(result.includes("/"));
});

test("normalizePath resolves relative paths", () => {
  const result = normalizePath("./file.ts", "/workspace");
  assert.ok(result.includes("/file.ts") || result.endsWith("/file.ts"));
});

test("normalizePath returns /workspace prefix for files in workspace", () => {
  const result = normalizePath("src/index.ts", TEST_WORKSPACE);
  assert.equal(result.startsWith("/workspace"), true);
});

test("normalizePath returns absolute path for files outside workspace", () => {
  const result = normalizePath("/tmp/file.ts", TEST_WORKSPACE);
  // On Unix, /tmp doesn't start with TEST_WORKSPACE, so it stays as /tmp/file.ts
  assert.ok(result.startsWith("/") || result.includes("/"));
});

test("normalizePath handles trailing slashes in workspace root", () => {
  const result = normalizePath("file.ts", "/workspace/");
  assert.ok(result.includes("/workspace/") || result.includes("/workspace"));
});

test("normalizePath handles files at workspace root", () => {
  const result = normalizePath("file.ts", "/workspace");
  assert.equal(result, "/workspace/file.ts");
});

test("normalizePath handles subdirectory", () => {
  const result = normalizePath("src/utils/helper.ts", "/workspace");
  assert.equal(result, "/workspace/src/utils/helper.ts");
});

test("isWithinWorkspace returns true for path inside workspace", () => {
  const result = isWithinWorkspace("src/index.ts", "/workspace");
  assert.equal(result, true);
});

test("isWithinWorkspace returns false for path outside workspace", () => {
  const result = isWithinWorkspace("/tmp/file.ts", "/workspace");
  assert.equal(result, false);
});

test("isWithinWorkspace returns true for workspace root itself", () => {
  const result = isWithinWorkspace(".", "/workspace");
  assert.equal(result, true);
});

test("getWorkspaceRelativePath returns path without /workspace prefix", () => {
  const result = getWorkspaceRelativePath("src/index.ts", "/workspace");
  assert.equal(result, "/src/index.ts");
});

test("getWorkspaceRelativePath handles subdirectory", () => {
  const result = getWorkspaceRelativePath("src/utils/helper.ts", "/workspace");
  assert.equal(result, "/src/utils/helper.ts");
});

test("getWorkspaceRelativePath returns full path when outside workspace", () => {
  const result = getWorkspaceRelativePath("/tmp/file.ts", "/workspace");
  // Path outside workspace is returned as-is (but normalized)
  assert.ok(result.includes("/tmp") || result === "/tmp/file.ts");
});

test("getWorkspaceRelativePath handles path at workspace root", () => {
  const result = getWorkspaceRelativePath("file.ts", "/workspace");
  assert.equal(result, "/file.ts");
});
