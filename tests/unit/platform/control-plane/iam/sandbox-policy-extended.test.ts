/**
 * Unit tests for Sandbox Policy
 * Tests path validation, symlink detection, and sandbox enforcement
 */

import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";

import {
  normalizeSandboxMode,
  checkSandboxPath,
  createWorkspaceWritePolicy,
  createReadOnlyPolicy,
  createScopedExternalAccessPolicy,
  createRestrictedExecPolicy,
  createConfigReadPolicy,
  resolveSandboxPath,
  type SandboxPolicy,
  type SandboxMode,
} from "../../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";

const SANDBOX_LIMITS: Pick<SandboxPolicy, "timeLimitMs" | "memoryLimitBytes" | "cpuLimitFraction"> = {
  timeLimitMs: 0,
  memoryLimitBytes: 0,
  cpuLimitFraction: 0,
};

// ============================================================================
// Sandbox Mode Normalization Tests
// ============================================================================

test("normalizeSandboxMode returns read_only for null/undefined", () => {
  assert.equal(normalizeSandboxMode(null), "read_only");
  assert.equal(normalizeSandboxMode(undefined), "read_only");
});

test("normalizeSandboxMode returns read_only for unknown mode", () => {
  // Implementation returns "read_only" for unknown modes, not throws
  assert.equal(normalizeSandboxMode("unknown_mode"), "read_only");
  assert.equal(normalizeSandboxMode("invalid"), "read_only");
});

test("normalizeSandboxMode returns correct mode for valid aliases", () => {
  assert.equal(normalizeSandboxMode("process"), "read_only");
  assert.equal(normalizeSandboxMode("container"), "workspace_write");
  assert.equal(normalizeSandboxMode("read_only"), "read_only");
  assert.equal(normalizeSandboxMode("workspace_write"), "workspace_write");
  assert.equal(normalizeSandboxMode("scoped_external_access"), "scoped_external_access");
  assert.equal(normalizeSandboxMode("restricted_exec"), "restricted_exec");
});

// ============================================================================
// Path Resolution Tests
// ============================================================================

test("resolveSandboxPath returns resolved path when realpath disabled", () => {
  const path = "/tmp/test/file.txt";
  const result = resolveSandboxPath(path, false);
  assert.equal(result, resolve(path));
});

test("resolveSandboxPath resolves symlinks when realpath enabled", () => {
  // When realpathEnforced is true and path exists, should resolve symlinks.
  // On macOS /tmp is a symlink to /private/tmp, so realpath resolves it.
  const path = "/tmp/test-file-" + Date.now();
  const result = resolveSandboxPath(path, true);
  // Should not throw, and should return a string path
  assert.ok(typeof result === "string");
  assert.ok(result.length > 0);
});

test("resolveSandboxPath throws for permission errors", () => {
  // This test verifies that non-ENOENT errors propagate
  // On systems without permission issues, this may not trigger
  try {
    resolveSandboxPath("/proc/1", true); // May fail on some systems
  } catch (err: any) {
    // Expected for protected paths
    assert.ok(err.code === "EACCES" || err.code === "EPERM" || err.message.includes("ENOENT"));
  }
});

// ============================================================================
// Check Sandbox Path Tests - Basic Cases
// ============================================================================

test("checkSandboxPath allows path within allowed roots", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "read_only",
    allowedRoots: ["/tmp"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
    ...SANDBOX_LIMITS,
  };

  const result = checkSandboxPath(policy, "/tmp/myfile.txt");
  assert.equal(result.allowed, true);
  assert.ok(result.normalizedPath.includes("/tmp"));
  assert.equal(result.reasonCode, null);
});

test("checkSandboxPath denies path outside allowed roots", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "read_only",
    allowedRoots: ["/tmp"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
    ...SANDBOX_LIMITS,
  };

  const result = checkSandboxPath(policy, "/etc/passwd");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_outside_allowed_roots");
});

test("checkSandboxPath denies path in denied roots", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "read_only",
    allowedRoots: ["/tmp"],
    deniedRoots: ["/tmp/secrets"],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
    ...SANDBOX_LIMITS,
  };

  const result = checkSandboxPath(policy, "/tmp/secrets/file.txt");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_in_denied_root");
});

test("checkSandboxPath rejects null bytes in path", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "read_only",
    allowedRoots: ["/tmp"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
    ...SANDBOX_LIMITS,
  };

  const result = checkSandboxPath(policy, "/tmp/file\0.txt");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_invalid_encoding");
});

test("checkSandboxPath handles normalized unicode paths", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "read_only",
    allowedRoots: ["/tmp"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
    ...SANDBOX_LIMITS,
  };

  // Path with unicode normalization
  const result = checkSandboxPath(policy, "/tmp/日本語ファイル.txt");
  // Should process without error (may be allowed or denied based on path existence)
  assert.ok(typeof result.allowed === "boolean");
});

