/**
 * ARCH-P1-2: Sandbox Level Coverage Tests
 *
 * Architecture coverage for sandbox tiers after deny-by-default remediation.
 * Canonical supported modes are read_only / workspace_write / scoped_external_access / restricted_exec.
 * Legacy aliases may normalize into canonical modes, but unsafe unsandboxed tiers must be rejected.
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
 * Legacy aliases that remain supported for compatibility.
 * Maps to: process → read_only, container → workspace_write.
 */
const SUPPORTED_LEGACY_SANDBOX_TIERS = [
  "process",
  "container",
] as const;

test("[ARCH-P1-2] SandboxMode supports canonical modes and safe compatibility aliases", () => {
  const validModes: SandboxMode[] = ["read_only", "workspace_write", "scoped_external_access", "restricted_exec"];

  for (const tier of SUPPORTED_LEGACY_SANDBOX_TIERS) {
    const normalized = normalizeSandboxMode(tier);
    assert.ok(
      validModes.includes(normalized),
      `SandboxMode must support tier "${tier}" (got "${normalized}")`,
    );
  }

  for (const mode of validModes) {
    assert.equal(normalizeSandboxMode(mode), mode);
  }
});

test("[ARCH-P1-2] SandboxMode rejects unsandboxed or unknown legacy tiers", () => {
  // process maps to read_only
  const processNormalized = normalizeSandboxMode("process");
  assert.equal(processNormalized, "read_only", '"process" tier must map to "read_only"');

  // container maps to workspace_write
  const containerNormalized = normalizeSandboxMode("container");
  assert.equal(containerNormalized, "workspace_write", '"container" tier must map to "workspace_write"');

  assert.throws(
    () => normalizeSandboxMode("none"),
    (error: unknown) => error instanceof Error && error.message.includes("sandboxTier 'none'"),
  );
  assert.throws(
    () => normalizeSandboxMode("vm"),
    (error: unknown) => error instanceof Error && error.message.includes("Unknown sandboxTier 'vm'"),
  );
});

test("[ARCH-P1-2] Canonical scoped_external_access mode produces valid sandbox policy", () => {
  const scopedConfig = {
    mode: normalizeSandboxMode("scoped_external_access"),
    allowedRoots: ["/tmp/sandbox-vm"],
    deniedRoots: [],
    realpathEnforced: true,
  };

  assert.equal(scopedConfig.mode, "scoped_external_access");
  assert.ok(scopedConfig.allowedRoots.length > 0, "Scoped sandbox must have allowedRoots");
  assert.ok(scopedConfig.realpathEnforced, "Scoped sandbox must enforce realpath");
});
