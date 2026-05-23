import assert from "node:assert/strict";
import test from "node:test";

import {
  checkSandboxPath,
  createWorkspaceWritePolicy,
  createReadOnlyPolicy,
  createScopedExternalAccessPolicy,
  createRestrictedExecPolicy,
  createConfigReadPolicy,
  normalizeSandboxMode,
  type SandboxPolicy,
} from "../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";

test("sandbox-policy normalizeSandboxMode maps aliases correctly", () => {
  assert.equal(normalizeSandboxMode("process"), "read_only");
  assert.equal(normalizeSandboxMode("container"), "workspace_write");
  assert.equal(normalizeSandboxMode("scoped_external_access"), "scoped_external_access");
  assert.equal(normalizeSandboxMode("read_only"), "read_only");
  assert.equal(normalizeSandboxMode("workspace_write"), "workspace_write");
  assert.equal(normalizeSandboxMode("restricted_exec"), "restricted_exec");
  assert.equal(normalizeSandboxMode(null), "read_only");
  assert.equal(normalizeSandboxMode(undefined), "read_only");
  // Unknown modes fall back to read_only
  assert.equal(normalizeSandboxMode("none"), "read_only");
  assert.equal(normalizeSandboxMode("unknown_alias"), "read_only");
});

test("sandbox-policy createWorkspaceWritePolicy creates valid policy", () => {
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

test("sandbox-policy createReadOnlyPolicy creates valid policy", () => {
  const policy = createReadOnlyPolicy("/workspace");
  assert.equal(policy.policyId, "read_only");
  assert.equal(policy.mode, "read_only");
  assert.ok(policy.deniedRoots.some((root) => root.endsWith("/.ssh")));
  assert.equal(policy.processRuleMode, "deny");
});

test("sandbox-policy createScopedExternalAccessPolicy creates valid policy", () => {
  const policy = createScopedExternalAccessPolicy("/workspace");
  assert.equal(policy.policyId, "scoped_external_access");
  assert.equal(policy.mode, "scoped_external_access");
});

test("sandbox-policy createRestrictedExecPolicy creates valid policy", () => {
  const policy = createRestrictedExecPolicy("/workspace");
  assert.equal(policy.policyId, "restricted_exec");
  assert.equal(policy.mode, "restricted_exec");
});

test("sandbox-policy createConfigReadPolicy creates valid policy", () => {
  const policy = createConfigReadPolicy("/workspace/config");
  assert.equal(policy.policyId, "config_read");
  assert.equal(policy.mode, "read_only");
  assert.deepEqual(policy.allowedRoots, ["/workspace/config"]);
  assert.ok(policy.deniedRoots.some((root) => root.endsWith("/.ssh")));
  assert.equal(policy.processRuleMode, "deny");
});

test("sandbox-policy checkSandboxPath allows path within workspace", () => {
  const policy = createWorkspaceWritePolicy("/workspace");
  const result = checkSandboxPath(policy, "/workspace/src/index.ts");
  assert.equal(result.allowed, true);
  assert.ok(result.normalizedPath.includes("/workspace"));
  assert.equal(result.reasonCode, null);
});

test("sandbox-policy checkSandboxPath denies path outside allowed roots", () => {
  const policy = createWorkspaceWritePolicy("/workspace");
  const result = checkSandboxPath(policy, "/var/tmp/outside.txt");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_outside_allowed_roots");
});

test("sandbox-policy checkSandboxPath denies path in denied root", () => {
  const policy: SandboxPolicy = {
    policyId: "test",
    mode: "workspace_write",
    allowedRoots: ["/workspace"],
    deniedRoots: ["/workspace/secrets"],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
    timeLimitMs: 0,
    memoryLimitBytes: 0,
    cpuLimitFraction: 0,
  };
  const result = checkSandboxPath(policy, "/workspace/secrets/passwords.txt");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_in_denied_root");
});

test("sandbox-policy checkSandboxPath denies invalid encoding", () => {
  const policy = createWorkspaceWritePolicy("/workspace");
  const result = checkSandboxPath(policy, "/workspace/src\0malicious");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_invalid_encoding");
});

test("sandbox-policy checkSandboxPath handles relative paths", () => {
  const policy = createWorkspaceWritePolicy("/workspace");
  const result = checkSandboxPath(policy, "src/index.ts");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_outside_allowed_roots");
});

test("sandbox-policy checkSandboxPath restricted_exec mode still enforces path boundary", () => {
  const policy = createRestrictedExecPolicy("/workspace");
  const result = checkSandboxPath(policy, "/var/tmp/outside.txt");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_outside_allowed_roots");
});
