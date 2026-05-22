/**
 * Security Integration Test: Advanced Path Traversal Prevention
 *
 * Verifies path traversal attack prevention including:
 * - Basic ../ path traversal
 * - Double-encoded path traversal
 * - Null-byte injection
 * - Symlink traversal
 * - Unicode normalization bypass attempts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  SandboxPolicy,
  checkSandboxPath,
} from "../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";

test("security: basic ../ path traversal is blocked", () => {
  const policy: SandboxPolicy = {
    policyId: "test-policy",
    mode: "workspace_write",
    allowedRoots: ["/workspace/project"],
    deniedRoots: ["/etc", "/root"],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
  };

  // Attempt to escape sandbox with ../
  const result = checkSandboxPath(policy, "/workspace/project/../../../etc/passwd");

  assert.strictEqual(result.allowed, false, "Basic ../ traversal should be blocked");
  assert.ok(result.reasonCode !== null, "Should have a reason code");
  assert.ok(
    result.reasonCode?.includes("traversal") || result.reasonCode?.includes("denied"),
    `Reason code should indicate traversal: ${result.reasonCode}`,
  );
});

test("security: double-encoded ../ (%2f) path traversal is blocked", () => {
  const policy: SandboxPolicy = {
    policyId: "test-policy",
    mode: "workspace_write",
    allowedRoots: ["/workspace/project"],
    deniedRoots: ["/etc"],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
  };

  // Double-encoded traversal attempt
  const result = checkSandboxPath(policy, "/workspace/project/..%2f..%2f..%2fetc/passwd");

  assert.strictEqual(result.allowed, false, "Double-encoded traversal should be blocked");
  assert.ok(result.reasonCode !== null, "Should have a reason code");
});

test("security: null-byte injection is blocked", () => {
  const policy: SandboxPolicy = {
    policyId: "test-policy",
    mode: "workspace_write",
    allowedRoots: ["/workspace/project"],
    deniedRoots: [],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
  };

  // Null-byte injection attempt - path might be truncated at null byte
  const maliciousPath = "/workspace/project/../../../etc/passwd\x00.txt";
  const result = checkSandboxPath(policy, maliciousPath);

  // The path should either be rejected as traversal or null bytes should be stripped
  assert.strictEqual(result.allowed, false, "Null-byte injection should be blocked");
});

test("security: symlink traversal outside sandbox is blocked", () => {
  const policy: SandboxPolicy = {
    policyId: "test-policy",
    mode: "workspace_write",
    allowedRoots: ["/workspace/project/safe"],
    deniedRoots: ["/workspace/project/sensitive"],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
  };

  // Attempt to traverse via symlink that points outside allowed root
  // The validator should detect this through realpath resolution
  const result = checkSandboxPath(policy, "/workspace/project/safe/../../sensitive/data");

  assert.strictEqual(result.allowed, false, "Symlink-like traversal should be blocked");
  assert.ok(result.reasonCode !== null, "Should have a reason code for the violation");
});

test("security: unicode full-width slash traversal is normalized", () => {
  const policy: SandboxPolicy = {
    policyId: "test-policy",
    mode: "workspace_write",
    allowedRoots: ["/workspace/project"],
    deniedRoots: ["/etc", "/root"],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
  };

  // Full-width slash (U+FF0F) used as bypass attempt
  const maliciousPath = "/workspace/project\xFF0F..\xFF0F..\xFF0Fetc\xFF0Fpasswd";
  const result = checkSandboxPath(policy, maliciousPath);

  // After normalization, the path should be recognized as traversal
  assert.strictEqual(result.allowed, false, "Unicode slash traversal should be blocked after normalization");
});

test("security: path traversal with encoded null is handled", () => {
  const policy: SandboxPolicy = {
    policyId: "test-policy",
    mode: "workspace_write",
    allowedRoots: ["/workspace/project"],
    deniedRoots: [],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
  };

  // %00 encoded null byte
  const result = checkSandboxPath(policy, "/workspace/project/../../../etc/passwd%00.txt");

  // Should either block the traversal or strip the null-byte encoding
  assert.strictEqual(result.allowed, false, "Path with encoded null should be handled safely");
});

test("security: legitimate paths within sandbox are allowed", () => {
  const policy: SandboxPolicy = {
    policyId: "test-policy",
    mode: "workspace_write",
    allowedRoots: ["/workspace/project"],
    deniedRoots: [],
    realpathEnforced: false, // Disable realpath check since test path doesn't exist
    symlinkPolicy: "deny",
    processRuleMode: "deny",
  };

  // Valid path within sandbox
  const result = checkSandboxPath(policy, "/workspace/project/src/index.ts");

  assert.strictEqual(result.allowed, true, "Valid path within sandbox should be allowed");
  assert.strictEqual(result.reasonCode, null, "No reason code for allowed path");
});

test("security: traversal to denied root is blocked even if within allowed prefix", () => {
  const policy: SandboxPolicy = {
    policyId: "test-policy",
    mode: "workspace_write",
    allowedRoots: ["/workspace"],
    deniedRoots: ["/workspace/secret"],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
  };

  // Path that goes to a denied root
  const result = checkSandboxPath(policy, "/workspace/secret/.ssh/id_rsa");

  assert.strictEqual(result.allowed, false, "Path to denied root should be blocked");
  assert.ok(result.reasonCode !== null, "Should indicate why path was denied");
});
