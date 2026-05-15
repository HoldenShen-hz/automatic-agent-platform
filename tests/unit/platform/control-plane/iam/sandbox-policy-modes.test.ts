import assert from "node:assert/strict";
import test from "node:test";

import {
  checkSandboxPath,
  createRestrictedExecPolicy,
  createScopedExternalAccessPolicy,
  createWorkspaceWritePolicy,
  type SandboxMode,
  type SandboxPolicy,
} from "../../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";

test("sandbox policy exposes the canonical four sandbox modes", () => {
  const modes: SandboxMode[] = ["read_only", "workspace_write", "scoped_external_access", "restricted_exec"];
  assert.equal(modes.length, 4);
});

test("workspace and scoped external access policies keep root boundaries", () => {
  const workspace = createWorkspaceWritePolicy("/workspace/root");
  const scoped = createScopedExternalAccessPolicy("/workspace/root");

  assert.equal(checkSandboxPath(workspace, "/workspace/root/file.txt").allowed, true);
  assert.equal(checkSandboxPath(workspace, "/etc/passwd").allowed, false);
  assert.equal(checkSandboxPath(scoped, "/workspace/root/file.txt").allowed, true);
  assert.equal(checkSandboxPath(scoped, "/etc/passwd").allowed, false);
});

test("restricted_exec still enforces allowed-root checks and denied roots", () => {
  const policy: SandboxPolicy = {
    ...createRestrictedExecPolicy("/workspace/root"),
    deniedRoots: ["/etc"],
  };

  const outside = checkSandboxPath(policy, "/tmp/ephemeral.txt");
  assert.equal(outside.allowed, false);
  assert.equal(outside.reasonCode, "sandbox.path_outside_allowed_roots");
  const denied = checkSandboxPath(policy, "/etc/passwd");
  assert.equal(denied.allowed, false);
  assert.equal(denied.reasonCode, "sandbox.path_in_denied_root");
});
