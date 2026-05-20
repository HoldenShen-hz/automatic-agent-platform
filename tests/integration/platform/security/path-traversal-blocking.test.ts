/**
 * Security Integration Test: Path Traversal Blocking
 *
 * Simple tests for verifying path traversal attacks are blocked
 * using the sandbox policy path validation.
 */

import assert from "node:assert/strict";
import { homedir } from "node:os";
import test from "node:test";

import {
  checkSandboxPath,
  createWorkspaceWritePolicy,
  type SandboxPolicy,
} from "../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";

test("security: basic ../ path traversal is blocked", () => {
  const policy = createWorkspaceWritePolicy("/workspace/project");

  // Attempt to escape sandbox with ../
  const result = checkSandboxPath(policy, "/workspace/project/../../../etc/passwd");

  assert.strictEqual(result.allowed, false, "Basic ../ traversal should be blocked");
  assert.ok(result.reasonCode !== null, "Should have a reason code");
});

test("security: simple traversal with ../ is blocked", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "workspace_write",
    allowedRoots: ["/workspace"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
  };

  const result = checkSandboxPath(policy, "/workspace/../etc/passwd");

  assert.strictEqual(result.allowed, false, "Simple ../ traversal should be blocked");
});

test("security: nested ../ traversal is blocked", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "workspace_write",
    allowedRoots: ["/workspace/project"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
  };

  const result = checkSandboxPath(policy, "/workspace/project/../../root/.ssh");

  assert.strictEqual(result.allowed, false, "Nested ../ traversal should be blocked");
});

test("security: absolute path outside sandbox is blocked", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "workspace_write",
    allowedRoots: ["/workspace/project"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
  };

  const result = checkSandboxPath(policy, "/etc/shadow");

  assert.strictEqual(result.allowed, false, "Absolute path outside sandbox should be blocked");
});

test("security: null-byte injection is blocked", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "workspace_write",
    allowedRoots: ["/workspace/project"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
  };

  const result = checkSandboxPath(policy, "/workspace/project/../../../etc/passwd\x00.txt");

  assert.strictEqual(result.allowed, false, "Null-byte injection should be blocked");
});

test("security: traversal to denied root is blocked", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "workspace_write",
    allowedRoots: ["/workspace"],
    deniedRoots: ["/workspace/secret"],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
  };

  const result = checkSandboxPath(policy, "/workspace/secret/.ssh/id_rsa");

  assert.strictEqual(result.allowed, false, "Path to denied root should be blocked");
});

test("security: legitimate paths within sandbox are allowed", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "workspace_write",
    allowedRoots: ["/workspace/project"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
  };

  const result = checkSandboxPath(policy, "/workspace/project/src/index.ts");

  assert.strictEqual(result.allowed, true, "Valid path within sandbox should be allowed");
  assert.strictEqual(result.reasonCode, null, "No reason code for allowed path");
});

test("security: createWorkspaceWritePolicy creates valid policy", () => {
  const policy = createWorkspaceWritePolicy("/workspace/project");

  assert.strictEqual(policy.policyId, "workspace_write");
  assert.strictEqual(policy.mode, "workspace_write");
  assert.deepStrictEqual(policy.allowedRoots, ["/workspace/project"]);
  assert.deepStrictEqual(policy.deniedRoots, ["/etc", "/proc", "/sys", `${homedir()}/.ssh`]);
  assert.strictEqual(policy.realpathEnforced, true);
  assert.strictEqual(policy.symlinkPolicy, "deny");
});

test("security: subdirectory within allowed root is allowed", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "workspace_write",
    allowedRoots: ["/workspace"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
  };

  const result = checkSandboxPath(policy, "/workspace/subdir/deep/nested/file.txt");

  assert.strictEqual(result.allowed, true, "Subdirectory path should be allowed");
});
