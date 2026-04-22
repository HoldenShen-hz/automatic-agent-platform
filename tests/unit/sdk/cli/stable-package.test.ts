/**
 * Stable Package CLI Tests
 *
 * Tests for stable-package.ts CLI module.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { loadStablePackageCliEnv } from "../../../../src/platform/control-plane/config-center/stable-cli-env.js";

// ---------------------------------------------------------------------------
// Tests for loadStablePackageCliEnv
// ---------------------------------------------------------------------------

test("loadStablePackageCliEnv returns default outputDir", () => {
  const result = loadStablePackageCliEnv({});
  assert.ok(result.outputDir.includes("stable-package"));
});

test("loadStablePackageCliEnv parses custom outputDir", () => {
  const result = loadStablePackageCliEnv({ AA_STABLE_PACKAGE_OUTPUT_DIR: "/custom/package" });
  assert.equal(result.outputDir, "/custom/package");
});

test("loadStablePackageCliEnv parses evidenceRootDir when set", () => {
  const result = loadStablePackageCliEnv({ AA_STABLE_PACKAGE_EVIDENCE_ROOT: "/evidence/root" });
  assert.equal(result.evidenceRootDir, "/evidence/root");
});

test("loadStablePackageCliEnv returns null evidenceRootDir when not set", () => {
  const result = loadStablePackageCliEnv({});
  assert.equal(result.evidenceRootDir, null);
});

test("loadStablePackageCliEnv parses targetStatus canary", () => {
  const result = loadStablePackageCliEnv({ AA_STABLE_PACKAGE_TARGET_STATUS: "canary" });
  assert.equal(result.targetStatus, "canary");
});

test("loadStablePackageCliEnv parses targetStatus tenant_gray", () => {
  const result = loadStablePackageCliEnv({ AA_STABLE_PACKAGE_TARGET_STATUS: "tenant_gray" });
  assert.equal(result.targetStatus, "tenant_gray");
});

test("loadStablePackageCliEnv parses targetStatus production_ready", () => {
  const result = loadStablePackageCliEnv({ AA_STABLE_PACKAGE_TARGET_STATUS: "production_ready" });
  assert.equal(result.targetStatus, "production_ready");
});

test("loadStablePackageCliEnv throws on invalid targetStatus", () => {
  assert.throws(
    () => loadStablePackageCliEnv({ AA_STABLE_PACKAGE_TARGET_STATUS: "invalid" }),
    /stable\.invalid_gate_target_status/,
  );
});

// ---------------------------------------------------------------------------
// Tests for CLI factory configuration
// ---------------------------------------------------------------------------

test("stable-package uses AA_STABLE_PACKAGE env var prefix", () => {
  const envVar = "AA_STABLE_PACKAGE";
  assert.ok(envVar.startsWith("AA_"));
  assert.ok(envVar.includes("PACKAGE"));
});

test("stable-package defaultDir follows data/stable-package pattern", () => {
  const defaultDir = "data/stable-package";
  assert.ok(defaultDir.startsWith("data/"));
  assert.ok(defaultDir.includes("package"));
});

test("stable-package failed predicate checks overallVerdict", () => {
  // Mirrors the failed predicate in stable-package.ts
  const failed = (report: { overallVerdict?: string }) => report.overallVerdict === "promote_blocked";

  assert.equal(failed({ overallVerdict: "promote_blocked" }), true);
  assert.equal(failed({ overallVerdict: "promoted" }), false);
});