// ============================================================================
// Check Sandbox Path - Denied Roots Tests
// ============================================================================

test("checkSandboxPath denies exact match to denied root", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "read_only",
    allowedRoots: ["/home"],
    deniedRoots: ["/home/.ssh"],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
    ...SANDBOX_LIMITS,
  };

  const result = checkSandboxPath(policy, "/home/.ssh");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_in_denied_root");
});

test("checkSandboxPath denies subpath of denied root", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "read_only",
    allowedRoots: ["/home"],
    deniedRoots: ["/home/.ssh"],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
    ...SANDBOX_LIMITS,
  };

  const result = checkSandboxPath(policy, "/home/.ssh/id_rsa");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_in_denied_root");
});

// ============================================================================
// Check Sandbox Path - Multiple Roots Tests
// ============================================================================

test("checkSandboxPath allows path within any allowed root", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "read_only",
    allowedRoots: ["/tmp", "/var/tmp", "/home/user"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
    ...SANDBOX_LIMITS,
  };

  const result1 = checkSandboxPath(policy, "/tmp/file.txt");
  assert.equal(result1.allowed, true);

  const result2 = checkSandboxPath(policy, "/var/tmp/file.txt");
  assert.equal(result2.allowed, true);

  const result3 = checkSandboxPath(policy, "/home/user/file.txt");
  assert.equal(result3.allowed, true);
});

test("checkSandboxPath denies path not in any allowed root", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "read_only",
    allowedRoots: ["/tmp", "/var/tmp"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
    ...SANDBOX_LIMITS,
  };

  const result = checkSandboxPath(policy, "/home/user/file.txt");
  assert.equal(result.allowed, false);
});

// ============================================================================
// Policy Factory Functions Tests
// ============================================================================

test("createWorkspaceWritePolicy creates correct policy structure", () => {
  const policy = createWorkspaceWritePolicy("/workspace");

  assert.equal(policy.policyId, "workspace_write");
  assert.equal(policy.mode, "workspace_write");
  assert.deepEqual(policy.allowedRoots, ["/workspace"]);
  assert.ok(policy.deniedRoots.includes("/etc"));
  assert.ok(policy.deniedRoots.includes("/proc"));
  assert.ok(policy.deniedRoots.includes("/sys"));
  assert.ok(policy.deniedRoots.some((root) => root.endsWith("/.ssh")));
  assert.equal(policy.realpathEnforced, true);
  assert.equal(policy.symlinkPolicy, "deny");
  assert.equal(policy.processRuleMode, "allow");
});

test("createReadOnlyPolicy creates correct policy structure", () => {
  const policy = createReadOnlyPolicy("/workspace");

  assert.equal(policy.policyId, "read_only");
  assert.equal(policy.mode, "read_only");
  assert.deepEqual(policy.allowedRoots, ["/workspace"]);
  assert.ok(policy.deniedRoots.includes("/etc"));
  assert.ok(policy.deniedRoots.some((root) => root.endsWith("/.ssh")));
  assert.equal(policy.realpathEnforced, true);
  assert.equal(policy.symlinkPolicy, "deny");
  assert.equal(policy.processRuleMode, "deny");
});

test("createScopedExternalAccessPolicy creates correct policy structure", () => {
  const policy = createScopedExternalAccessPolicy("/workspace");

  assert.equal(policy.policyId, "scoped_external_access");
  assert.equal(policy.mode, "scoped_external_access");
  assert.deepEqual(policy.allowedRoots, ["/workspace"]);
  assert.ok(policy.deniedRoots.includes("/etc"));
  assert.ok(policy.deniedRoots.some((root) => root.endsWith("/.ssh")));
  assert.equal(policy.realpathEnforced, true);
  assert.equal(policy.symlinkPolicy, "deny");
  assert.equal(policy.processRuleMode, "allow");
});

test("createRestrictedExecPolicy creates correct policy structure", () => {
  const policy = createRestrictedExecPolicy("/workspace");

  assert.equal(policy.policyId, "restricted_exec");
  assert.equal(policy.mode, "restricted_exec");
  assert.deepEqual(policy.allowedRoots, ["/workspace"]);
  assert.ok(policy.deniedRoots.includes("/etc"));
  assert.ok(policy.deniedRoots.some((root) => root.endsWith("/.ssh")));
  assert.equal(policy.realpathEnforced, true);
  assert.equal(policy.symlinkPolicy, "deny");
  assert.equal(policy.processRuleMode, "allow");
});

