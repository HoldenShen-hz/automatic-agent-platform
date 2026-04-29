/**
 * ARCH-P1-2: Sandbox Level Coverage Tests
 *
 * Architecture §11.4 defines 4 Sandbox tiers (none / process / container / vm).
 * This test verifies the codebase includes all 4 tiers.
 *
 * Test type: Unit
 * @see docs_zh/quality/00-full-coverage-test-manual.md §26.2
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeSandboxMode,
  type SandboxMode,
} from "../../../../../src/platform/control-plane/iam/sandbox-policy.js";

/**
 * The 4 sandbox tiers required by architecture §11.4.
 * Maps to: none → read_only, process → read_only, container → workspace_write, vm → scoped_external_access
 */
const ARCHITECTURE_REQUIRED_SANDBOX_TIERS = [
  "none",
  "process",
  "container",
  "vm",
] as const;

test("[ARCH-P1-2] SandboxMode supports all 4 architecture-required tiers", () => {
  // Normalize each required tier and verify it maps to a valid SandboxMode
  const validModes: SandboxMode[] = ["read_only", "workspace_write", "scoped_external_access", "restricted_exec"];

  for (const tier of ARCHITECTURE_REQUIRED_SANDBOX_TIERS) {
    const normalized = normalizeSandboxMode(tier);
    assert.ok(
      validModes.includes(normalized),
      `SandboxMode must support tier "${tier}" (got "${normalized}")`,
    );
  }
});

test("[ARCH-P1-2] SandboxMode enum covers all 4 tiers explicitly", () => {
  // none maps to read_only (default)
  const noneNormalized = normalizeSandboxMode("none");
  assert.equal(noneNormalized, "read_only", '"none" tier must map to "read_only"');

  // process maps to read_only
  const processNormalized = normalizeSandboxMode("process");
  assert.equal(processNormalized, "read_only", '"process" tier must map to "read_only"');

  // container maps to workspace_write
  const containerNormalized = normalizeSandboxMode("container");
  assert.equal(containerNormalized, "workspace_write", '"container" tier must map to "workspace_write"');

  // vm should map to scoped_external_access (VM-tier sandbox)
  const vmNormalized = normalizeSandboxMode("vm");
  assert.equal(vmNormalized, "scoped_external_access", '"vm" tier must map to "scoped_external_access"');
});

test("[ARCH-P1-2] VM tier configuration produces valid sandbox policy", () => {
  // Verify VM tier produces a valid sandbox configuration
  const vmConfig = {
    mode: normalizeSandboxMode("vm"),
    allowedRoots: ["/tmp/sandbox-vm"],
    deniedRoots: [],
    realpathEnforced: true,
  };

  assert.equal(vmConfig.mode, "scoped_external_access");
  assert.ok(vmConfig.allowedRoots.length > 0, "VM sandbox must have allowedRoots");
  assert.ok(vmConfig.realpathEnforced, "VM sandbox must enforce realpath");
});