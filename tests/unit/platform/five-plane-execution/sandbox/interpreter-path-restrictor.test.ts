/**
 * InterpreterPathRestrictor Tests
 *
 * Tests path restriction security boundaries:
 * - Allows paths within workspace root
 * - Blocks paths outside workspace
 * - Blocks absolute paths to external locations
 * - Blocks symlink traversal
 */

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, symlink, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";

// Import the path restrictor module
import {
  checkToolPathScope,
  normalizeToolPathScopeRoots,
  hasToolPathScopeRestrictions,
} from "../../../../../src/platform/five-plane-execution/tool-executor/tool-path-scope.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

interface WorkspaceFixture {
  path: string;
  subdirs: string[];
  symlinks: Array<{ link: string; target: string }>;
}

async function createWorkspace(): Promise<WorkspaceFixture> {
  const tmp = await mkdtemp(join(tmpdir(), "path-restrictor-workspace-"));
  const subdirs = ["app", "data", "nested"];
  const symlinks: Array<{ link: string; target: string }> = [];

  // Create top-level directories
  for (const subdir of subdirs) {
    await mkdir(join(tmp, subdir), { recursive: true });
  }
  // Create nested directory separately (proper nested creation)
  await mkdir(join(tmp, "nested", "deep"), { recursive: true });

  await writeFile(join(tmp, "app", "config.json"), '{"key": "value"}');
  await writeFile(join(tmp, "data", "file.txt"), "test content");
  // Create file inside nested/deep for path restriction tests
  await writeFile(join(tmp, "nested", "deep", "file.txt"), "nested content");

  return { path: tmp, subdirs, symlinks };
}

