/**
 * Unit tests for RiskConfigLoader
 * Tests the loadRiskConfig function behavior including path validation
 */

import assert from "node:assert/strict";
import test from "node:test";
import { loadRiskConfig } from "../../../../../src/platform/control-plane/risk-control/risk-config-loader.js";
import { PolicyDeniedError } from "../../../../../src/platform/contracts/errors.js";
import type { SandboxPolicy } from "../../../../../src/platform/control-plane/iam/sandbox-policy.js";

test("loadRiskConfig rejects path outside sandbox", () => {
  const mockSandboxPolicy: SandboxPolicy = {
    policyId: "test-policy",
    mode: "read_only",
    allowedRoots: ["/allowed/path"],
    deniedRoots: ["../etc"],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
  };

  assert.throws(
    () => loadRiskConfig("/malicious/path/../../../etc/passwd", mockSandboxPolicy),
    PolicyDeniedError,
  );
});

test("loadRiskConfig accepts valid path within sandbox", () => {
  const mockSandboxPolicy: SandboxPolicy = {
    policyId: "test-policy",
    mode: "read_only",
    allowedRoots: ["/app/config"],
    deniedRoots: [],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
  };

  // This should not throw PolicyDeniedError (may fail at readFileSync but path validation passes)
  try {
    loadRiskConfig("/app/config/risk/default.json", mockSandboxPolicy);
    assert.ok(true);
  } catch (e) {
    // We expect ENOENT since file doesn't exist in test, but not PolicyDeniedError
    if (e instanceof PolicyDeniedError) {
      throw e; // re-throw PolicyDeniedError - test should fail
    }
    // Other errors (like file not found) are acceptable
    assert.ok(true);
  }
});

test("loadRiskConfig sandboxPolicy parameter is optional", () => {
  // Without sandbox policy, should default to reading from process.cwd()
  // The test will fail at file read, but path validation should not throw
  try {
    const config = loadRiskConfig();
    assert.ok(config !== null);
  } catch (e) {
    // Expected: file may not exist at default path
    assert.ok(!(e instanceof PolicyDeniedError));
  }
});

test("RiskConfigLoader handles empty sandboxPolicy gracefully", () => {
  const emptySandboxPolicy: SandboxPolicy = {
    policyId: "empty-policy",
    mode: "read_only",
    allowedRoots: [],
    deniedRoots: [],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
  };

  // Empty allowed roots should still allow the path check to proceed
  try {
    loadRiskConfig("/some/path/config.json", emptySandboxPolicy);
  } catch (e) {
    // File read error expected, but not PolicyDeniedError for path traversal
    assert.ok(!(e instanceof PolicyDeniedError) || (e as Error).message.includes("ENOENT"));
  }
});

test("RiskConfigLoader sandbox denies relative path traversal", () => {
  const sandboxPolicy: SandboxPolicy = {
    policyId: "test-policy",
    mode: "read_only",
    allowedRoots: ["/safe"],
    deniedRoots: [],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
  };

  assert.throws(
    () => loadRiskConfig("../dangerous", sandboxPolicy),
    PolicyDeniedError,
  );

  assert.throws(
    () => loadRiskConfig("../../../etc/passwd", sandboxPolicy),
    PolicyDeniedError,
  );
});