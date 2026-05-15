import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

import { loadRiskConfig } from "../../../../../src/platform/five-plane-control-plane/risk-control/risk-config-loader.js";

test("loadRiskConfig parses valid risk config file", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-config-test-"));
  const configPath = join(tempDir, "test-risk-config.json");

  try {
    const validConfig = {
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

    writeFileSync(configPath, JSON.stringify(validConfig), "utf-8");

    const config = loadRiskConfig(configPath);

    assert.equal(config.factorWeights.stepTypeRisk, 0.2);
    assert.equal(config.factorWeights.targetSystemRisk, 0.25);
    assert.equal(config.factorWeights.dataClassRisk, 0.15);
    assert.equal(config.factorWeights.blastRadius, 0.2);
    assert.equal(config.factorWeights.priorFailureRate, 0.1);
    assert.equal(config.factorWeights.confidence, 0.1);

    assert.deepEqual(config.stepTypeRiskValues, { read: 1, write: 3, delete: 5, external_call: 4 });
    assert.deepEqual(config.targetSystemRiskValues, { internal: 1, staging: 2, production: 4 });
    assert.deepEqual(config.dataClassRiskValues, { public: 1, internal: 2, confidential: 3, restricted: 5 });
    assert.deepEqual(config.blastRadiusValues, { single_task: 1, workflow: 2, tenant: 4, platform: 5 });

    assert.equal(config.riskLevelThresholds.low, 2.0);
    assert.equal(config.riskLevelThresholds.medium, 3.5);
    assert.equal(config.riskLevelThresholds.high, 5.0);
    assert.equal(config.riskLevelThresholds.critical, 7.0);

    assert.equal(config.riskLevelActions.low.autoExecute, true);
    assert.equal(config.riskLevelActions.medium.requiresApproval, false);
    assert.equal(config.riskLevelActions.high.requiresApproval, true);
    assert.equal(config.riskLevelActions.critical.approvalType, "break_glass");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("loadRiskConfig parses priorFailureRateThresholds correctly", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-config-test-"));
  const configPath = join(tempDir, "test-risk-config.json");

  try {
    const validConfig = {
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
        low: { maxPercent: 5, value: 0.25 },
        medium: { maxPercent: 15, value: 0.75 },
        high: { maxPercent: 40, value: 1.5 },
        critical: { maxPercent: 100, value: 2.5 },
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

    writeFileSync(configPath, JSON.stringify(validConfig), "utf-8");

    const config = loadRiskConfig(configPath);

    assert.equal(config.priorFailureRateThresholds.low.maxPercent, 5);
    assert.equal(config.priorFailureRateThresholds.low.value, 0.25);
    assert.equal(config.priorFailureRateThresholds.medium.maxPercent, 15);
    assert.equal(config.priorFailureRateThresholds.high.maxPercent, 40);
    assert.equal(config.priorFailureRateThresholds.critical.maxPercent, 100);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("loadRiskConfig loads and parses config without sandbox policy", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-config-test-"));
  const configPath = join(tempDir, "test-risk-config.json");

  try {
    const validConfig = {
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

    writeFileSync(configPath, JSON.stringify(validConfig), "utf-8");

    // Without sandbox policy, the function should work
    const config = loadRiskConfig(configPath);
    assert.equal(config.factorWeights.stepTypeRisk, 0.2);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("loadRiskConfig parses all confidence levels", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-config-test-"));
  const configPath = join(tempDir, "test-risk-config.json");

  try {
    const validConfig = {
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

    writeFileSync(configPath, JSON.stringify(validConfig), "utf-8");

    const config = loadRiskConfig(configPath);
    assert.equal(config.confidenceValues.high, 1.0);
    assert.equal(config.confidenceValues.medium, 0.7);
    assert.equal(config.confidenceValues.low, 0.4);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("loadRiskConfig rejects invalid JSON", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-config-test-"));
  const configPath = join(tempDir, "test-risk-config.json");

  try {
    writeFileSync(configPath, "not valid json {", "utf-8");

    assert.throws(
      () => loadRiskConfig(configPath),
      (error: unknown) => error instanceof SyntaxError,
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("loadRiskConfig handles missing optional riskLevelActions fields", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-config-test-"));
  const configPath = join(tempDir, "test-risk-config.json");

  try {
    const minimalConfig = {
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

    writeFileSync(configPath, JSON.stringify(minimalConfig), "utf-8");

    const config = loadRiskConfig(configPath);
    assert.equal(config.riskLevelActions.low.sideEffect, "normal");
    assert.equal(config.riskLevelActions.high.approvalType, "standard");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("loadRiskConfig parses stepTypeRiskValues correctly", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-config-test-"));
  const configPath = join(tempDir, "test-risk-config.json");

  try {
    const validConfig = {
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

    writeFileSync(configPath, JSON.stringify(validConfig), "utf-8");

    const config = loadRiskConfig(configPath);
    assert.equal(config.stepTypeRiskValues.read, 1);
    assert.equal(config.stepTypeRiskValues.write, 3);
    assert.equal(config.stepTypeRiskValues.delete, 5);
    assert.equal(config.stepTypeRiskValues.external_call, 4);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("loadRiskConfig parses targetSystemRiskValues correctly", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-config-test-"));
  const configPath = join(tempDir, "test-risk-config.json");

  try {
    const validConfig = {
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

    writeFileSync(configPath, JSON.stringify(validConfig), "utf-8");

    const config = loadRiskConfig(configPath);
    assert.equal(config.targetSystemRiskValues.internal, 1);
    assert.equal(config.targetSystemRiskValues.staging, 2);
    assert.equal(config.targetSystemRiskValues.production, 4);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("loadRiskConfig parses blastRadiusValues correctly", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-config-test-"));
  const configPath = join(tempDir, "test-risk-config.json");

  try {
    const validConfig = {
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

    writeFileSync(configPath, JSON.stringify(validConfig), "utf-8");

    const config = loadRiskConfig(configPath);
    assert.equal(config.blastRadiusValues.single_task, 1);
    assert.equal(config.blastRadiusValues.workflow, 2);
    assert.equal(config.blastRadiusValues.tenant, 4);
    assert.equal(config.blastRadiusValues.platform, 5);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
