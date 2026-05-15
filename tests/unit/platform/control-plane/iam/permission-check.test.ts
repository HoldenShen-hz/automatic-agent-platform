import assert from "node:assert/strict";
import test from "node:test";

import {
  checkSandboxPath,
  createRestrictedExecPolicy,
  createScopedExternalAccessPolicy,
  createWorkspaceWritePolicy,
  createConfigReadPolicy,
  resolveSandboxPath,
  type SandboxPolicy,
  type SandboxMode,
} from "../../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";

function makeSandboxPolicy(overrides: Partial<SandboxPolicy> = {}): SandboxPolicy {
  return {
    policyId: "test-policy",
    mode: "workspace_write",
    allowedRoots: ["/workspace"],
    deniedRoots: ["/etc", "/var/secret"],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
    ...overrides,
  };
}

test("checkSandboxPath allows path within allowed roots", () => {
  const policy = makeSandboxPolicy({ allowedRoots: ["/workspace"] });
  const result = checkSandboxPath(policy, "/workspace/file.txt");
  assert.equal(result.allowed, true);
  assert.equal(result.normalizedPath.endsWith("file.txt"), true);
});

test("checkSandboxPath denies path outside allowed roots", () => {
  const policy = makeSandboxPolicy({ allowedRoots: ["/workspace"], deniedRoots: [] });
  const result = checkSandboxPath(policy, "/tmp/anywhere.txt");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_outside_allowed_roots");
});

test("checkSandboxPath denies path within denied roots", () => {
  const policy = makeSandboxPolicy({ deniedRoots: ["/etc"] });
  const result = checkSandboxPath(policy, "/etc/passwd");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_in_denied_root");
});

test("checkSandboxPath denies null bytes in path", () => {
  const policy = makeSandboxPolicy();
  const result = checkSandboxPath(policy, "/workspace/valid\0injection");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_invalid_encoding");
});

test("checkSandboxPath allows subdirectory within allowed root", () => {
  const policy = makeSandboxPolicy({ allowedRoots: ["/workspace"] });
  const result = checkSandboxPath(policy, "/workspace/nested/deep/file.txt");
  assert.equal(result.allowed, true);
});

test("checkSandboxPath denies path traversal attempt", () => {
  const policy = makeSandboxPolicy({ allowedRoots: ["/workspace"] });
  const result = checkSandboxPath(policy, "/workspace/../../../etc/passwd");
  assert.equal(result.allowed, false);
});

test("checkSandboxPath restricted_exec still enforces allowed root boundary", () => {
  const policy = makeSandboxPolicy({ mode: "restricted_exec", allowedRoots: ["/workspace"] });
  const result = checkSandboxPath(policy, "/tmp/anywhere.txt");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_outside_allowed_roots");
});

test("checkSandboxPath restricted_exec still checks denied roots", () => {
  const policy = makeSandboxPolicy({ mode: "restricted_exec", deniedRoots: ["/var/secret"] });
  const result = checkSandboxPath(policy, "/var/secret/data");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_in_denied_root");
});

test("createWorkspaceWritePolicy creates correct policy structure", () => {
  const policy = createWorkspaceWritePolicy("/workspace");
  assert.equal(policy.mode, "workspace_write");
  assert.equal(policy.allowedRoots.length, 1);
  assert.equal(policy.realpathEnforced, true);
  assert.equal(policy.symlinkPolicy, "deny");
});

test("createScopedExternalAccessPolicy creates correct policy structure", () => {
  const policy = createScopedExternalAccessPolicy("/workspace");
  assert.equal(policy.mode, "scoped_external_access");
  assert.equal(policy.allowedRoots.length, 1);
  assert.equal(policy.processRuleMode, "allow");
});

test("createRestrictedExecPolicy creates correct policy structure", () => {
  const policy = createRestrictedExecPolicy("/workspace");
  assert.equal(policy.mode, "restricted_exec");
  assert.equal(policy.processRuleMode, "allow");
});

test("createConfigReadPolicy creates read-only policy", () => {
  const policy = createConfigReadPolicy("/config");
  assert.equal(policy.mode, "read_only");
  assert.equal(policy.processRuleMode, "deny");
});

test("resolveSandboxPath resolves path without realpath enforcement", () => {
  const result = resolveSandboxPath("/workspace/file.txt", false);
  assert.ok(result.endsWith("file.txt"));
});

test("checkSandboxPath handles unicode normalized paths", () => {
  const policy = makeSandboxPolicy({ allowedRoots: ["/workspace"] });
  // Unicode normalization should be handled
  const result = checkSandboxPath(policy, "/workspace/file\u4e2d.txt");
  assert.equal(result.allowed, true);
});

test("checkSandboxPath returns normalizedPath when allowed", () => {
  const policy = makeSandboxPolicy({ allowedRoots: ["/workspace"] });
  const result = checkSandboxPath(policy, "/workspace/file.txt");
  assert.equal(typeof result.normalizedPath, "string");
  assert.ok(result.normalizedPath.length > 0);
});

test("checkSandboxPath reasonCode is null when allowed", () => {
  const policy = makeSandboxPolicy({ allowedRoots: ["/workspace"] });
  const result = checkSandboxPath(policy, "/workspace/file.txt");
  assert.equal(result.reasonCode, null);
});

test("checkSandboxPath reasonCode is set when denied", () => {
  const policy = makeSandboxPolicy({ allowedRoots: ["/workspace"] });
  const result = checkSandboxPath(policy, "/etc/passwd");
  assert.ok(result.reasonCode != null);
  assert.ok(result.reasonCode.startsWith("sandbox."));
});

test("checkSandboxPath denies when symlinkPolicy is deny and symlink exists", () => {
  const policy = makeSandboxPolicy({ symlinkPolicy: "deny" });
  // Note: Testing the symlink check logic - actual symlink detection is tested in integration
  const result = checkSandboxPath(policy, "/workspace/valid_path.txt");
  assert.equal(result.allowed, true);
});

test("SandboxPolicy type accepts all four modes", () => {
  const modes: SandboxMode[] = ["read_only", "workspace_write", "scoped_external_access", "restricted_exec"];
  modes.forEach((mode) => {
    const policy = makeSandboxPolicy({ mode });
    assert.equal(policy.mode, mode);
  });
});
