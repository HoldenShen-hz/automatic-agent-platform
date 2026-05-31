/**
 * Unit tests for tests/helpers/fs.ts
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readlinkSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  createTempWorkspace,
  cleanupPath,
  createFile,
  createSymlink,
} from "../../helpers/fs.js";

describe("fs helpers", () => {
  const workspaces: string[] = [];

  afterEach(() => {
    // Cleanup any workspaces created during tests
    for (const ws of workspaces) {
      cleanupPath(ws);
    }
    workspaces.length = 0;
  });

  describe("createTempWorkspace", () => {
    it("should create a directory with the given prefix", () => {
      const ws = createTempWorkspace("test-workspace-");
      workspaces.push(ws);
      assert.ok(ws.includes("test-workspace-"));
      assert.ok(existsSync(ws));
    });

    it("should create a unique directory each time", () => {
      const ws1 = createTempWorkspace("test-");
      const ws2 = createTempWorkspace("test-");
      workspaces.push(ws1, ws2);
      assert.notStrictEqual(ws1, ws2);
    });

    it("should create a directory in tmp location", () => {
      const ws = createTempWorkspace("test-");
      workspaces.push(ws);
      assert.ok(ws.includes("tmp") || ws.startsWith("/"));
    });
  });

  describe("cleanupPath", () => {
    it("should delete a file", () => {
      const ws = createTempWorkspace("cleanup-file-");
      workspaces.push(ws);
      const filePath = join(ws, "test.txt");
      createFile(filePath, "content");
      assert.ok(existsSync(filePath));
      cleanupPath(filePath);
      assert.ok(!existsSync(filePath));
    });

    it("should delete a directory recursively", () => {
      const ws = createTempWorkspace("cleanup-dir-");
      workspaces.push(ws);
      const subDir = join(ws, "subdir");
      createFile(join(subDir, "file.txt"), "content");
      assert.ok(existsSync(subDir));
      cleanupPath(ws);
      assert.ok(!existsSync(ws));
      workspaces.pop(); // Prevent double cleanup
    });

    it("should not throw if path does not exist", () => {
      assert.doesNotThrow(() => {
        cleanupPath("/nonexistent/path/that/does/not/exist");
        // No error means success
      });
    });

    it("should handle nested directories", () => {
      const ws = createTempWorkspace("cleanup-nested-");
      workspaces.push(ws);
      const nested = join(ws, "a", "b", "c");
      createFile(join(nested, "deep.txt"), "deep content");
      assert.ok(existsSync(nested));
      cleanupPath(nested);
      assert.ok(!existsSync(nested));
      // Parent should still exist
      assert.ok(existsSync(join(ws, "a", "b")));
    });
  });

  describe("createFile", () => {
    it("should create a file with content", () => {
      const ws = createTempWorkspace("create-file-");
      workspaces.push(ws);
      const filePath = join(ws, "test.txt");
      createFile(filePath, "hello world");
      assert.ok(existsSync(filePath));
      assert.strictEqual(readFileSync(filePath, "utf8"), "hello world");
    });

    it("should create parent directories recursively", () => {
      const ws = createTempWorkspace("create-file-parents-");
      workspaces.push(ws);
      const filePath = join(ws, "a", "b", "c", "test.txt");
      createFile(filePath, "nested content");
      assert.ok(existsSync(filePath));
      assert.strictEqual(readFileSync(filePath, "utf8"), "nested content");
    });

    it("should overwrite existing file", () => {
      const ws = createTempWorkspace("create-file-overwrite-");
      workspaces.push(ws);
      const filePath = join(ws, "test.txt");
      createFile(filePath, "original");
      createFile(filePath, "updated");
      assert.strictEqual(readFileSync(filePath, "utf8"), "updated");
    });

    it("should create file with empty content", () => {
      const ws = createTempWorkspace("create-file-empty-");
      workspaces.push(ws);
      const filePath = join(ws, "empty.txt");
      createFile(filePath, "");
      assert.ok(existsSync(filePath));
      assert.strictEqual(readFileSync(filePath, "utf8"), "");
    });
  });

  describe("createSymlink", () => {
    it("should create a symlink", () => {
      const ws = createTempWorkspace("create-symlink-");
      workspaces.push(ws);
      const targetPath = join(ws, "target.txt");
      const linkPath = join(ws, "link.txt");
      createFile(targetPath, "target content");
      createSymlink(targetPath, linkPath);
      assert.ok(existsSync(linkPath));
      const linkTarget = readlinkSync(linkPath);
      assert.strictEqual(linkTarget, targetPath);
    });

    it("should create parent directories for symlink", () => {
      const ws = createTempWorkspace("create-symlink-parents-");
      workspaces.push(ws);
      const targetPath = join(ws, "target.txt");
      const linkPath = join(ws, "a", "b", "link.txt");
      createFile(targetPath, "target content");
      createSymlink(targetPath, linkPath);
      assert.ok(existsSync(linkPath));
    });

    it("should allow symlink to directory", () => {
      const ws = createTempWorkspace("create-symlink-dir-");
      workspaces.push(ws);
      const targetDir = join(ws, "realdir");
      const linkPath = join(ws, "linkdir");
      createFile(join(targetDir, "file.txt"), "content");
      createSymlink(targetDir, linkPath);
      assert.ok(existsSync(linkPath));
      const stats = statSync(linkPath);
      assert.ok(stats.isDirectory());
    });
  });

  describe("integration scenarios", () => {
    it("should support typical test workflow", () => {
      // Create workspace
      const ws = createTempWorkspace("integration-");
      workspaces.push(ws);

      // Create test files
      createFile(join(ws, "config.json"), '{"key": "value"}');
      createFile(join(ws, "data.txt"), "test data");

      // Create subdirectory with files
      const srcDir = join(ws, "src");
      createFile(join(srcDir, "index.ts"), "export const x = 1;");

      // Verify all files exist
      assert.ok(existsSync(join(ws, "config.json")));
      assert.ok(existsSync(join(ws, "data.txt")));
      assert.ok(existsSync(join(srcDir, "index.ts")));

      // Cleanup everything
      cleanupPath(ws);
      assert.ok(!existsSync(ws));
      workspaces.pop();
    });

    it("should support symlink chain scenario", () => {
      const ws = createTempWorkspace("symlink-chain-");
      workspaces.push(ws);

      // Create original file
      const original = join(ws, "original.txt");
      createFile(original, "original content");

      // Create first symlink
      const link1 = join(ws, "link1.txt");
      createSymlink(original, link1);

      // Create symlink to symlink
      const link2 = join(ws, "link2.txt");
      createSymlink(link1, link2);

      // All should resolve to same content
      assert.strictEqual(readFileSync(link2, "utf8"), "original content");
    });
  });
});
