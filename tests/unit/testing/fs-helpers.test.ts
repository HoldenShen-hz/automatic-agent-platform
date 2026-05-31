/**
 * Unit tests for fs test helpers
 */

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  createTempWorkspace,
  createFile,
  cleanupPath,
  createSymlink,
} from "../../../helpers/fs.js";

test("createTempWorkspace creates a directory", () => {
  const workspace = createTempWorkspace("test-fs-");
  try {
    assert.ok(existsSync(workspace), "temp workspace should exist");
    assert.ok(workspace.includes("test-fs-"), "workspace should have prefix");
  } finally {
    cleanupPath(workspace);
  }
});

test("createTempWorkspace creates unique directories", () => {
  const workspace1 = createTempWorkspace("test-unique-");
  const workspace2 = createTempWorkspace("test-unique-");
  try {
    assert.notStrictEqual(workspace1, workspace2, "workspaces should be unique");
  } finally {
    cleanupPath(workspace1);
    cleanupPath(workspace2);
  }
});

test("createFile creates file with content", () => {
  const workspace = createTempWorkspace("test-create-file-");
  try {
    const filePath = join(workspace, "subdir", "test.txt");
    createFile(filePath, "hello world");

    assert.ok(existsSync(filePath), "file should exist");
    assert.equal(readFileSync(filePath, "utf8"), "hello world");
  } finally {
    cleanupPath(workspace);
  }
});

test("createFile creates parent directories", () => {
  const workspace = createTempWorkspace("test-create-file-");
  try {
    const filePath = join(workspace, "a", "b", "c", "deep.txt");
    createFile(filePath, "deep content");

    assert.ok(existsSync(filePath), "nested file should exist");
  } finally {
    cleanupPath(workspace);
  }
});

test("createFile overwrites existing file", () => {
  const workspace = createTempWorkspace("test-create-file-");
  try {
    const filePath = join(workspace, "overwrite.txt");
    createFile(filePath, "original");
    createFile(filePath, "updated");

    assert.equal(readFileSync(filePath, "utf8"), "updated");
  } finally {
    cleanupPath(workspace);
  }
});

test("cleanupPath removes directory recursively", () => {
  const workspace = createTempWorkspace("test-cleanup-");
  const filePath = join(workspace, "nested", "deep", "file.txt");
  createFile(filePath, "content");

  assert.ok(existsSync(workspace), "workspace should exist before cleanup");

  cleanupPath(workspace);

  assert.ok(!existsSync(workspace), "workspace should be removed");
});

test("cleanupPath handles non-existent path", () => {
  assert.doesNotThrow(() => {
    // Should not throw
    cleanupPath("/non/existent/path");
  });
});

test("createSymlink creates symlink", () => {
  const workspace = createTempWorkspace("test-symlink-");
  try {
    const targetPath = join(workspace, "target.txt");
    const linkPath = join(workspace, "link.txt");

    createFile(targetPath, "target content");
    createSymlink(targetPath, linkPath);

    assert.ok(existsSync(linkPath), "symlink should exist");
    assert.equal(readFileSync(linkPath, "utf8"), "target content");
  } finally {
    cleanupPath(workspace);
  }
});

test("createSymlink creates parent directories", () => {
  const workspace = createTempWorkspace("test-symlink-");
  try {
    const targetPath = join(workspace, "target.txt");
    const linkPath = join(workspace, "subdir", "link.txt");

    createFile(targetPath, "target");
    createSymlink(targetPath, linkPath);

    assert.ok(existsSync(linkPath), "symlink should exist in nested dir");
  } finally {
    cleanupPath(workspace);
  }
});