import assert from "node:assert/strict";
import test from "node:test";

import {
  checkSandboxPath,
  createRestrictedExecPolicy,
  createScopedExternalAccessPolicy,
  createWorkspaceWritePolicy,
  type SandboxMode,
  type SandboxPolicy,
} from "../../../../../src/platform/control-plane/iam/sandbox-policy.js";

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

test("restricted_exec skips allowed-root checks but still respects denied roots", () => {
  const policy: SandboxPolicy = {
    ...createRestrictedExecPolicy("/workspace/root"),
    deniedRoots: ["/etc"],
  };

  assert.equal(checkSandboxPath(policy, "/tmp/ephemeral.txt").allowed, true);
  const denied = checkSandboxPath(policy, "/etc/passwd");
  assert.equal(denied.allowed, false);
  assert.equal(denied.reasonCode, "sandbox.path_in_denied_root");
});
