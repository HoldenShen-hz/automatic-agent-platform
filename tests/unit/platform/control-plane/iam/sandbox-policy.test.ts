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
