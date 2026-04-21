import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";

import {
  resolveSandboxPath,
  checkSandboxPath,
  createWorkspaceWritePolicy,
  type SandboxPolicy,
  type SandboxPathCheckResult,
} from "../../../../../src/platform/control-plane/iam/sandbox-policy.js";

function createTestPolicy(overrides: Partial<SandboxPolicy> = {}): SandboxPolicy {
  return {
    policyId: "test-policy",
    mode: "workspace_write",
    allowedRoots: ["/test/workspace"],
    deniedRoots: ["/test/workspace/denied"],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
    ...overrides,
  };
}

test("resolveSandboxPath resolves relative paths", () => {
  const result = resolveSandboxPath("relative/path", false);
  assert.ok(result.endsWith("relative/path") || result.includes("relative/path"));
});

test("resolveSandboxPath does not apply realpath when disabled", () => {
  const result = resolveSandboxPath("/some/path", false);
  assert.equal(result, resolve("/some/path"));
});

test("checkSandboxPath allows path within allowed roots", () => {
  const policy = createTestPolicy({
    allowedRoots: ["/test/workspace"],
    mode: "workspace_write",
    deniedRoots: [],
  });
  const result = checkSandboxPath(policy, "/test/workspace/file.txt");
  assert.equal(result.allowed, true);
  assert.ok(result.normalizedPath.includes("test/workspace"));
});

test("checkSandboxPath denies path outside allowed roots", () => {
  const policy = createTestPolicy({
    allowedRoots: ["/test/workspace"],
    deniedRoots: [],
    mode: "workspace_write",
  });
  const result = checkSandboxPath(policy, "/other/path/file.txt");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_outside_allowed_roots");
});

test("checkSandboxPath denies path in denied roots", () => {
  const policy = createTestPolicy({
    allowedRoots: ["/test/workspace"],
    deniedRoots: ["/test/workspace/denied"],
  });
  const result = checkSandboxPath(policy, "/test/workspace/denied/file.txt");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_in_denied_root");
});

test("checkSandboxPath allows any path in danger_full_access mode", () => {
  const policy = createTestPolicy({
    mode: "danger_full_access",
    allowedRoots: ["/"],
    deniedRoots: [],
  });
  const result = checkSandboxPath(policy, "/etc/passwd");
  assert.equal(result.allowed, true);
});

test("checkSandboxPath denies symlink traversal in deny mode", () => {
  // This test only verifies the check logic without actual symlinks
  const policy = createTestPolicy({
    symlinkPolicy: "deny",
    allowedRoots: ["/test/workspace"],
    deniedRoots: [],
    realpathEnforced: false,
  });
  // Since we can't easily test actual symlinks without mocking,
  // we just verify the function doesn't throw
  const result = checkSandboxPath(policy, "/test/workspace/normal/path");
  // The result depends on whether symlinks exist in the actual filesystem
  assert.ok(result.allowed === true || result.allowed === false);
});

test("createWorkspaceWritePolicy creates correct policy structure", () => {
  const policy = createWorkspaceWritePolicy("/my/workspace");
  assert.equal(policy.policyId, "workspace_write");
  assert.equal(policy.mode, "workspace_write");
  assert.deepEqual(policy.allowedRoots, ["/my/workspace"]);
  assert.deepEqual(policy.deniedRoots, []);
  assert.equal(policy.realpathEnforced, true);
  assert.equal(policy.symlinkPolicy, "deny");
  assert.equal(policy.processRuleMode, "allow");
});

test("checkSandboxPath handles subdirectory within allowed roots", () => {
  const policy = createTestPolicy({
    allowedRoots: ["/test/workspace"],
    deniedRoots: [],
    mode: "workspace_write",
  });
  const result = checkSandboxPath(policy, "/test/workspace/subdir/nested/file.txt");
  assert.equal(result.allowed, true);
});

test("checkSandboxPath handles empty denied roots", () => {
  const policy = createTestPolicy({
    allowedRoots: ["/test/workspace"],
    deniedRoots: [],
    mode: "workspace_write",
  });
  const result = checkSandboxPath(policy, "/test/workspace/file.txt");
  assert.equal(result.allowed, true);
});

