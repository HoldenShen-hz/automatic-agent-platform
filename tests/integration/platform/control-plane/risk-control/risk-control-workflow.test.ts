/**
 * Integration Test: Risk Control Workflow
 *
 * Tests the complete risk control workflow:
 * - Config loading with various settings
 * - Engine evaluation using loaded config
 * - End-to-end risk scoring and action determination
 */

import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";

import { RiskEvaluationEngine } from "../../../../../src/platform/control-plane/risk-control/risk-evaluation-engine.js";
import { loadRiskConfig } from "../../../../../src/platform/control-plane/risk-control/risk-config-loader.js";

test("risk-control: load config and evaluate low risk workflow", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-integration-"));
  try {
    const configPath = join(tempDir, "risk.json");
    writeFileSync(configPath, JSON.stringify(createLowRiskConfig()), "utf-8");

    const config = loadRiskConfig(configPath);
    const engine = new RiskEvaluationEngine({ config });

    const result = engine.evaluate({
      taskId: "workflow-low",
      factors: {
        stepTypeRisk: "read",
        targetSystemRisk: "internal",
        dataClassRisk: "public",
        blastRadius: "single_task",
        priorFailureRatePercent: 5,
        confidence: "high",
      },
    });

    assert.equal(result.riskLevel, "low");
    assert.equal(result.autoExecute, true);
    assert.equal(result.requiresApproval, false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("risk-control: load config and evaluate high risk workflow", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-integration-"));
  try {
    const configPath = join(tempDir, "risk.json");
    writeFileSync(configPath, JSON.stringify(createHighRiskConfig()), "utf-8");

    const config = loadRiskConfig(configPath);
    const engine = new RiskEvaluationEngine({ config });

    const result = engine.evaluate({
      taskId: "workflow-high",
      factors: {
        stepTypeRisk: "delete",
        targetSystemRisk: "production",
        dataClassRisk: "confidential",
        blastRadius: "tenant",
        priorFailureRatePercent: 40,
        confidence: "low",
      },
    });

    assert.equal(result.riskLevel, "high");
    assert.equal(result.autoExecute, false);
    assert.equal(result.requiresApproval, true);
    assert.equal(result.sideEffect, "restricted");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("risk-control: config with custom thresholds affects evaluation", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-integration-"));
  try {
    const configPath = join(tempDir, "risk.json");
    // Config with lower thresholds (more sensitive)
    const customConfig = {
      factorWeights: {
        stepTypeRisk: 3,
        targetSystemRisk: 4,
        dataClassRisk: 3,
        blastRadius: 2,
        priorFailureRate: 2,
        confidence: 1,
      },
      stepTypeRiskValues: { read: 1, write: 3, delete: 5, external_call: 4 },
      targetSystemRiskValues: { internal: 1, staging: 2, production: 5 },
      dataClassRiskValues: { public: 1, internal: 2, confidential: 4, restricted: 5 },
      blastRadiusValues: { single_task: 1, workflow: 2, tenant: 3, platform: 5 },
      priorFailureRateThresholds: {
        low: { maxPercent: 5, value: 1 },
        medium: { maxPercent: 15, value: 2 },
        high: { maxPercent: 30, value: 3 },
        critical: { maxPercent: 100, value: 5 },
      },
      confidenceValues: { high: 1, medium: 3, low: 5 },
      riskLevelThresholds: { low: 0.1, medium: 0.3, high: 0.5, critical: 0.8 },
      riskLevelActions: {
        low: { autoExecute: true, logLevel: "info", requiresApproval: false, sideEffect: "normal", evidenceLevel: "basic" },
        medium: { autoExecute: true, logLevel: "warn", requiresApproval: false, sideEffect: "normal_with_validation", evidenceLevel: "enhanced" },
        high: { autoExecute: false, logLevel: "error", requiresApproval: true, approvalType: "standard", sideEffect: "restricted", evidenceLevel: "full" },
        critical: { autoExecute: false, logLevel: "critical", requiresApproval: true, approvalType: "break_glass", sideEffect: "prohibited", evidenceLevel: "legal" },
      },
    };
    writeFileSync(configPath, JSON.stringify(customConfig), "utf-8");

    const config = loadRiskConfig(configPath);
    const engine = new RiskEvaluationEngine({ config });

    // With stricter thresholds (high=0.5), same factors may produce different level
    // Calculate: write=3*3=9, staging=2*4=8, internal=2*3=6, workflow=2*2=4, 20% failure=2*2=4, medium conf=3*1=3
    // Total = 34, score = 34/75 = 0.453 which is medium with thresholds low:0.1, medium:0.3, high:0.5
    // vs original config where same factors would be low
    const result = engine.evaluate({
      taskId: "workflow-strict",
      factors: {
        stepTypeRisk: "write",
        targetSystemRisk: "staging",
        dataClassRisk: "internal",
        blastRadius: "workflow",
        priorFailureRatePercent: 20,
        confidence: "medium",
      },
    });

    // Score 0.453 is above medium threshold (0.3), so should be medium
    assert.ok(result.riskScore >= 0.3 && result.riskScore < 0.5, `Expected medium risk, score: ${result.riskScore}`);
    assert.equal(result.riskLevel, "medium");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("risk-control: config with domain profiles raises risk", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-integration-"));
  try {
    const configPath = join(tempDir, "risk.json");
    writeFileSync(configPath, JSON.stringify(createStandardConfig()), "utf-8");

    const config = loadRiskConfig(configPath);
    const domainProfiles = new Map([
      ["sensitive-domain", "high" as const],
    ]);
    const engine = new RiskEvaluationEngine({ config, domainRiskProfiles: domainProfiles });

    // Base would be low
    const baseResult = engine.evaluate({
      taskId: "workflow-base",
      factors: {
        stepTypeRisk: "read",
        targetSystemRisk: "internal",
        dataClassRisk: "public",
        blastRadius: "single_task",
        priorFailureRatePercent: 0,
        confidence: "high",
      },
    });
    assert.equal(baseResult.riskLevel, "low");

    // Same factors but with domain override
    const overrideResult = engine.evaluate({
      taskId: "workflow-override",
      factors: {
        stepTypeRisk: "read",
        targetSystemRisk: "internal",
        dataClassRisk: "public",
        blastRadius: "single_task",
        priorFailureRatePercent: 0,
        confidence: "high",
      },
      domainId: "sensitive-domain",
    });
    assert.equal(overrideResult.riskLevel, "high");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("risk-control: read operation vs delete operation scoring", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-integration-"));
  try {
    const configPath = join(tempDir, "risk.json");
    writeFileSync(configPath, JSON.stringify(createStandardConfig()), "utf-8");

    const config = loadRiskConfig(configPath);
    const engine = new RiskEvaluationEngine({ config });

    // Read operation - medium risk
    // Score: read=1*3=3, production=5*4=20, internal=2*3=6, tenant=3*2=6, 15% failure=2*2=4, medium=3*1=3
    // Total = 42, score = 42/75 = 0.56 -> medium
    const readResult = engine.evaluate({
      taskId: "workflow-read",
      factors: {
        stepTypeRisk: "read",
        targetSystemRisk: "production",
        dataClassRisk: "internal",
        blastRadius: "tenant",
        priorFailureRatePercent: 15,
        confidence: "medium",
      },
    });

    // Delete operation - high risk (more extreme factors)
    // Score: delete=5*3=15, production=5*4=20, confidential=4*3=12, tenant=3*2=6, 40% failure=3*2=6, low=5*1=5
    // Total = 64, score = 64/75 = 0.853 -> high
    const deleteResult = engine.evaluate({
      taskId: "workflow-delete",
      factors: {
        stepTypeRisk: "delete",
        targetSystemRisk: "production",
        dataClassRisk: "confidential",
        blastRadius: "tenant",
        priorFailureRatePercent: 40,
        confidence: "low",
      },
    });

    assert.ok(deleteResult.riskScore > readResult.riskScore);
    assert.equal(readResult.riskLevel, "medium");
    assert.equal(deleteResult.riskLevel, "high");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("risk-control: production vs internal system scoring", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-integration-"));
  try {
    const configPath = join(tempDir, "risk.json");
    writeFileSync(configPath, JSON.stringify(createStandardConfig()), "utf-8");

    const config = loadRiskConfig(configPath);
    const engine = new RiskEvaluationEngine({ config });

    const internalResult = engine.evaluate({
      taskId: "workflow-internal",
      factors: {
        stepTypeRisk: "write",
        targetSystemRisk: "internal",
        dataClassRisk: "internal",
        blastRadius: "single_task",
        priorFailureRatePercent: 20,
        confidence: "medium",
      },
    });

    const productionResult = engine.evaluate({
      taskId: "workflow-production",
      factors: {
        stepTypeRisk: "write",
        targetSystemRisk: "production",
        dataClassRisk: "internal",
        blastRadius: "single_task",
        priorFailureRatePercent: 20,
        confidence: "medium",
      },
    });

    assert.ok(productionResult.riskScore > internalResult.riskScore);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("risk-control: restricted data class increases risk", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-integration-"));
  try {
    const configPath = join(tempDir, "risk.json");
    writeFileSync(configPath, JSON.stringify(createStandardConfig()), "utf-8");

    const config = loadRiskConfig(configPath);
    const engine = new RiskEvaluationEngine({ config });

    const publicResult = engine.evaluate({
      taskId: "workflow-public",
      factors: {
        stepTypeRisk: "read",
        targetSystemRisk: "staging",
        dataClassRisk: "public",
        blastRadius: "single_task",
        priorFailureRatePercent: 10,
        confidence: "high",
      },
    });

    const restrictedResult = engine.evaluate({
      taskId: "workflow-restricted",
      factors: {
        stepTypeRisk: "read",
        targetSystemRisk: "staging",
        dataClassRisk: "restricted",
        blastRadius: "single_task",
        priorFailureRatePercent: 10,
        confidence: "high",
      },
    });

    assert.ok(restrictedResult.riskScore > publicResult.riskScore);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("risk-control: tenant vs platform blast radius", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-integration-"));
  try {
    const configPath = join(tempDir, "risk.json");
    writeFileSync(configPath, JSON.stringify(createStandardConfig()), "utf-8");

    const config = loadRiskConfig(configPath);
    const engine = new RiskEvaluationEngine({ config });

    const tenantResult = engine.evaluate({
      taskId: "workflow-tenant",
      factors: {
        stepTypeRisk: "write",
        targetSystemRisk: "staging",
        dataClassRisk: "internal",
        blastRadius: "tenant",
        priorFailureRatePercent: 20,
        confidence: "medium",
      },
    });

    const platformResult = engine.evaluate({
      taskId: "workflow-platform",
      factors: {
        stepTypeRisk: "write",
        targetSystemRisk: "staging",
        dataClassRisk: "internal",
        blastRadius: "platform",
        priorFailureRatePercent: 20,
        confidence: "medium",
      },
    });

    assert.ok(platformResult.riskScore > tenantResult.riskScore);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("risk-control: prior failure rate affects score", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-integration-"));
  try {
    const configPath = join(tempDir, "risk.json");
    writeFileSync(configPath, JSON.stringify(createStandardConfig()), "utf-8");

    const config = loadRiskConfig(configPath);
    const engine = new RiskEvaluationEngine({ config });

    const lowFailureResult = engine.evaluate({
      taskId: "workflow-low-failure",
      factors: {
        stepTypeRisk: "read",
        targetSystemRisk: "internal",
        dataClassRisk: "public",
        blastRadius: "single_task",
        priorFailureRatePercent: 5,
        confidence: "high",
      },
    });

    const highFailureResult = engine.evaluate({
      taskId: "workflow-high-failure",
      factors: {
        stepTypeRisk: "read",
        targetSystemRisk: "internal",
        dataClassRisk: "public",
        blastRadius: "single_task",
        priorFailureRatePercent: 55,
        confidence: "high",
      },
    });

    assert.ok(highFailureResult.riskScore > lowFailureResult.riskScore);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("risk-control: low confidence increases risk", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-integration-"));
  try {
    const configPath = join(tempDir, "risk.json");
    writeFileSync(configPath, JSON.stringify(createStandardConfig()), "utf-8");

    const config = loadRiskConfig(configPath);
    const engine = new RiskEvaluationEngine({ config });

    const highConfResult = engine.evaluate({
      taskId: "workflow-high-conf",
      factors: {
        stepTypeRisk: "write",
        targetSystemRisk: "staging",
        dataClassRisk: "internal",
        blastRadius: "single_task",
        priorFailureRatePercent: 15,
        confidence: "high",
      },
    });

    const lowConfResult = engine.evaluate({
      taskId: "workflow-low-conf",
      factors: {
        stepTypeRisk: "write",
        targetSystemRisk: "staging",
        dataClassRisk: "internal",
        blastRadius: "single_task",
        priorFailureRatePercent: 15,
        confidence: "low",
      },
    });

    assert.ok(lowConfResult.riskScore > highConfResult.riskScore);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

function createLowRiskConfig() {
  return {
    factorWeights: {
      stepTypeRisk: 3,
      targetSystemRisk: 4,
      dataClassRisk: 3,
      blastRadius: 2,
      priorFailureRate: 2,
      confidence: 1,
    },
    stepTypeRiskValues: { read: 1, write: 3, delete: 5, external_call: 4 },
    targetSystemRiskValues: { internal: 1, staging: 2, production: 5 },
    dataClassRiskValues: { public: 1, internal: 2, confidential: 4, restricted: 5 },
    blastRadiusValues: { single_task: 1, workflow: 2, tenant: 3, platform: 5 },
    priorFailureRateThresholds: {
      low: { maxPercent: 10, value: 1 },
      medium: { maxPercent: 30, value: 2 },
      high: { maxPercent: 50, value: 3 },
      critical: { maxPercent: 100, value: 5 },
    },
    confidenceValues: { high: 1, medium: 3, low: 5 },
    riskLevelThresholds: { low: 0.25, medium: 0.5, high: 0.75, critical: 1.0 },
    riskLevelActions: {
      low: { autoExecute: true, logLevel: "info", requiresApproval: false, sideEffect: "normal", evidenceLevel: "basic" },
      medium: { autoExecute: true, logLevel: "warn", requiresApproval: false, sideEffect: "normal_with_validation", evidenceLevel: "enhanced" },
      high: { autoExecute: false, logLevel: "error", requiresApproval: true, approvalType: "standard", sideEffect: "restricted", evidenceLevel: "full" },
      critical: { autoExecute: false, logLevel: "critical", requiresApproval: true, approvalType: "break_glass", sideEffect: "prohibited", evidenceLevel: "legal" },
    },
  };
}

function createHighRiskConfig() {
  return {
    factorWeights: {
      stepTypeRisk: 3,
      targetSystemRisk: 4,
      dataClassRisk: 3,
      blastRadius: 2,
      priorFailureRate: 2,
      confidence: 1,
    },
    stepTypeRiskValues: { read: 1, write: 3, delete: 5, external_call: 4 },
    targetSystemRiskValues: { internal: 1, staging: 2, production: 5 },
    dataClassRiskValues: { public: 1, internal: 2, confidential: 4, restricted: 5 },
    blastRadiusValues: { single_task: 1, workflow: 2, tenant: 3, platform: 5 },
    priorFailureRateThresholds: {
      low: { maxPercent: 10, value: 1 },
      medium: { maxPercent: 30, value: 2 },
      high: { maxPercent: 50, value: 3 },
      critical: { maxPercent: 100, value: 5 },
    },
    confidenceValues: { high: 1, medium: 3, low: 5 },
    riskLevelThresholds: { low: 0.25, medium: 0.5, high: 0.75, critical: 1.0 },
    riskLevelActions: {
      low: { autoExecute: true, logLevel: "info", requiresApproval: false, sideEffect: "normal", evidenceLevel: "basic" },
      medium: { autoExecute: true, logLevel: "warn", requiresApproval: false, sideEffect: "normal_with_validation", evidenceLevel: "enhanced" },
      high: { autoExecute: false, logLevel: "error", requiresApproval: true, approvalType: "standard", sideEffect: "restricted", evidenceLevel: "full" },
      critical: { autoExecute: false, logLevel: "critical", requiresApproval: true, approvalType: "break_glass", sideEffect: "prohibited", evidenceLevel: "legal" },
    },
  };
}

function createStandardConfig() {
  return createLowRiskConfig();
}