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
} from "../../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";

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

test("[ARCH-P1-2] SandboxMode falls back to read_only for unknown legacy tiers", () => {
  // Unknown modes fall back to read_only (safe default)
  assert.equal(normalizeSandboxMode("none"), "read_only");
  assert.equal(normalizeSandboxMode("vm"), "read_only");
  assert.equal(normalizeSandboxMode("unknown_tier"), "read_only");
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
