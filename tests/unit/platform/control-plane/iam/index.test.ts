import assert from "node:assert/strict";
import test from "node:test";

// Re-export test for barrel file
import type {
  SandboxMode,
  SymlinkPolicy,
  ProcessRuleMode,
  SandboxPolicy,
  SandboxPathCheckResult,
} from "../../../../../src/platform/control-plane/iam/sandbox-policy.js";

test("SandboxMode type accepts valid values", () => {
  const modes: SandboxMode[] = ["read_only", "workspace_write", "danger_full_access"];
  assert.equal(modes.length, 3);
});

test("SymlinkPolicy type accepts valid values", () => {
  const policies: SymlinkPolicy[] = ["deny", "allow_explicit"];
  assert.equal(policies.length, 2);
});

test("ProcessRuleMode type accepts valid values", () => {
  const modes: ProcessRuleMode[] = ["allow", "deny"];
  assert.equal(modes.length, 2);
});

test("SandboxPolicy structure is correct", () => {
  const policy: SandboxPolicy = {
    policyId: "test_policy",
    mode: "read_only",
    allowedRoots: ["/workspace"],
    deniedRoots: ["/system"],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
  };
  assert.equal(policy.policyId, "test_policy");
  assert.equal(policy.mode, "read_only");
  assert.equal(policy.realpathEnforced, true);
});

test("SandboxPathCheckResult structure is correct", () => {
  const result: SandboxPathCheckResult = {
    allowed: true,
    normalizedPath: "/workspace/src/index.ts",
    reasonCode: null,
  };
  assert.equal(result.allowed, true);
  assert.equal(result.normalizedPath, "/workspace/src/index.ts");
  assert.equal(result.reasonCode, null);
});

test("SandboxPathCheckResult for disallowed path", () => {
  const result: SandboxPathCheckResult = {
    allowed: false,
    normalizedPath: "/etc/passwd",
    reasonCode: "sandbox.path_denied",
  };
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_denied");
});
