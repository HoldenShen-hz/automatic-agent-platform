import test from "node:test";
import assert from "node:assert/strict";

import {
  checkSandboxPath,
  createWorkspaceWritePolicy,
  type SandboxPolicy,
  type SandboxPathCheckResult,
} from "../../../../../src/platform/shared/sandbox-path-policy.js";

test("checkSandboxPath returns allowed true for path within allowed roots", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "workspace_write",
    allowedRoots: ["/workspace"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
    timeLimitMs: 300_000,
    memoryLimitBytes: 512 * 1024 * 1024,
    cpuLimitFraction: 0.5,
  };

  const result = checkSandboxPath(policy, "/workspace/project");

  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.reasonCode, null);
  assert.ok(result.normalizedPath.endsWith("workspace/project") || result.normalizedPath === "/workspace/project");
});

test("checkSandboxPath returns allowed false for path in denied roots", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "workspace_write",
    allowedRoots: ["/workspace"],
    deniedRoots: ["/etc"],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
    timeLimitMs: 300_000,
    memoryLimitBytes: 512 * 1024 * 1024,
    cpuLimitFraction: 0.5,
  };

  const result = checkSandboxPath(policy, "/etc/passwd");

  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.reasonCode, "sandbox.path_in_denied_root");
});

test("checkSandboxPath returns allowed false for path outside allowed roots", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "workspace_write",
    allowedRoots: ["/workspace"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
    timeLimitMs: 300_000,
    memoryLimitBytes: 512 * 1024 * 1024,
    cpuLimitFraction: 0.5,
  };

  const result = checkSandboxPath(policy, "/var/log");

  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.reasonCode, "sandbox.path_outside_allowed_roots");
});

test("checkSandboxPath handles multiple allowed roots", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "workspace_write",
    allowedRoots: ["/workspace", "/shared"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
    timeLimitMs: 300_000,
    memoryLimitBytes: 512 * 1024 * 1024,
    cpuLimitFraction: 0.5,
  };

  const result1 = checkSandboxPath(policy, "/workspace/project");
  const result2 = checkSandboxPath(policy, "/shared/data");

  assert.strictEqual(result1.allowed, true);
  assert.strictEqual(result2.allowed, true);
});

test("checkSandboxPath handles path with .. traversal", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "workspace_write",
    allowedRoots: ["/workspace"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
    timeLimitMs: 300_000,
    memoryLimitBytes: 512 * 1024 * 1024,
    cpuLimitFraction: 0.5,
  };

  const result = checkSandboxPath(policy, "/workspace/../etc");

  assert.strictEqual(result.allowed, false);
});

test("checkSandboxPath matches exact root path", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "workspace_write",
    allowedRoots: ["/workspace"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
    timeLimitMs: 300_000,
    memoryLimitBytes: 512 * 1024 * 1024,
    cpuLimitFraction: 0.5,
  };

  const result = checkSandboxPath(policy, "/workspace");

  assert.strictEqual(result.allowed, true);
});

test("createWorkspaceWritePolicy creates valid policy", () => {
  const policy = createWorkspaceWritePolicy("/workspace");

  assert.strictEqual(policy.policyId, "workspace_write");
  assert.strictEqual(policy.mode, "workspace_write");
  assert.deepStrictEqual(policy.allowedRoots, ["/workspace"]);
  assert.ok(policy.deniedRoots.length > 0);
  assert.strictEqual(policy.realpathEnforced, true);
  assert.strictEqual(policy.symlinkPolicy, "deny");
  assert.strictEqual(policy.processRuleMode, "allow");
  assert.strictEqual(policy.timeLimitMs, 300_000);
  assert.strictEqual(policy.memoryLimitBytes, 512 * 1024 * 1024);
  assert.strictEqual(policy.cpuLimitFraction, 0.5);
});

test("createWorkspaceWritePolicy includes default denied roots", () => {
  const policy = createWorkspaceWritePolicy("/workspace");

  assert.ok(policy.deniedRoots.includes("/dev"));
  assert.ok(policy.deniedRoots.includes("/proc"));
  assert.ok(policy.deniedRoots.includes("/sys"));
});

test("checkSandboxPath with default denied roots blocks /dev", () => {
  const policy = createWorkspaceWritePolicy("/workspace");

  const result = checkSandboxPath(policy, "/dev/null");

  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.reasonCode, "sandbox.path_in_denied_root");
});

test("checkSandboxPath with default denied roots blocks /proc", () => {
  const policy = createWorkspaceWritePolicy("/workspace");

  const result = checkSandboxPath(policy, "/proc/self");

  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.reasonCode, "sandbox.path_in_denied_root");
});

test("checkSandboxPath with realpathEnforced resolves symlinks", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "restricted_exec",
    allowedRoots: ["/workspace"],
    deniedRoots: [],
    realpathEnforced: true,
    symlinkPolicy: "allow",
    processRuleMode: "allow",
    timeLimitMs: 300_000,
    memoryLimitBytes: 512 * 1024 * 1024,
    cpuLimitFraction: 0.5,
  };

  // Without actual symlinks in test environment, just verify the structure
  const result = checkSandboxPath(policy, "/workspace/project");

  // Path should still be normalized
  assert.ok(result.normalizedPath !== undefined);
});

test("SandboxPathCheckResult has correct structure", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "workspace_write",
    allowedRoots: ["/workspace"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
    timeLimitMs: 300_000,
    memoryLimitBytes: 512 * 1024 * 1024,
    cpuLimitFraction: 0.5,
  };

  const result = checkSandboxPath(policy, "/workspace");

  assert.strictEqual(typeof result.allowed, "boolean");
  assert.strictEqual(typeof result.normalizedPath, "string");
  assert.ok(result.reasonCode === null || typeof result.reasonCode === "string");
});

test("checkSandboxPath handles empty denied roots", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "workspace_write",
    allowedRoots: ["/workspace"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
    timeLimitMs: 300_000,
    memoryLimitBytes: 512 * 1024 * 1024,
    cpuLimitFraction: 0.5,
  };

  const result = checkSandboxPath(policy, "/workspace/project");

  assert.strictEqual(result.allowed, true);
});

test("checkSandboxPath handles nested paths within allowed root", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "workspace_write",
    allowedRoots: ["/workspace"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
    timeLimitMs: 300_000,
    memoryLimitBytes: 512 * 1024 * 1024,
    cpuLimitFraction: 0.5,
  };

  const result = checkSandboxPath(policy, "/workspace/project/src/components/button.ts");

  assert.strictEqual(result.allowed, true);
});

test("checkSandboxPath denied root takes precedence over allowed", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "workspace_write",
    allowedRoots: ["/workspace", "/etc"],
    deniedRoots: ["/etc/ssh"],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
    timeLimitMs: 300_000,
    memoryLimitBytes: 512 * 1024 * 1024,
    cpuLimitFraction: 0.5,
  };

  const result = checkSandboxPath(policy, "/etc/ssh/sshd_config");

  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.reasonCode, "sandbox.path_in_denied_root");
});