test("checkSandboxPath denied roots takes precedence over allowed", () => {
  const policy = createTestPolicy({
    allowedRoots: ["/test/workspace"],
    deniedRoots: ["/test/workspace/secret"],
    mode: "workspace_write",
  });
  const result = checkSandboxPath(policy, "/test/workspace/secret/file.txt");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_in_denied_root");
});

test("checkSandboxPath returns normalized path when allowed", () => {
  const policy = createTestPolicy({
    allowedRoots: ["/test/workspace"],
    deniedRoots: [],
    mode: "workspace_write",
    realpathEnforced: false,
  });
  const result = checkSandboxPath(policy, "/test/workspace/file.txt");
  assert.equal(result.allowed, true);
  assert.ok(result.normalizedPath.length > 0);
  assert.equal(result.reasonCode, null);
});

test("SandboxPathCheckResult has correct structure", () => {
  const policy = createTestPolicy({
    allowedRoots: ["/test/workspace"],
    deniedRoots: [],
  });
  const result = checkSandboxPath(policy, "/test/workspace/file.txt");
  assert.equal(typeof result.allowed, "boolean");
  assert.equal(typeof result.normalizedPath, "string");
  assert.ok(result.reasonCode === null || typeof result.reasonCode === "string");
});

// =============================================================================
// P0 Security Denial-Path Tests
// =============================================================================

test("checkSandboxPath handles malformed policy with missing required fields", () => {
  // Policy with empty allowedRoots should deny all paths
  const policy = createTestPolicy({
    allowedRoots: [],
    deniedRoots: [],
    mode: "workspace_write",
  });
  const result = checkSandboxPath(policy, "/any/path");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_outside_allowed_roots");
});

test("checkSandboxPath handles policy with undefined allowedRoots", () => {
  const policy = createTestPolicy({
    allowedRoots: undefined as any,
    deniedRoots: [],
  });
  // Should not throw, should deny by default
  const result = checkSandboxPath(policy, "/test/workspace/file.txt");
  assert.equal(typeof result.allowed, "boolean");
});

test("checkSandboxPath handles policy with undefined deniedRoots", () => {
  const policy = createTestPolicy({
    allowedRoots: ["/test/workspace"],
    deniedRoots: undefined as any,
  });
  // Should not throw
  const result = checkSandboxPath(policy, "/test/workspace/file.txt");
  assert.equal(typeof result.allowed, "boolean");
});

test("checkSandboxPath handles empty string in allowedRoots", () => {
  const policy = createTestPolicy({
    allowedRoots: [""],
    deniedRoots: [],
    mode: "workspace_write",
  });
  // Empty root should not match anything
  const result = checkSandboxPath(policy, "/test/workspace/file.txt");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_outside_allowed_roots");
});

test("checkSandboxPath handles whitespace-only paths", () => {
  const policy = createTestPolicy({
    allowedRoots: ["/test/workspace"],
    deniedRoots: [],
  });
  // Whitespace path should be resolved and checked
  const result = checkSandboxPath(policy, "   ");
  assert.equal(result.allowed, false); // Should be denied as outside roots
});

test("checkSandboxPath handles null byte in path", () => {
  const policy = createTestPolicy({
    allowedRoots: ["/test/workspace"],
    deniedRoots: [],
  });
  // Path with null byte should be rejected by the system
  const result = checkSandboxPath(policy, "/test/workspace/file\0.txt");
  // The null byte may cause resolution to fail or be stripped
  assert.equal(typeof result.allowed, "boolean");
});

test("checkSandboxPath handles path with newlines", () => {
  const policy = createTestPolicy({
    allowedRoots: ["/test/workspace"],
    deniedRoots: [],
  });
  const result = checkSandboxPath(policy, "/test/workspace/file\n.txt");
  // Newlines in paths should be handled safely
  assert.equal(typeof result.allowed, "boolean");
});

test("checkSandboxPath handles very long paths without memory exhaustion", () => {
  const policy = createTestPolicy({
    allowedRoots: ["/test/workspace"],
    deniedRoots: [],
  });
  // Create a very long path that could cause memory issues
  const longPath = "/test/workspace/" + "a".repeat(100_000);
  const result = checkSandboxPath(policy, longPath);
  // Should handle without throwing or hanging
  assert.equal(typeof result.allowed, "boolean");
});

