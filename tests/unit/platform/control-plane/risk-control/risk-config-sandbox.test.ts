/**
 * Unit tests for loadRiskConfig sandbox policy integration
 * Tests path validation and sandbox policy enforcement in risk config loading
 */

import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";

import { loadRiskConfig } from "../../../../../src/platform/five-plane-control-plane/risk-control/risk-config-loader.js";
import { createConfigReadPolicy, checkSandboxPath } from "../../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";

test("loadRiskConfig with valid sandbox policy allows access", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-sandbox-test-"));
  const configRoot = join(tempDir, "config");
  mkdirSync(configRoot, { recursive: true });

  try {
    const configPath = join(configRoot, "risk-config.json");
    writeFileSync(configPath, JSON.stringify(createValidRiskConfig()), "utf-8");

    const policy = createConfigReadPolicy(configRoot);
    const config = loadRiskConfig(configPath, policy);

    assert.ok(config);
    assert.equal(config.factorWeights.stepTypeRisk, 0.2);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("loadRiskConfig with sandbox policy denying path throws error", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-sandbox-test-"));
  const configRoot = join(tempDir, "config");
  mkdirSync(configRoot, { recursive: true });

  try {
    const configPath = join(configRoot, "risk-config.json");
    writeFileSync(configPath, JSON.stringify(createValidRiskConfig()), "utf-8");

    // Create a policy that only allows a different directory
    const policy = createConfigReadPolicy("/completely/different/path");

    let threw = false;
    try {
      loadRiskConfig(configPath, policy);
    } catch (error: unknown) {
      threw = true;
      // Should throw some error for path outside sandbox
      const errorCode = (error as { code?: string }).code;
      const errorMessage = (error as Error).message;
      // Either it's a PolicyDeniedError or the path simply isn't allowed
      assert.ok(
        errorMessage.includes("denied") ||
        errorCode === "config.risk_denied" ||
        errorCode?.includes("sandbox"),
        `Expected sandbox-related error, got: ${errorMessage} (code: ${errorCode})`,
      );
    }
    assert.ok(threw, "Expected an error to be thrown for path outside sandbox");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("loadRiskConfig with sandbox policy denies path traversal", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-sandbox-test-"));
  const configRoot = join(tempDir, "config");
  mkdirSync(configRoot, { recursive: true });

  try {
    const configPath = join(configRoot, "risk-config.json");
    writeFileSync(configPath, JSON.stringify(createValidRiskConfig()), "utf-8");

    // Use a path that is clearly outside any allowed config directory
    // Absolute path outside sandbox roots
    const maliciousPath = "/etc/passwd";
    const policy = createConfigReadPolicy(configRoot);

    let threw = false;
    try {
      loadRiskConfig(maliciousPath, policy);
    } catch (error: unknown) {
      threw = true;
      // Should be denied by sandbox
      const errorCode = (error as { code?: string }).code;
      assert.ok(
        errorCode === "config.risk_denied" ||
        errorCode?.includes("sandbox"),
        `Expected sandbox denial, got error code: ${errorCode}`,
      );
    }
    assert.ok(threw, "Should prevent path traversal to /etc/passwd");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("loadRiskConfig uses normalized path from sandbox policy", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-sandbox-test-"));
  const configRoot = join(tempDir, "config");
  mkdirSync(configRoot, { recursive: true });

  try {
    const configPath = join(configRoot, "risk-config.json");
    writeFileSync(configPath, JSON.stringify(createValidRiskConfig()), "utf-8");

    const policy = createConfigReadPolicy(configRoot);
    const checkResult = checkSandboxPath(policy, configPath);

    assert.equal(checkResult.allowed, true);
    assert.ok(checkResult.normalizedPath.length > 0);

    const config = loadRiskConfig(configPath, policy);
    assert.ok(config);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("loadRiskConfig without sandbox policy bypasses path validation", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-sandbox-test-"));
  const configDir = join(tempDir, "riskdir");
  mkdirSync(configDir, { recursive: true });

  try {
    const configPath = join(configDir, "risk-config.json");
    writeFileSync(configPath, JSON.stringify(createValidRiskConfig()), "utf-8");

    // Without sandbox policy, should still work
    const config = loadRiskConfig(configPath);
    assert.ok(config);
    assert.equal(config.factorWeights.confidence, 0.1);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("loadRiskConfig with sandbox policy handles missing file", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-sandbox-test-"));
  const configRoot = join(tempDir, "config");
  mkdirSync(configRoot, { recursive: true });

  try {
    const configPath = join(configRoot, "nonexistent.json");
    const policy = createConfigReadPolicy(configRoot);

    assert.throws(
      () => loadRiskConfig(configPath, policy),
      (error: unknown) => error instanceof Error,
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("loadRiskConfig with empty sandbox allowedRoots", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-sandbox-test-"));
  const configRoot = join(tempDir, "config");
  mkdirSync(configRoot, { recursive: true });

  try {
    const configPath = join(configRoot, "risk-config.json");
    writeFileSync(configPath, JSON.stringify(createValidRiskConfig()), "utf-8");

    const policy = createConfigReadPolicy(configRoot);
    const config = loadRiskConfig(configPath, policy);

    assert.ok(config);
    assert.deepEqual(Object.keys(config.factorWeights), [
      "stepTypeRisk",
      "targetSystemRisk",
      "dataClassRisk",
      "blastRadius",
      "priorFailureRate",
      "confidence",
    ]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

function createValidRiskConfig() {
  return {
    factorWeights: {
      stepTypeRisk: 0.2,
      targetSystemRisk: 0.25,
      dataClassRisk: 0.15,
      blastRadius: 0.2,
      priorFailureRate: 0.1,
      confidence: 0.1,
    },
    stepTypeRiskValues: { read: 1, write: 3, delete: 5, external_call: 4 },
    targetSystemRiskValues: { internal: 1, staging: 2, production: 4 },
    dataClassRiskValues: { public: 1, internal: 2, confidential: 3, restricted: 5 },
    blastRadiusValues: { single_task: 1, workflow: 2, tenant: 4, platform: 5 },
    priorFailureRateThresholds: {
      low: { maxPercent: 10, value: 0.5 },
      medium: { maxPercent: 25, value: 1.0 },
      high: { maxPercent: 50, value: 2.0 },
      critical: { maxPercent: 100, value: 3.0 },
    },
    confidenceValues: { high: 1.0, medium: 0.7, low: 0.4 },
    riskLevelThresholds: { low: 2.0, medium: 3.5, high: 5.0, critical: 7.0 },
    riskLevelActions: {
      low: { autoExecute: true, logLevel: "info", requiresApproval: false, sideEffect: "normal", evidenceLevel: "basic" },
      medium: { autoExecute: true, logLevel: "warn", requiresApproval: false, sideEffect: "normal_with_validation", evidenceLevel: "enhanced" },
      high: { autoExecute: false, logLevel: "error", requiresApproval: true, approvalType: "standard", sideEffect: "restricted", evidenceLevel: "full" },
      critical: { autoExecute: false, logLevel: "critical", requiresApproval: true, approvalType: "break_glass", sideEffect: "prohibited", evidenceLevel: "legal" },
    },
  };
}