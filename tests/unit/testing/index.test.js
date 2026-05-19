import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTempWorkspace, createFile, cleanupPath, createSymlink, } from "../../../src/testing/index.js";
test("createTempWorkspace creates a temporary directory with correct prefix", () => {
    const workspace = createTempWorkspace("test-workspace-");
    try {
        assert.ok(workspace.length > 0, "workspace path should not be empty");
        assert.ok(workspace.includes("test-workspace-"), "workspace path should contain the prefix");
        assert.ok(workspace.startsWith(tmpdir()), `workspace should be in temp directory: ${tmpdir()}`);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("createTempWorkspace creates unique directories", () => {
    const workspace1 = createTempWorkspace("test-");
    const workspace2 = createTempWorkspace("test-");
    try {
        assert.notStrictEqual(workspace1, workspace2, "each call should create a unique directory");
    }
    finally {
        cleanupPath(workspace1);
        cleanupPath(workspace2);
    }
});
test("createFile creates a file with content", () => {
    const workspace = createTempWorkspace("test-file-");
    try {
        const filePath = join(workspace, "test.txt");
        createFile(filePath, "Hello, World!");
        assert.ok(existsSync(filePath), "file should exist after creation");
        assert.equal(readFileSync(filePath, "utf8"), "Hello, World!", "file content should match");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("createFile creates nested directories automatically", () => {
    const workspace = createTempWorkspace("test-nested-");
    try {
        const filePath = join(workspace, "nested", "deep", "path", "test.txt");
        createFile(filePath, "Nested content");
        assert.ok(existsSync(filePath), "file in nested path should exist");
        assert.equal(readFileSync(filePath, "utf8"), "Nested content", "nested file content should match");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("createSymlink creates a symbolic link", () => {
    const workspace = createTempWorkspace("test-symlink-");
    try {
        const targetPath = join(workspace, "target.txt");
        const linkPath = join(workspace, "link.txt");
        createFile(targetPath, "Target content");
        createSymlink(targetPath, linkPath);
        assert.ok(existsSync(linkPath), "symlink should exist");
        assert.equal(readlinkSync(linkPath), targetPath, "symlink should point to target");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("createSymlink creates parent directories automatically", () => {
    const workspace = createTempWorkspace("test-symlink-parent-");
    try {
        const targetPath = join(workspace, "target.txt");
        const linkPath = join(workspace, "nested", "link.txt");
        createFile(targetPath, "Target content");
        createSymlink(targetPath, linkPath);
        assert.ok(existsSync(linkPath), "symlink in nested path should exist");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("cleanupPath removes file", () => {
    const workspace = createTempWorkspace("test-cleanup-file-");
    const filePath = join(workspace, "to-delete.txt");
    createFile(filePath, "Content");
    assert.ok(existsSync(filePath), "file should exist before cleanup");
    cleanupPath(filePath);
    assert.ok(!existsSync(filePath), "file should not exist after cleanup");
    cleanupPath(workspace);
});
test("cleanupPath removes directory recursively", () => {
    const workspace = createTempWorkspace("test-cleanup-dir-");
    const nestedPath = join(workspace, "nested", "deep", "path");
    createFile(join(nestedPath, "file.txt"), "Content");
    assert.ok(existsSync(workspace), "workspace should exist before cleanup");
    cleanupPath(workspace);
    assert.ok(!existsSync(workspace), "workspace should not exist after cleanup");
});
test("cleanupPath handles non-existent path gracefully", () => {
    const nonExistentPath = "/tmp/non-existent-path-test-12345";
    // Should not throw
    cleanupPath(nonExistentPath);
    assert.ok(true, "cleanupPath should not throw for non-existent path");
});
test("cleanupPath with force option removes already deleted path", () => {
    const workspace = createTempWorkspace("test-cleanup-force-");
    const filePath = join(workspace, "to-delete.txt");
    createFile(filePath, "Content");
    cleanupPath(filePath);
    // Should not throw when cleaning up already deleted file
    cleanupPath(filePath);
    cleanupPath(workspace);
    assert.ok(true);
});
//# sourceMappingURL=index.test.js.map