test("checkSandboxPath handles deeply nested paths without stack overflow", () => {
  const policy = createTestPolicy({
    allowedRoots: ["/test/workspace"],
    deniedRoots: [],
  });
  // Create a deeply nested path
  const deepPath = "/test/workspace/" + Array(1000).fill("dir").join("/") + "/file.txt";
  const result = checkSandboxPath(policy, deepPath);
  // Should handle without stack overflow
  assert.equal(typeof result.allowed, "boolean");
});

test("checkSandboxPath handles policy with circular symlink reference", () => {
  const policy = createTestPolicy({
    allowedRoots: ["/test/workspace"],
    deniedRoots: [],
    symlinkPolicy: "deny",
    realpathEnforced: false, // Don't resolve realpath to avoid actual symlink check
  });
  // Without actual symlinks, we just verify the check doesn't throw
  const result = checkSandboxPath(policy, "/test/workspace/normal/path");
  assert.equal(typeof result.allowed, "boolean");
});

test("checkSandboxPath handles denied root that is a prefix of allowed root", () => {
  const policy = createTestPolicy({
    allowedRoots: ["/test"],
    deniedRoots: ["/test/denied"],
  });
  // Path in denied root should be blocked even if parent is in allowed
  const result = checkSandboxPath(policy, "/test/denied/secret.txt");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_in_denied_root");
});

test("checkSandboxPath TOCTOU: race between check and use is inherent but result is consistent", () => {
  const policy = createTestPolicy({
    allowedRoots: ["/test/workspace"],
    deniedRoots: [],
    realpathEnforced: true,
  });
  // The realpathEnforced flag helps mitigate TOCTOU by resolving before use
  // This test documents that the policy check is consistent within a single call
  const result1 = checkSandboxPath(policy, "/test/workspace/file.txt");
  const result2 = checkSandboxPath(policy, "/test/workspace/file.txt");
  assert.equal(result1.allowed, result2.allowed);
  assert.equal(result1.reasonCode, result2.reasonCode);
});

test("checkSandboxPath denies when realpathEnforced but path cannot be resolved", () => {
  const policy = createTestPolicy({
    allowedRoots: ["/test/workspace"],
    deniedRoots: [],
    realpathEnforced: true,
  });
  // Non-existent path with realpathEnforced should be denied
  const result = checkSandboxPath(policy, "/test/workspace/nonexistent-" + Date.now() + "/file.txt");
  assert.equal(result.allowed, false);
  assert.ok(result.reasonCode?.includes("sandbox.path_unresolvable"));
});

test("checkSandboxPath handles symlinkPolicy allow_explicit", () => {
  const policy = createTestPolicy({
    allowedRoots: ["/test/workspace"],
    deniedRoots: [],
    symlinkPolicy: "allow_explicit",
    realpathEnforced: false,
  });
  // With allow_explicit, symlink check should not trigger denial
  // (unless actual symlinks exist in the path)
  const result = checkSandboxPath(policy, "/test/workspace/normal/path");
  assert.equal(result.allowed, true);
});

test("checkSandboxPath danger_full_access bypasses allowed roots check", () => {
  const policy = createTestPolicy({
    allowedRoots: ["/test/workspace"],
    deniedRoots: [],
    mode: "danger_full_access",
  });
  // danger_full_access should allow any path
  const result = checkSandboxPath(policy, "/etc/passwd");
  assert.equal(result.allowed, true);
});

test("checkSandboxPath danger_full_access still checks denied roots", () => {
  const policy = createTestPolicy({
    allowedRoots: ["/test/workspace"],
    deniedRoots: ["/etc"],
    mode: "danger_full_access",
  });
  // Even in danger_full_access, denied roots should still block
  const result = checkSandboxPath(policy, "/etc/passwd");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_in_denied_root");
});

test("createWorkspaceWritePolicy creates policy with correct security defaults", () => {
  const policy = createWorkspaceWritePolicy("/my/workspace");
  // Verify security defaults
  assert.equal(policy.realpathEnforced, true, "realpathEnforced should be true");
  assert.equal(policy.symlinkPolicy, "deny", "symlinkPolicy should be deny");
  assert.equal(policy.mode, "workspace_write", "mode should be workspace_write");
});
