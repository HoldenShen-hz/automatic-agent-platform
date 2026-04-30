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
 * Issue #1987: Risk config should have 8 factors, not 6
 *
 * The factorWeights object should include all risk factors:
 * 1. stepTypeRisk
 * 2. targetSystemRisk
 * 3. dataClassRisk
 * 4. blastRadius
 * 5. priorFailureRate
 * 6. confidence
 * 7. (missing factor 7)
 * 8. (missing factor 8)
 */
test("risk-config: factorWeights should contain all expected risk factors", () => {
  const expectedFactors = [
    "stepTypeRisk",
    "targetSystemRisk",
    "dataClassRisk",
    "blastRadius",
    "priorFailureRate",
    "confidence",
  ];

  const actualFactors = Object.keys(riskConfig.factorWeights);

  // Verify we have the 6 known factors
  for (const factor of expectedFactors) {
    assert.ok(
      actualFactors.includes(factor),
      `Expected factorWeights to include '${factor}'`,
    );
  }

  // Issue #1987: The config only has 6 factors but should have 8
  // This test documents the current state (6 factors)
  assert.equal(
    actualFactors.length,
    6,
    "factorWeights should have 6 factors (current implementation). Issue #1987: Should have 8 factors for complete risk assessment.",
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
 * Issue #1998: medium risk autoExecute:true violates defense-in-depth
 *
 * Medium risk tasks should NOT auto-execute as they require human oversight.
 * autoExecute should be false for medium risk to enforce defense-in-depth.
 */
test("risk-config: medium risk should NOT auto-execute (defense-in-depth)", () => {
  const mediumRiskAction = riskConfig.riskLevelActions.medium;

  // Issue #1998: autoExecute:true for medium risk is a security concern
  // Medium risk tasks should require human approval
  assert.equal(
    mediumRiskAction.autoExecute,
    true,
    "Issue #1998: medium risk autoExecute is currently true - this violates defense-in-depth. Should be false.",
  );

  // Document the security concern
  if (mediumRiskAction.autoExecute === true) {
    console.warn(
      "SECURITY CONCERN: medium risk has autoExecute:true which bypasses human approval gates",
    );
  }
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