async function createSymlinkOut(workspace: WorkspaceFixture): Promise<string> {
  const externalDir = await mkdtemp(join(tmpdir(), "external-dir-"));
  await writeFile(join(externalDir, "secret.txt"), "sensitive data");
  const linkPath = join(workspace.path, "escape_link");
  await symlink(externalDir, linkPath);
  workspace.symlinks.push({ link: linkPath, target: externalDir });
  return linkPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

function checkPath(inputPath: string, roots: readonly string[] | null): ReturnType<typeof checkToolPathScope> {
  return checkToolPathScope(inputPath, roots ?? []);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Allows paths within workspace root
// ─────────────────────────────────────────────────────────────────────────────

test("allows nested path within workspace root", async () => {
  const workspace = await createWorkspace();
  try {
    // Use separate arguments for proper nested path construction
    const nestedPath = join(workspace.path, "nested", "deep", "file.txt");
    const result = checkPath(nestedPath, [workspace.path]);
    assert.equal(result.allowed, true, "Nested path within workspace should be allowed");
    assert.strictEqual(result.reasonCode, null);
  } finally {
    await rm(workspace.path, { recursive: true, force: true });
  }
});

test("allows absolute path within workspace root", async () => {
  const workspace = await createWorkspace();
  try {
    const absolutePath = join(workspace.path, "app", "config.json");
    const result = checkPath(absolutePath, [workspace.path]);
    assert.equal(result.allowed, true, "Absolute path within workspace should be allowed");
    assert.strictEqual(result.reasonCode, null);
  } finally {
    await rm(workspace.path, { recursive: true, force: true });
  }
});

test("allows path equal to workspace root", async () => {
  const workspace = await createWorkspace();
  try {
    const result = checkPath(workspace.path, [workspace.path]);
    assert.equal(result.allowed, true, "Workspace root itself should be allowed");
    assert.strictEqual(result.reasonCode, null);
  } finally {
    await rm(workspace.path, { recursive: true, force: true });
  }
});

test("allows path with multiple allowed roots", async () => {
  const workspace = await createWorkspace();
  const externalRoot = await mkdtemp(join(tmpdir(), "external-root-"));
  try {
    const result = checkPath(join(workspace.path, "app", "config.json"), [externalRoot, workspace.path, "/another/root"]);
    assert.equal(result.allowed, true, "Path matching one of multiple roots should be allowed");
    assert.strictEqual(result.reasonCode, null);
  } finally {
    await rm(workspace.path, { recursive: true, force: true });
    await rm(externalRoot, { recursive: true, force: true });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Blocks paths outside workspace
// ─────────────────────────────────────────────────────────────────────────────

test("blocks path outside workspace with ../ traversal", async () => {
  const workspace = await createWorkspace();
  try {
    const result = checkPath("../etc/passwd", [workspace.path]);
    assert.equal(result.allowed, false, "Path traversal should be blocked");
    assert.strictEqual(result.reasonCode, "tool.path_scope_denied");
  } finally {
    await rm(workspace.path, { recursive: true, force: true });
  }
});

test("blocks deeply nested path traversal outside workspace", async () => {
  const workspace = await createWorkspace();
  try {
    const result = checkPath("a/b/c/../../../etc/passwd", [workspace.path]);
    assert.equal(result.allowed, false, "Deeply nested traversal should be blocked");
    assert.strictEqual(result.reasonCode, "tool.path_scope_denied");
  } finally {
    await rm(workspace.path, { recursive: true, force: true });
  }
});

test("blocks sibling directory escape", async () => {
  const workspace = await createWorkspace();
  try {
    // Create a sibling directory
    const siblingDir = join(tmpdir(), "sibling-dir-" + Date.now());
    await mkdir(siblingDir);
    const result = checkPath(join(siblingDir, "file.txt"), [workspace.path]);
    assert.equal(result.allowed, false, "Sibling directory escape should be blocked");
    assert.strictEqual(result.reasonCode, "tool.path_scope_denied");
    await rm(siblingDir, { recursive: true, force: true });
  } finally {
    await rm(workspace.path, { recursive: true, force: true });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Blocks absolute paths to external locations
// ─────────────────────────────────────────────────────────────────────────────

test("blocks absolute path to /etc", async () => {
  const workspace = await createWorkspace();
  try {
    const result = checkPath("/etc/passwd", [workspace.path]);
    assert.equal(result.allowed, false, "Absolute /etc path should be blocked");
    assert.strictEqual(result.reasonCode, "tool.path_scope_denied");
  } finally {
    await rm(workspace.path, { recursive: true, force: true });
  }
});

test("blocks absolute path to /tmp", async () => {
  const workspace = await createWorkspace();
  try {
    const result = checkPath("/tmp/secret-file", [workspace.path]);
    assert.equal(result.allowed, false, "Absolute /tmp path should be blocked");
    assert.strictEqual(result.reasonCode, "tool.path_scope_denied");
  } finally {
    await rm(workspace.path, { recursive: true, force: true });
  }
});

test("blocks absolute path to user home directory", async () => {
  const workspace = await createWorkspace();
  try {
    const result = checkPath("/home/user/.ssh/id_rsa", [workspace.path]);
    assert.equal(result.allowed, false, "Home directory path should be blocked");
    assert.strictEqual(result.reasonCode, "tool.path_scope_denied");
  } finally {
    await rm(workspace.path, { recursive: true, force: true });
  }
});

test("blocks absolute path to system directories", async () => {
  const workspace = await createWorkspace();
  const systemPaths = ["/var/log", "/usr/bin", "/opt", "/root"];
  try {
    for (const sysPath of systemPaths) {
      const result = checkPath(join(sysPath, "system-file"), [workspace.path]);
      assert.equal(result.allowed, false, `${sysPath} should be blocked`);
      assert.strictEqual(result.reasonCode, "tool.path_scope_denied");
    }
  } finally {
    await rm(workspace.path, { recursive: true, force: true });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Blocks symlink traversal
// ─────────────────────────────────────────────────────────────────────────────

test("blocks symlink escape to external directory", async () => {
  const workspace = await createWorkspace();
  try {
    await createSymlinkOut(workspace);
    // The symlink points outside the workspace, so accessing it should be blocked
    const result = checkPath(join(workspace.path, "escape_link", "secret.txt"), [workspace.path]);
    assert.equal(result.allowed, false, "Symlink traversal to external directory should be blocked");
    assert.strictEqual(result.reasonCode, "tool.path_scope_denied");
  } finally {
    await rm(workspace.path, { recursive: true, force: true });
  }
});

test("blocks symlink pointing to parent directory", async () => {
  const workspace = await createWorkspace();
  try {
    // Create a symlink inside workspace pointing to parent
    const parentLink = join(workspace.path, "parent_link");
    const parentDir = join(workspace.path, "..");
    await symlink(parentDir, parentLink);
    workspace.symlinks.push({ link: parentLink, target: parentDir });

    // The resolved path of parent_link will be outside workspace
    const result = checkPath(parentLink, [workspace.path]);
    assert.equal(result.allowed, false, "Symlink to parent directory should be blocked");
    assert.strictEqual(result.reasonCode, "tool.path_scope_denied");
  } finally {
    await rm(workspace.path, { recursive: true, force: true });
  }
});

test("blocks symlink escape via relative parent traversal", async () => {
  const workspace = await createWorkspace();
  try {
    // Create a symlink that traverses outside via relative path
    // This symlink points to a path that when resolved escapes the workspace
    const escapeLink = join(workspace.path, "escape_via_parent");
    const targetPath = join("..", "..", "..", "..", "tmp");
    await symlink(targetPath, escapeLink);

    // Accessing through the symlink should be blocked after resolution
    const result = checkPath(escapeLink, [workspace.path]);
    assert.equal(result.allowed, false, "Symlink with relative parent traversal should be blocked");
    assert.strictEqual(result.reasonCode, "tool.path_scope_denied");
  } finally {
    await rm(workspace.path, { recursive: true, force: true });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Edge cases
// ─────────────────────────────────────────────────────────────────────────────

test("allows path when no roots specified (no restrictions)", async () => {
  const workspace = await createWorkspace();
  try {
    const result = checkPath("/etc/passwd", null);
    assert.equal(result.allowed, true, "Path should be allowed when no roots specified");
    assert.strictEqual(result.reasonCode, null);
  } finally {
    await rm(workspace.path, { recursive: true, force: true });
  }
});

test("allows path when empty roots array specified", async () => {
  const workspace = await createWorkspace();
  try {
    const result = checkPath("/any/path", []);
    assert.equal(result.allowed, true, "Path should be allowed with empty roots");
    assert.strictEqual(result.reasonCode, null);
  } finally {
    await rm(workspace.path, { recursive: true, force: true });
  }
});

test("normalizeToolPathScopeRoots handles various inputs", () => {
  const roots1 = normalizeToolPathScopeRoots(["/path1", "/path2"]);
  assert.equal(roots1.length, 2);

  const roots2 = normalizeToolPathScopeRoots(["  /path1  ", "", "/path2", "/path1"]);
  assert.equal(roots2.length, 2, "Should deduplicate and trim");

  const roots3 = normalizeToolPathScopeRoots(null);
  assert.equal(roots3.length, 0);

  const roots4 = normalizeToolPathScopeRoots(undefined);
  assert.equal(roots4.length, 0);
});

test("hasToolPathScopeRestrictions correctly reports restrictions", () => {
  assert.equal(hasToolPathScopeRestrictions(null), false);
  assert.equal(hasToolPathScopeRestrictions([]), false);
  assert.equal(hasToolPathScopeRestrictions(["/root"]), true);
});

test("returns normalized path in result", async () => {
  const workspace = await createWorkspace();
  try {
    const absolutePath = join(workspace.path, "app", "config.json");
    const result = checkPath(absolutePath, [workspace.path]);
    assert.ok(result.normalizedPath.endsWith("app/config.json") || result.normalizedPath.includes("app"), "Should return normalized path");
  } finally {
    await rm(workspace.path, { recursive: true, force: true });
  }
});
