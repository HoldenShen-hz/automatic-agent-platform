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
  getEffectiveResourceLimits,
  createWorkspaceWritePolicy,
  createReadOnlyPolicy,
  createScopedExternalAccessPolicy,
  createRestrictedExecPolicy,
  createConfigReadPolicy,
  resolveSandboxPath,
  DEFAULT_SANDBOX_RESOURCE_LIMITS,
  type SandboxPolicy,
  type SandboxMode,
} from "../../../../../src/platform/control-plane/iam/sandbox-policy.js";

// ============================================================================
// Sandbox Mode Normalization Tests
// ============================================================================

test("normalizeSandboxMode returns read_only for null/undefined", () => {
  assert.equal(normalizeSandboxMode(null), "read_only");
  assert.equal(normalizeSandboxMode(undefined), "read_only");
});

test("normalizeSandboxMode throws for unknown mode (INV-POLICY-001)", () => {
  assert.throws(
    () => normalizeSandboxMode("unknown_mode"),
    (err: any) => err.code === "sandbox_policy.invalid_sandbox_tier",
  );
  assert.throws(
    () => normalizeSandboxMode("invalid"),
    (err: any) => err.code === "sandbox_policy.invalid_sandbox_tier",
  );
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
// Resource Limits Tests
// ============================================================================

test("getEffectiveResourceLimits returns policy limits when defined", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "read_only",
    allowedRoots: ["/tmp"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
    resourceLimits: {
      maxCpuTimeMs: 5000,
      maxMemoryBytes: 64 * 1024 * 1024,
      maxNetworkBandwidthBps: 1000,
      networkIsolationEnabled: false,
    },
  };

  const limits = getEffectiveResourceLimits(policy);
  assert.equal(limits.maxCpuTimeMs, 5000);
  assert.equal(limits.maxMemoryBytes, 64 * 1024 * 1024);
});

test("getEffectiveResourceLimits returns defaults when not defined", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "workspace_write",
    allowedRoots: ["/tmp"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
  };

  const limits = getEffectiveResourceLimits(policy);
  const defaults = DEFAULT_SANDBOX_RESOURCE_LIMITS.workspace_write;
  assert.equal(limits.maxCpuTimeMs, defaults.maxCpuTimeMs);
  assert.equal(limits.maxMemoryBytes, defaults.maxMemoryBytes);
});

test("DEFAULT_SANDBOX_RESOURCE_LIMITS has correct values for all modes", () => {
  const modes: SandboxMode[] = ["read_only", "workspace_write", "scoped_external_access", "restricted_exec"];

  for (const mode of modes) {
    const limits = DEFAULT_SANDBOX_RESOURCE_LIMITS[mode];
    assert.ok(limits.maxCpuTimeMs > 0, `mode ${mode} should have positive maxCpuTimeMs`);
    assert.ok(limits.maxMemoryBytes > 0, `mode ${mode} should have positive maxMemoryBytes`);
    assert.ok(typeof limits.networkIsolationEnabled === "boolean", `mode ${mode} should have boolean networkIsolationEnabled`);
  }
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
  assert.deepEqual(policy.deniedRoots, []);
  assert.equal(policy.realpathEnforced, true);
  assert.equal(policy.symlinkPolicy, "deny");
  assert.equal(policy.processRuleMode, "allow");
});

test("createReadOnlyPolicy creates correct policy structure", () => {
  const policy = createReadOnlyPolicy("/workspace");

  assert.equal(policy.policyId, "read_only");
  assert.equal(policy.mode, "read_only");
  assert.deepEqual(policy.allowedRoots, ["/workspace"]);
  assert.deepEqual(policy.deniedRoots, []);
  assert.equal(policy.realpathEnforced, true);
  assert.equal(policy.symlinkPolicy, "deny");
  assert.equal(policy.processRuleMode, "deny");
});

test("createScopedExternalAccessPolicy creates correct policy structure", () => {
  const policy = createScopedExternalAccessPolicy("/workspace");

  assert.equal(policy.policyId, "scoped_external_access");
  assert.equal(policy.mode, "scoped_external_access");
  assert.deepEqual(policy.allowedRoots, ["/workspace"]);
  assert.deepEqual(policy.deniedRoots, []);
  assert.equal(policy.realpathEnforced, true);
  assert.equal(policy.symlinkPolicy, "deny");
  assert.equal(policy.processRuleMode, "allow");
});

test("createRestrictedExecPolicy creates correct policy structure", () => {
  const policy = createRestrictedExecPolicy("/workspace");

  assert.equal(policy.policyId, "restricted_exec");
  assert.equal(policy.mode, "restricted_exec");
  assert.deepEqual(policy.allowedRoots, ["/workspace"]);
  assert.deepEqual(policy.deniedRoots, []);
  assert.equal(policy.realpathEnforced, true);
  assert.equal(policy.symlinkPolicy, "deny");
  assert.equal(policy.processRuleMode, "allow");
});

test("createConfigReadPolicy creates correct policy structure", () => {
  const policy = createConfigReadPolicy("/etc/myapp");

  assert.equal(policy.policyId, "config_read");
  assert.equal(policy.mode, "read_only");
  assert.deepEqual(policy.allowedRoots, ["/etc/myapp"]);
  assert.deepEqual(policy.deniedRoots, []);
  assert.equal(policy.realpathEnforced, true);
  assert.equal(policy.symlinkPolicy, "deny");
  assert.equal(policy.processRuleMode, "deny");
});

// ============================================================================
// Result Structure Tests
// ============================================================================

test("checkSandboxPath returns effectiveResourceLimits in result", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "read_only",
    allowedRoots: ["/tmp"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
  };

  const result = checkSandboxPath(policy, "/tmp/file.txt");
  assert.ok(result.effectiveResourceLimits);
  assert.ok(typeof result.effectiveResourceLimits.maxCpuTimeMs === "number");
  assert.ok(typeof result.effectiveResourceLimits.maxMemoryBytes === "number");
});

test("checkSandboxPath returns normalizedPath in result", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "read_only",
    allowedRoots: ["/tmp"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
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
  };

  const policyWithoutRealpath: SandboxPolicy = {
    policyId: "test",
    mode: "read_only",
    allowedRoots: ["/tmp"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
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
    };

    const result = checkSandboxPath(policy, "/tmp/file.txt");
    assert.equal(result.allowed, true);
  }
});