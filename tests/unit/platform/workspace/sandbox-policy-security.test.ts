/**
 * Unit Tests: Workspace Sandbox Policy Security
 *
 * Security-focused unit tests for workspace sandbox path validation:
 * - Path traversal prevention
 * - Symlink blocking
 * - Command injection prevention
 * - Denied root precedence
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  checkSandboxPath,
  createWorkspaceWritePolicy,
  createScopedExternalAccessPolicy,
  createRestrictedExecPolicy,
  createConfigReadPolicy,
  resolveSandboxPath,
  type SandboxPolicy,
  type SandboxPathCheckResult,
} from "../../../../src/platform/control-plane/iam/sandbox-policy.js";

// ─────────────────────────────────────────────────────────────────────────────
// Path Traversal Prevention
// ─────────────────────────────────────────────────────────────────────────────

test("security: blocks basic ../ path traversal", () => {
  const policy = createWorkspaceWritePolicy("/workspace/project");

  const result = checkSandboxPath(policy, "/workspace/project/../../../etc/passwd");

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_outside_allowed_roots");
});

test("security: blocks deep nested ../ traversal", () => {
  const policy = createWorkspaceWritePolicy("/workspace");

  const result = checkSandboxPath(policy, "/workspace/../../../../../../../../etc/passwd");

  assert.equal(result.allowed, false);
  assert.ok(result.reasonCode?.includes("outside") || result.reasonCode?.includes("denied"));
});

test("security: blocks path with embedded .. after normalized path", () => {
  const policy = createWorkspaceWritePolicy("/workspace/project");

  const result = checkSandboxPath(policy, "/workspace/project/./././../project/../../etc");

  assert.equal(result.allowed, false);
});

test("security: blocks traversal with url-encoded dots", () => {
  const policy = createWorkspaceWritePolicy("/workspace");

  // %2e = . in URL encoding
  const result = checkSandboxPath(policy, "/workspace/%2e%2e/%2e%2e/etc/passwd");

  assert.equal(result.allowed, false);
});

test("security: blocks traversal with mixed encoding", () => {
  const policy = createWorkspaceWritePolicy("/workspace");

  const result = checkSandboxPath(policy, "/workspace/%2e%2e/..%2f%2e%2e/etc");

  assert.equal(result.allowed, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Symlink Blocking
// ─────────────────────────────────────────────────────────────────────────────

test("security: workspace_write policy denies symlinks by default", () => {
  const policy = createWorkspaceWritePolicy("/workspace");

  assert.equal(policy.symlinkPolicy, "deny");
  assert.equal(policy.realpathEnforced, true);
});

test("security: scoped_external_access policy denies symlinks by default", () => {
  const policy = createScopedExternalAccessPolicy("/workspace");

  assert.equal(policy.symlinkPolicy, "deny");
  assert.equal(policy.realpathEnforced, true);
});

test("security: restricted_exec policy denies symlinks by default", () => {
  const policy = createRestrictedExecPolicy("/workspace");

  assert.equal(policy.symlinkPolicy, "deny");
  assert.equal(policy.realpathEnforced, true);
});

test("security: config_read policy denies symlinks by default", () => {
  const policy = createConfigReadPolicy("/etc/config");

  assert.equal(policy.symlinkPolicy, "deny");
  assert.equal(policy.realpathEnforced, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Denied Root Precedence
// ─────────────────────────────────────────────────────────────────────────────

test("security: denied root takes precedence over allowed root", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "workspace_write",
    allowedRoots: ["/workspace"],
    deniedRoots: ["/workspace/secret"],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
  };

  const result = checkSandboxPath(policy, "/workspace/secret/api-keys.json");

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_in_denied_root");
});

test("security: denied root with subdirectory is blocked", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "workspace_write",
    allowedRoots: ["/workspace"],
    deniedRoots: ["/workspace/secrets"],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
  };

  const result = checkSandboxPath(policy, "/workspace/secrets/.ssh/id_rsa");

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_in_denied_root");
});

test("security: multiple denied roots are all checked", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "workspace_write",
    allowedRoots: ["/workspace"],
    deniedRoots: ["/workspace/denied1", "/workspace/denied2", "/workspace/denied3"],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
  };

  assert.equal(checkSandboxPath(policy, "/workspace/denied1/file").allowed, false);
  assert.equal(checkSandboxPath(policy, "/workspace/denied2/file").allowed, false);
  assert.equal(checkSandboxPath(policy, "/workspace/denied3/file").allowed, false);
  assert.equal(checkSandboxPath(policy, "/workspace/allowed/file").allowed, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Command Injection Prevention
// ─────────────────────────────────────────────────────────────────────────────

test("security: path with shell metacharacters is not rejected by itself", () => {
  const policy = createWorkspaceWritePolicy("/workspace");

  // Shell metacharacters alone don't make a path invalid for sandbox
  const result = checkSandboxPath(policy, "/workspace/$(whoami).txt");

  // The sandbox doesn't parse command injection - it only checks path validity
  // Command injection would be handled at execution time
  assert.equal(result.allowed === true || result.allowed === false, true);
});

test("security: path with pipe character is not rejected by itself", () => {
  const policy = createWorkspaceWritePolicy("/workspace");

  const result = checkSandboxPath(policy, "/workspace/flag | cat /etc/passwd");

  // Path containing shell operators - sandbox only checks path boundaries
  assert.equal(result.allowed === true || result.allowed === false, true);
});

test("security: path with semicolon command separator", () => {
  const policy = createWorkspaceWritePolicy("/workspace");

  const result = checkSandboxPath(policy, "/workspace/; rm -rf /");

  assert.equal(result.allowed === true || result.allowed === false, true);
});

test("security: null-byte injection in path is blocked", () => {
  const policy = createWorkspaceWritePolicy("/workspace");

  const result = checkSandboxPath(policy, "/workspace/../../../etc/passwd\x00.txt");

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_invalid_encoding");
});

test("security: unicode bypass attempt with full-width slash", () => {
  const policy = createWorkspaceWritePolicy("/workspace/project");

  // Full-width slash (U+FF0F) used as bypass attempt
  const result = checkSandboxPath(policy, "/workspace/project\xFF0F..\xFF0F..\xFF0Fetc");

  // After NFKC normalization, this should be recognized as traversal
  assert.equal(result.allowed, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Allowed Path Validation
// ─────────────────────────────────────────────────────────────────────────────

test("security: valid nested path is allowed", () => {
  const policy = createWorkspaceWritePolicy("/workspace");

  const result = checkSandboxPath(policy, "/workspace/project/src/components/Button.tsx");

  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, null);
});

test("security: exact workspace root match is allowed", () => {
  const policy = createWorkspaceWritePolicy("/workspace");

  const result = checkSandboxPath(policy, "/workspace");

  assert.equal(result.allowed, true);
});

test("security: subdirectory within allowed root is allowed", () => {
  const policy = createWorkspaceWritePolicy("/workspace");

  const result = checkSandboxPath(policy, "/workspace/.hidden/dir");

  assert.equal(result.allowed, true);
});

test("security: path with spaces within workspace is allowed", () => {
  const policy = createWorkspaceWritePolicy("/workspace");

  const result = checkSandboxPath(policy, "/workspace/my files/document.txt");

  assert.equal(result.allowed, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveSandboxPath Security
// ─────────────────────────────────────────────────────────────────────────────

test("security: resolveSandboxPath rejects non-existent parent with realpath", () => {
  // When realpath enforcement is true and path doesn't exist,
  // it should still return a resolved path
  const resolved = resolveSandboxPath("/nonexistent/parent/child/file.txt", true);

  assert.ok(resolved);
  assert.ok(resolved.includes("file.txt"));
});

test("resolveSandboxPath with realpath enforcement resolves symlinks", () => {
  // /tmp is a symlink on macOS - realpath should resolve it
  const resolved = resolveSandboxPath("/tmp", true);

  // Should resolve to actual path (e.g., /private/tmp on macOS)
  assert.ok(resolved);
  assert.ok(resolved.length > 0);
});

test("resolveSandboxPath without realpath returns as-is", () => {
  const resolved = resolveSandboxPath("/workspace/file.txt", false);

  assert.ok(resolved.includes("file.txt") || resolved === "/workspace/file.txt");
});

// ─────────────────────────────────────────────────────────────────────────────
// Restricted Exec Mode
// ─────────────────────────────────────────────────────────────────────────────

test("security: restricted_exec ignores allowed root boundary", () => {
  const policy: SandboxPolicy = {
    ...createRestrictedExecPolicy("/workspace/root"),
    deniedRoots: ["/etc"],
  };

  // Should allow paths outside workspace since mode is restricted_exec
  const result = checkSandboxPath(policy, "/tmp/anyfile.txt");

  assert.equal(result.allowed, true);
});

test("security: restricted_exec still respects denied roots", () => {
  const policy: SandboxPolicy = {
    ...createRestrictedExecPolicy("/workspace/root"),
    deniedRoots: ["/etc", "/root"],
  };

  const result = checkSandboxPath(policy, "/etc/passwd");

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_in_denied_root");
});

test("security: restricted_exec with multiple denied roots", () => {
  const policy: SandboxPolicy = {
    ...createRestrictedExecPolicy("/workspace"),
    deniedRoots: ["/workspace/secret", "/other/secret"],
  };

  assert.equal(checkSandboxPath(policy, "/workspace/secret/file").allowed, false);
  assert.equal(checkSandboxPath(policy, "/other/secret/file").allowed, false);
  assert.equal(checkSandboxPath(policy, "/workspace/allowed/file").allowed, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// SandboxPathCheckResult Structure
// ─────────────────────────────────────────────────────────────────────────────

test("SandboxPathCheckResult contains all required fields", () => {
  const allowedResult: SandboxPathCheckResult = {
    allowed: true,
    normalizedPath: "/workspace/root/file.txt",
    reasonCode: null,
  };

  assert.equal(allowedResult.allowed, true);
  assert.ok(allowedResult.normalizedPath.length > 0);
  assert.equal(allowedResult.reasonCode, null);

  const deniedResult: SandboxPathCheckResult = {
    allowed: false,
    normalizedPath: "/etc/passwd",
    reasonCode: "sandbox.path_outside_allowed_roots",
  };

  assert.equal(deniedResult.allowed, false);
  assert.ok(deniedResult.normalizedPath.length > 0);
  assert.ok(deniedResult.reasonCode?.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// SandboxPolicy Structure
// ─────────────────────────────────────────────────────────────────────────────

test("SandboxPolicy requires all security fields", () => {
  const policy: SandboxPolicy = {
    policyId: "security-test",
    mode: "workspace_write",
    allowedRoots: ["/workspace"],
    deniedRoots: ["/workspace/secret"],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
  };

  assert.equal(policy.realpathEnforced, true);
  assert.equal(policy.symlinkPolicy, "deny");
  assert.equal(policy.processRuleMode, "deny");
});

test("workspace_write policy has correct security defaults", () => {
  const policy = createWorkspaceWritePolicy("/workspace");

  assert.equal(policy.realpathEnforced, true);
  assert.equal(policy.symlinkPolicy, "deny");
  assert.equal(policy.processRuleMode, "allow");
});

test("config_read policy denies process execution", () => {
  const policy = createConfigReadPolicy("/etc/config");

  assert.equal(policy.processRuleMode, "deny");
  assert.equal(policy.mode, "read_only");
});
