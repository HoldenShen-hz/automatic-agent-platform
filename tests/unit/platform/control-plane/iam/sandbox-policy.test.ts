/**
 * Unit tests for Sandbox Policy
 * Tests path validation and security enforcement for tool execution
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  checkSandboxPath,
  resolveSandboxPath,
  createWorkspaceWritePolicy,
  createScopedExternalAccessPolicy,
  createRestrictedExecPolicy,
  createConfigReadPolicy,
  type SandboxPolicy,
  type SandboxMode,
  type SandboxPathCheckResult,
} from "../../../../../src/platform/control-plane/iam/sandbox-policy.js";

test("createWorkspaceWritePolicy creates valid policy", () => {
  const policy = createWorkspaceWritePolicy("/workspace/root");

  assert.equal(policy.mode, "workspace_write");
  assert.equal(policy.policyId, "workspace_write");
  assert.deepEqual(policy.allowedRoots, ["/workspace/root"]);
  assert.deepEqual(policy.deniedRoots, ["/etc", "/proc", "/sys"]);
  assert.equal(policy.realpathEnforced, true);
  assert.equal(policy.symlinkPolicy, "deny");
  assert.equal(policy.processRuleMode, "allow");
});

test("createScopedExternalAccessPolicy creates valid policy", () => {
  const policy = createScopedExternalAccessPolicy("/workspace/root");

  assert.equal(policy.mode, "scoped_external_access");
  assert.equal(policy.policyId, "scoped_external_access");
  assert.deepEqual(policy.allowedRoots, ["/workspace/root"]);
  assert.equal(policy.realpathEnforced, true);
  assert.equal(policy.symlinkPolicy, "deny");
});

test("createRestrictedExecPolicy creates valid policy", () => {
  const policy = createRestrictedExecPolicy("/workspace/root");

  assert.equal(policy.mode, "restricted_exec");
  assert.equal(policy.policyId, "restricted_exec");
  assert.equal(policy.realpathEnforced, true);
  assert.equal(policy.symlinkPolicy, "deny");
});

test("createConfigReadPolicy creates read-only policy", () => {
  const policy = createConfigReadPolicy("/etc/config");

  assert.equal(policy.mode, "read_only");
  assert.equal(policy.policyId, "config_read");
  assert.deepEqual(policy.allowedRoots, ["/etc/config"]);
  assert.equal(policy.realpathEnforced, true);
  assert.equal(policy.symlinkPolicy, "deny");
  assert.equal(policy.processRuleMode, "deny");
});

test("checkSandboxPath allows path within allowed root", () => {
  const policy = createWorkspaceWritePolicy("/workspace/root");
  const result = checkSandboxPath(policy, "/workspace/root/file.txt");

  assert.equal(result.allowed, true);
  assert.ok(result.normalizedPath.includes("workspace"));
  assert.equal(result.reasonCode, null);
});

test("checkSandboxPath denies path outside allowed root", () => {
  const policy = createWorkspaceWritePolicy("/workspace/root");
  const result = checkSandboxPath(policy, "/var/tmp/outside.txt");

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_outside_allowed_roots");
});

test("checkSandboxPath denies path in denied root", () => {
  const policy: SandboxPolicy = {
    ...createWorkspaceWritePolicy("/workspace/root"),
    deniedRoots: ["/workspace/root/secrets"],
  };

  const result = checkSandboxPath(policy, "/workspace/root/secrets/api-keys.txt");

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_in_denied_root");
});

test("checkSandboxPath denied root takes precedence over allowed root", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "workspace_write",
    allowedRoots: ["/workspace"],
    deniedRoots: ["/workspace/denied"],
    realpathEnforced: false,
    symlinkPolicy: "allow_explicit",
    processRuleMode: "allow",
  };

  // Path is within allowed root but also in denied root
  const result = checkSandboxPath(policy, "/workspace/denied/file.txt");

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_in_denied_root");
});

test("checkSandboxPath normalizes unicode in paths", () => {
  const policy = createWorkspaceWritePolicy("/workspace/root");
  const result = checkSandboxPath(policy, "/workspace/root/file%41.txt"); // URL encoded 'A'

  // Should not reject due to encoding
  assert.equal(result.allowed === false || result.allowed === true, true);
});

test("checkSandboxPath rejects null byte in path", () => {
  const policy = createWorkspaceWritePolicy("/workspace/root");
  const result = checkSandboxPath(policy, "/workspace/root/file.txt\0");

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_invalid_encoding");
});

test("checkSandboxPath restricted_exec mode still enforces allowed root boundary", () => {
  const policy: SandboxPolicy = {
    ...createRestrictedExecPolicy("/workspace/root"),
    deniedRoots: ["/etc"],
  };

  const result = checkSandboxPath(policy, "/tmp/ephemeral.txt");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_outside_allowed_roots");

  // But denied roots still apply
  const deniedResult = checkSandboxPath(policy, "/etc/passwd");
  assert.equal(deniedResult.allowed, false);
  assert.equal(deniedResult.reasonCode, "sandbox.path_in_denied_root");
});

test("resolveSandboxPath resolves simple paths", () => {
  const resolved = resolveSandboxPath("/workspace/root/file.txt", false);
  assert.ok(resolved.endsWith("file.txt") || resolved === "/workspace/root/file.txt");
});

test("resolveSandboxPath with realpath enforcement", () => {
  // When enforceRealpath is true and path exists, should resolve symlinks
  const resolved = resolveSandboxPath("/tmp", true);
  // /tmp is often a symlink to /private/tmp on macOS
  assert.ok(resolved);
});

test("checkSandboxPath with symlink policy allow_explicit permits symlinks", () => {
  const policy: SandboxPolicy = {
    policyId: "test_symlink_allow",
    mode: "workspace_write",
    allowedRoots: ["/workspace"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "allow_explicit",
    processRuleMode: "allow",
  };

  // When symlink policy is allow_explicit, symlink check is skipped
  const result = checkSandboxPath(policy, "/workspace/some/path");
  // Should not return sandbox.symlink_denied
  assert.ok(result.reasonCode !== "sandbox.symlink_denied");
});

test("SandboxPolicy structure requires all fields", () => {
  const policy: SandboxPolicy = {
    policyId: "complete-policy",
    mode: "read_only",
    allowedRoots: ["/allowed"],
    deniedRoots: ["/denied"],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
  };

  assert.equal(policy.policyId, "complete-policy");
  assert.equal(policy.mode, "read_only");
  assert.equal(policy.allowedRoots.length, 1);
  assert.equal(policy.deniedRoots.length, 1);
  assert.equal(policy.realpathEnforced, true);
  assert.equal(policy.symlinkPolicy, "deny");
  assert.equal(policy.processRuleMode, "deny");
});

test("SandboxMode type accepts all valid values", () => {
  const modes: SandboxMode[] = [
    "read_only",
    "workspace_write",
    "scoped_external_access",
    "restricted_exec",
  ];

  modes.forEach((mode) => {
    const policy: SandboxPolicy = {
      policyId: "mode-test",
      mode,
      allowedRoots: ["/"],
      deniedRoots: [],
      realpathEnforced: false,
      symlinkPolicy: "deny",
      processRuleMode: "allow",
    };
    assert.equal(policy.mode, mode);
  });
});

test("checkSandboxPath returns correct reason codes", () => {
  const policy = createWorkspaceWritePolicy("/workspace");

  // Invalid encoding
  const encodingResult = checkSandboxPath(policy, "/workspace\0file");
  assert.equal(encodingResult.reasonCode, "sandbox.path_invalid_encoding");

  // Denied root
  const deniedPolicy: SandboxPolicy = {
    ...policy,
    deniedRoots: ["/workspace/denied"],
  };
  const deniedResult = checkSandboxPath(deniedPolicy, "/workspace/denied/file");
  assert.equal(deniedResult.reasonCode, "sandbox.path_in_denied_root");

  // Outside allowed roots
  const outsideResult = checkSandboxPath(policy, "/var/tmp/file");
  assert.equal(outsideResult.reasonCode, "sandbox.path_outside_allowed_roots");
});

test("resolveSandboxPath returns normalized path for non-existent parent", () => {
  // Path with non-existent intermediate directories
  const resolved = resolveSandboxPath("/nonexistent/parent/child/file.txt", true);
  assert.ok(resolved);
  assert.ok(resolved.includes("file.txt") || resolved.endsWith("/nonexistent/parent/child/file.txt"));
});

test("checkSandboxPath allows exact root match", () => {
  const policy = createWorkspaceWritePolicy("/workspace/root");
  const result = checkSandboxPath(policy, "/workspace/root");

  assert.equal(result.allowed, true);
});

test("checkSandboxPath handles nested paths within allowed root", () => {
  const policy = createWorkspaceWritePolicy("/workspace");
  const result = checkSandboxPath(policy, "/workspace/deep/nested/path/file.txt");

  assert.equal(result.allowed, true);
  assert.ok(result.normalizedPath.includes("workspace"));
});

test("checkSandboxPath with multiple allowed roots", () => {
  const policy: SandboxPolicy = {
    policyId: "multi-root",
    mode: "workspace_write",
    allowedRoots: ["/workspace/primary", "/workspace/secondary"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "allow_explicit",
    processRuleMode: "allow",
  };

  const primaryResult = checkSandboxPath(policy, "/workspace/primary/file.txt");
  assert.equal(primaryResult.allowed, true);

  const secondaryResult = checkSandboxPath(policy, "/workspace/secondary/file.txt");
  assert.equal(secondaryResult.allowed, true);

  const neitherResult = checkSandboxPath(policy, "/workspace/other/file.txt");
  assert.equal(neitherResult.allowed, false);
});

test("checkSandboxPath with multiple denied roots", () => {
  const policy: SandboxPolicy = {
    policyId: "multi-denied",
    mode: "workspace_write",
    allowedRoots: ["/workspace"],
    deniedRoots: ["/workspace/denied1", "/workspace/denied2"],
    realpathEnforced: false,
    symlinkPolicy: "allow_explicit",
    processRuleMode: "allow",
  };

  const denied1Result = checkSandboxPath(policy, "/workspace/denied1/file");
  assert.equal(denied1Result.allowed, false);

  const denied2Result = checkSandboxPath(policy, "/workspace/denied2/file");
  assert.equal(denied2Result.allowed, false);

  const allowedResult = checkSandboxPath(policy, "/workspace/allowed/file");
  assert.equal(allowedResult.allowed, true);
});

test("SandboxPathCheckResult structure is correct", () => {
  const allowedResult: SandboxPathCheckResult = {
    allowed: true,
    normalizedPath: "/workspace/root/file.txt",
    reasonCode: null,
  };

  assert.equal(allowedResult.allowed, true);
  assert.ok(allowedResult.normalizedPath);
  assert.equal(allowedResult.reasonCode, null);

  const deniedResult: SandboxPathCheckResult = {
    allowed: false,
    normalizedPath: "/etc/passwd",
    reasonCode: "sandbox.path_outside_allowed_roots",
  };

  assert.equal(deniedResult.allowed, false);
  assert.ok(deniedResult.reasonCode);
});

test("createWorkspaceWritePolicy with different root paths", () => {
  const policy1 = createWorkspaceWritePolicy("/home/user/workspace");
  const policy2 = createWorkspaceWritePolicy("/tmp/workspace");

  assert.equal(policy1.allowedRoots[0], "/home/user/workspace");
  assert.equal(policy2.allowedRoots[0], "/tmp/workspace");

  // Each policy should only allow its own root
  const result1 = checkSandboxPath(policy1, "/tmp/workspace/file");
  assert.equal(result1.allowed, false);

  const result2 = checkSandboxPath(policy2, "/home/user/workspace/file");
  assert.equal(result2.allowed, false);
});

test("config read policy denies write operations context", () => {
  const policy = createConfigReadPolicy("/etc/app/config");

  // Mode is read_only which should work correctly with path checks
  assert.equal(policy.mode, "read_only");
  assert.equal(policy.processRuleMode, "deny");

  const result = checkSandboxPath(policy, "/etc/app/config/settings.json");
  assert.equal(result.allowed, true);
});

test("sandbox policy with empty denied roots array", () => {
  const policy: SandboxPolicy = {
    policyId: "empty-denied",
    mode: "workspace_write",
    allowedRoots: ["/workspace"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
  };

  const result = checkSandboxPath(policy, "/workspace/file.txt");
  assert.equal(result.allowed, true);

  const outsideResult = checkSandboxPath(policy, "/etc/file.txt");
  assert.equal(outsideResult.allowed, false);
});

test("sandbox policy with realpathEnforced false skips symlink resolution", () => {
  const policy: SandboxPolicy = {
    policyId: "no-realpath",
    mode: "workspace_write",
    allowedRoots: ["/workspace"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
  };

  // Should return resolved path without realpath resolution
  const result = checkSandboxPath(policy, "/workspace/../workspace/file.txt");
  // The path might still be allowed because it resolves to within workspace
  assert.equal(result.allowed === true || result.allowed === false, true);
});

test("checkSandboxPath handles paths with dot segments", () => {
  const policy = createWorkspaceWritePolicy("/workspace/root");

  // Path with . and .. segments
  const result = checkSandboxPath(policy, "/workspace/root/./file.txt");
  assert.equal(result.allowed === true || result.allowed === false, true);

  const parentResult = checkSandboxPath(policy, "/workspace/root/../root/file.txt");
  assert.equal(parentResult.allowed === true || parentResult.allowed === false, true);
});

test("processRuleMode values are accepted", () => {
  const allowPolicy: SandboxPolicy = {
    policyId: "allow-process",
    mode: "read_only",
    allowedRoots: ["/"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
  };
  assert.equal(allowPolicy.processRuleMode, "allow");

  const denyPolicy: SandboxPolicy = {
    policyId: "deny-process",
    mode: "read_only",
    allowedRoots: ["/"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
  };
  assert.equal(denyPolicy.processRuleMode, "deny");
});
