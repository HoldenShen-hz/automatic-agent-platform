/**
 * Risk Configuration Tests
 *
 * Tests for config/risk/default.json focusing on:
 * - Issue #1987: 6 factor vs 8 factor model
 * - Issue #1998: medium risk autoExecute:true violates defense-in-depth
 *
 * These tests verify the security posture and completeness of the risk configuration.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load the actual risk config
const RISK_CONFIG_PATH = resolve(process.cwd(), "config/risk/default.json");
const riskConfig = JSON.parse(readFileSync(RISK_CONFIG_PATH, "utf-8"));

/**
 * Risk config should expose the canonical 8-factor model.
 *
 * The factorWeights object should include all risk factors:
 * 1. targetSystemRisk
 * 2. dataClassRisk
 * 3. blastRadius
 * 4. priorFailureRate
 * 5. confidence
 * 6. aiModelRisk
 * 7. thirdPartyRisk
 * 8. supplyChainRisk
 */
test("risk-config: factorWeights should contain all expected risk factors", () => {
  const expectedFactors = [
    "targetSystemRisk",
    "dataClassRisk",
    "blastRadius",
    "priorFailureRate",
    "confidence",
    "aiModelRisk",
    "thirdPartyRisk",
    "supplyChainRisk",
  ];

  const actualFactors = Object.keys(riskConfig.factorWeights);

  for (const factor of expectedFactors) {
    assert.ok(
      actualFactors.includes(factor),
      `Expected factorWeights to include '${factor}'`,
    );
  }

  assert.equal(
    actualFactors.length,
    8,
    "factorWeights should expose the canonical 8-factor risk model.",
  );
});

test("risk-config: riskCategories should include ai category", () => {
  // Per issue #1987, riskCategories should include 'ai' as a separate category
  const expectedCategories = [
    "operational",
    "financial",
    "compliance",
    "reputational",
    "safety",
    "strategic",
    "ai", // This should be present for complete coverage
  ];

  for (const category of expectedCategories) {
    assert.ok(
      riskConfig.riskCategories.includes(category),
      `riskCategories should include '${category}'`,
    );
  }
});

/**
 * Medium risk tasks should NOT auto-execute as they require human oversight.
 */
test("risk-config: medium risk should NOT auto-execute (defense-in-depth)", () => {
  const mediumRiskAction = riskConfig.riskLevelActions.medium;

  assert.equal(
    mediumRiskAction.autoExecute,
    false,
    "Medium-risk actions must require approval and cannot auto-execute.",
  );
  assert.equal(mediumRiskAction.requiresApproval, true);
});

test("risk-config: high risk should require approval", () => {
  const highRiskAction = riskConfig.riskLevelActions.high;

  assert.equal(highRiskAction.requiresApproval, true);
  assert.equal(highRiskAction.autoExecute, false);
  assert.equal(highRiskAction.approvalType, "standard");
});

test("risk-config: critical risk should require break_glass approval", () => {
  const criticalRiskAction = riskConfig.riskLevelActions.critical;

  assert.equal(criticalRiskAction.requiresApproval, true);
  assert.equal(criticalRiskAction.autoExecute, false);
  assert.equal(criticalRiskAction.approvalType, "break_glass");
});

test("risk-config: low risk autoExecute is acceptable", () => {
  const lowRiskAction = riskConfig.riskLevelActions.low;

  // Low risk can auto-execute as it has minimal blast radius
  assert.equal(lowRiskAction.autoExecute, true);
  assert.equal(lowRiskAction.requiresApproval, false);
});

test("risk-config: riskLevelThresholds should be properly ordered", () => {
  const thresholds = riskConfig.riskLevelThresholds;

  assert.ok(thresholds.low < thresholds.medium);
  assert.ok(thresholds.medium < thresholds.high);
  assert.ok(thresholds.high < thresholds.critical);
});

test("risk-config: riskLevelThresholds boundaries should be correct", () => {
  const thresholds = riskConfig.riskLevelThresholds;

  // Thresholds should follow the pattern: low=0.25, medium=0.5, high=0.75, critical=1.0
  assert.equal(thresholds.low, 0.25);
  assert.equal(thresholds.medium, 0.5);
  assert.equal(thresholds.high, 0.75);
  assert.equal(thresholds.critical, 1.0);
});

test("risk-config: factorWeights values should be positive", () => {
  for (const [factor, weight] of Object.entries(riskConfig.factorWeights)) {
    assert.ok(
      typeof weight === "number" && weight > 0,
      `factorWeights.${factor} should be a positive number`,
    );
  }
});

test("risk-config: domainRiskDefaults should specify humanAccountable for high-risk domains", () => {
  const domainRiskDefaults = riskConfig.domainRiskDefaults;

  // High risk domains like healthcare should require human accountability
  if (domainRiskDefaults.healthcare) {
    assert.equal(domainRiskDefaults.healthcare.humanAccountable, true);
    assert.equal(domainRiskDefaults.healthcare.riskLevel, "critical");
  }

  if (domainRiskDefaults.quant_trading) {
    assert.equal(domainRiskDefaults.quant_trading.humanAccountable, true);
    assert.equal(domainRiskDefaults.quant_trading.riskLevel, "high");
  }
});

test("risk-config: eventRegistry should have required tier1Events", () => {
  const eventRegistry = riskConfig.eventRegistry;

  assert.ok(Array.isArray(eventRegistry.tier1Events));
  assert.ok(eventRegistry.tier1Events.length > 0);
  assert.ok(eventRegistry.tier1Events.includes("risk.assessment.completed"));
  assert.ok(eventRegistry.tier1Events.includes("risk.level.changed"));
  assert.ok(eventRegistry.tier1Events.includes("risk.breach.detected"));
});

test("risk-config: dlqModel should be properly configured", () => {
  const dlqModel = riskConfig.eventRegistry.dlqModel;

  assert.equal(dlqModel.enabled, true);
  assert.ok(dlqModel.maxRetries >= 1);
  assert.ok(dlqModel.retryBackoffMs > 0);
  assert.ok(Array.isArray(dlqModel.deadLetterActions));
  assert.ok(dlqModel.deadLetterActions.length > 0);
});

test("risk-config: autonomyRiskCaps should be correctly ordered", () => {
  const autonomyRiskCaps = riskConfig.autonomyRiskCaps;

  // Autonomy should decrease as risk increases
  assert.equal(autonomyRiskCaps.critical, "manual");
  assert.equal(autonomyRiskCaps.high, "semi_auto");
  assert.equal(autonomyRiskCaps.medium, "supervised");
  assert.equal(autonomyRiskCaps.low, "full_auto");
});