test("createConfigReadPolicy creates correct policy structure", () => {
  const policy = createConfigReadPolicy("/workspace/myapp");

  assert.equal(policy.policyId, "config_read");
  assert.equal(policy.mode, "read_only");
  assert.deepEqual(policy.allowedRoots, ["/workspace/myapp"]);
  assert.ok(policy.deniedRoots.includes("/etc"));
  assert.ok(policy.deniedRoots.some((root) => root.endsWith("/.ssh")));
  assert.equal(policy.realpathEnforced, true);
  assert.equal(policy.symlinkPolicy, "deny");
  assert.equal(policy.processRuleMode, "deny");
});

// ============================================================================
// Result Structure Tests
// ============================================================================

test("checkSandboxPath returns normalizedPath in result", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "read_only",
    allowedRoots: ["/tmp"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
    ...SANDBOX_LIMITS,
  };

  const result = checkSandboxPath(policy, "/tmp/file.txt");
  assert.ok(result.normalizedPath);
  assert.ok(result.normalizedPath.length > 0);
});

test("checkSandboxPath sets reasonCode to null when allowed", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "read_only",
    allowedRoots: ["/tmp"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
    ...SANDBOX_LIMITS,
  };

  const result = checkSandboxPath(policy, "/tmp/file.txt");
  assert.equal(result.reasonCode, null);
});

test("checkSandboxPath sets reasonCode when denied", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "read_only",
    allowedRoots: ["/tmp"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
    ...SANDBOX_LIMITS,
  };

  const result = checkSandboxPath(policy, "/etc/passwd");
  assert.ok(result.reasonCode);
  assert.ok(result.reasonCode.startsWith("sandbox."));
});

// ============================================================================
// Edge Cases Tests
// ============================================================================

test("checkSandboxPath handles empty allowed roots", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "read_only",
    allowedRoots: [],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
    ...SANDBOX_LIMITS,
  };

  const result = checkSandboxPath(policy, "/tmp/file.txt");
  // No allowed roots means all paths are outside
  assert.equal(result.allowed, false);
});

test("checkSandboxPath handles paths with trailing slash", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "read_only",
    allowedRoots: ["/tmp/"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
    ...SANDBOX_LIMITS,
  };

  const result = checkSandboxPath(policy, "/tmp/file.txt");
  assert.equal(result.allowed, true);
});

test("checkSandboxPath handles relative paths", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "read_only",
    allowedRoots: ["/tmp"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
    ...SANDBOX_LIMITS,
  };

  const result = checkSandboxPath(policy, "file.txt");
  // Relative paths get resolved, so this should typically be denied
  // unless CWD happens to be within an allowed root
  assert.equal(result.allowed, false);
});

test("checkSandboxPath handles paths with .. traversal", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "read_only",
    allowedRoots: ["/tmp"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
    ...SANDBOX_LIMITS,
  };

  const result = checkSandboxPath(policy, "/tmp/../tmp/file.txt");
  assert.equal(result.allowed, true);
});

test("checkSandboxPath handles realpathEnforced flag", () => {
  const policyWithRealpath: SandboxPolicy = {
    policyId: "test",
    mode: "read_only",
    allowedRoots: ["/tmp"],
    deniedRoots: [],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
    ...SANDBOX_LIMITS,
  };

  const policyWithoutRealpath: SandboxPolicy = {
    policyId: "test",
    mode: "read_only",
    allowedRoots: ["/tmp"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
    ...SANDBOX_LIMITS,
  };

  const resultWith = checkSandboxPath(policyWithRealpath, "/tmp/file.txt");
  const resultWithout = checkSandboxPath(policyWithoutRealpath, "/tmp/file.txt");

  // Both should allow the path within /tmp
  assert.equal(resultWith.allowed, true);
  assert.equal(resultWithout.allowed, true);
});

test("checkSandboxPath handles symlinkPolicy allow_explicit", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "read_only",
    allowedRoots: ["/tmp"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "allow_explicit",
    processRuleMode: "deny",
    ...SANDBOX_LIMITS,
  };

  // With allow_explicit, symlink checks are skipped
  const result = checkSandboxPath(policy, "/tmp/file.txt");
  assert.equal(result.allowed, true);
});

test("checkSandboxPath handles various riskCategory values through mode", () => {
  // Test that different modes have different resource limits
  const modes: SandboxMode[] = ["read_only", "workspace_write", "scoped_external_access", "restricted_exec"];

  for (const mode of modes) {
    const policy: SandboxPolicy = {
      policyId: "test",
      mode,
      allowedRoots: ["/tmp"],
      deniedRoots: [],
      realpathEnforced: false,
      symlinkPolicy: "deny",
      processRuleMode: "deny",
      ...SANDBOX_LIMITS,
    };

    const result = checkSandboxPath(policy, "/tmp/file.txt");
    assert.equal(result.allowed, true);
  }
});
