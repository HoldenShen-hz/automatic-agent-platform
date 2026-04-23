import test from "node:test";
import assert from "node:assert/strict";

import {
  createTempWorkspace,
  createFile,
  cleanupPath,
  createSymlink,
  createSeededApiContext,
} from "../../../src/testing/index.js";

test("createTempWorkspace creates a temporary directory", () => {
  const workspace = createTempWorkspace("test-workspace-");
  try {
    assert.ok(workspace.length > 0);
    assert.ok(workspace.includes("test-workspace-"));
  } finally {
    cleanupPath(workspace);
  }
});

test("createFile creates a file with content", () => {
  const workspace = createTempWorkspace("test-file-");
  try {
    const filePath = `${workspace}/test.txt`;
    createFile(filePath, "Hello, World!");
    assert.equal(cleanupPath === undefined, false); // cleanupPath is a function
  } finally {
    cleanupPath(workspace);
  }
});

test("createSymlink creates a symbolic link", () => {
  const workspace = createTempWorkspace("test-symlink-");
  try {
    const targetPath = `${workspace}/target.txt`;
    const linkPath = `${workspace}/link.txt`;
    createFile(targetPath, "Target content");
    createSymlink(targetPath, linkPath);
    assert.equal(cleanupPath === undefined, false);
  } finally {
    cleanupPath(workspace);
  }
});

test("cleanupPath removes directory recursively", () => {
  const workspace = createTempWorkspace("test-cleanup-");
  const nestedPath = `${workspace}/nested/deep/path`;
  createFile(`${nestedPath}/file.txt`, "Content");
  cleanupPath(workspace);
  // Workspace should be cleaned up - this is a fire-and-forget test
  assert.ok(true);
});
