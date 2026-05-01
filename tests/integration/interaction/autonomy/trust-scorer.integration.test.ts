/**
 * Integration Tests: Autonomy Trust Scorer
 *
 * Tests trust score calculation, trust level mapping,
 * inherent risk checks, and autonomy level mapping.
 *
 * §42.1: TrustScore range 0-1000 (scaled from original 0-100 thresholds)
 */

import test from "node:test";
import assert from "node:assert/strict";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import {
  calculateTrustScore,
  mapTrustLevel,
  checkInherentRisk,
  mapTrustLevelToAutonomyLevel,
  applyTrustDecay,
} from "../../../../src/interaction/autonomy/trust-scorer/index.js";
import type { CapabilityTrustScore, TrustLevel } from "../../../../src/interaction/autonomy/index.js";

function createIntegrationContext(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  return { workspace, cleanup: () => cleanupPath(workspace) };
}

// ============================================================================
// Trust Score Calculation
// ============================================================================

test("TrustScorer: calculateTrustScore returns 0 for no executions", () => {
  const ctx = createIntegrationContext("aa-trust-zero-");
  try {
    const score: CapabilityTrustScore = {
      domainId: "coding",
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      humanOverrides: 0,
      incidents: 0,
      lastIncidentAgeDays: undefined,
      lastIncidentSeverity: undefined,
      currentAutonomy: "suggestion",
    };

    const result = calculateTrustScore(score);
    assert.equal(result, 0, "Zero executions should yield trust score 0");
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: calculateTrustScore applies success points", () => {
  const ctx = createIntegrationContext("aa-trust-success-");
  try {
    const score: CapabilityTrustScore = {
      domainId: "coding",
      totalExecutions: 100,
      successfulExecutions: 95,
      failedExecutions: 5,
      humanOverrides: 0,
      incidents: 0,
      lastIncidentAgeDays: 100,
      lastIncidentSeverity: undefined,
      currentAutonomy: "suggestion",
    };

    const result = calculateTrustScore(score);
    // Success: (95/100) * 1000 = 950 points
    // No penalties, volume bonus = min(100, 100/50) = 2
    assert.ok(result >= 900, `Expected high trust score from successes, got ${result}`);
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: calculateTrustScore applies human override penalty", () => {
  const ctx = createIntegrationContext("aa-trust-override-");
  try {
    const score: CapabilityTrustScore = {
      domainId: "coding",
      totalExecutions: 100,
      successfulExecutions: 100,
      failedExecutions: 0,
      humanOverrides: 10, // 10% override rate
      incidents: 0,
      lastIncidentAgeDays: 100,
      lastIncidentSeverity: undefined,
      currentAutonomy: "suggestion",
    };

    const result = calculateTrustScore(score);
    // Success: 1000, Override penalty: (10/100) * 200 = 200, net = 800
    assert.ok(result < 1000, "Human overrides should reduce trust score");
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: calculateTrustScore applies incident penalty", () => {
  const ctx = createIntegrationContext("aa-trust-incident-");
  try {
    const score: CapabilityTrustScore = {
      domainId: "coding",
      totalExecutions: 100,
      successfulExecutions: 100,
      failedExecutions: 0,
      humanOverrides: 0,
      incidents: 3,
      lastIncidentAgeDays: 10,
      lastIncidentSeverity: "P2",
      currentAutonomy: "suggestion",
    };

    const result = calculateTrustScore(score);
    // Success: 1000, Incident penalty: 3 * 150 = 450
    assert.ok(result < 600, `Expected trust score reduced by incidents, got ${result}`);
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: calculateTrustScore includes volume bonus", () => {
  const ctx = createIntegrationContext("aa-trust-volume-");
  try {
    const score: CapabilityTrustScore = {
      domainId: "coding",
      totalExecutions: 200, // High volume
      successfulExecutions: 190,
      failedExecutions: 10,
      humanOverrides: 0,
      incidents: 0,
      lastIncidentAgeDays: 100,
      lastIncidentSeverity: undefined,
      currentAutonomy: "suggestion",
    };

    const result = calculateTrustScore(score);
    // Volume bonus = min(100, 200/50) = 100
    assert.ok(result > 900, "High volume should provide bonus");
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: calculateTrustScore is bounded 0-1000", () => {
  const ctx = createIntegrationContext("aa-trust-bounds-");
  try {
    // Worst case: many incidents and overrides
    const worstScore: CapabilityTrustScore = {
      domainId: "coding",
      totalExecutions: 1000,
      successfulExecutions: 100,
      failedExecutions: 900,
      humanOverrides: 500,
      incidents: 50,
      lastIncidentAgeDays: 0,
      lastIncidentSeverity: "P0",
      currentAutonomy: "full_auto",
    };

    const result = calculateTrustScore(worstScore);
    assert.ok(result >= 0, "Trust score should be >= 0");
    assert.ok(result <= 1000, "Trust score should be <= 1000");
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// Trust Level Mapping
// ============================================================================

test("TrustScorer: mapTrustLevel returns fully_trusted for score >= 950", () => {
  const ctx = createIntegrationContext("aa-trust-level-trusted-");
  try {
    assert.equal(mapTrustLevel(950), "fully_trusted");
    assert.equal(mapTrustLevel(1000), "fully_trusted");
    assert.equal(mapTrustLevel(999), "fully_trusted");
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: mapTrustLevel returns trusted for score >= 850", () => {
  const ctx = createIntegrationContext("aa-trust-level-trusted2-");
  try {
    assert.equal(mapTrustLevel(850), "trusted");
    assert.equal(mapTrustLevel(949), "trusted");
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: mapTrustLevel returns semi_trusted for score >= 700", () => {
  const ctx = createIntegrationContext("aa-trust-level-semi-");
  try {
    assert.equal(mapTrustLevel(700), "semi_trusted");
    assert.equal(mapTrustLevel(849), "semi_trusted");
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: mapTrustLevel returns supervised for score >= 500", () => {
  const ctx = createIntegrationContext("aa-trust-level-supervised-");
  try {
    assert.equal(mapTrustLevel(500), "supervised");
    assert.equal(mapTrustLevel(699), "supervised");
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: mapTrustLevel returns probation for score >= 300", () => {
  const ctx = createIntegrationContext("aa-trust-level-probation-");
  try {
    assert.equal(mapTrustLevel(300), "probation");
    assert.equal(mapTrustLevel(499), "probation");
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: mapTrustLevel returns untrusted for score < 300", () => {
  const ctx = createIntegrationContext("aa-trust-level-untrusted-");
  try {
    assert.equal(mapTrustLevel(0), "untrusted");
    assert.equal(mapTrustLevel(299), "untrusted");
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// Inherent Risk Check
// ============================================================================

test("TrustScorer: checkInherentRisk returns false for critical riskClass", () => {
  const ctx = createIntegrationContext("aa-risk-critical-");
  try {
    const result = checkInherentRisk({ riskClass: "critical" });
    assert.equal(result, false, "Critical risk should block full auto");
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: checkInherentRisk returns false for high riskClass", () => {
  const ctx = createIntegrationContext("aa-risk-high-");
  try {
    const result = checkInherentRisk({ riskClass: "high" });
    assert.equal(result, false, "High risk should block full auto");
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: checkInherentRisk returns false for high-risk domain", () => {
  const ctx = createIntegrationContext("aa-risk-domain-");
  try {
    const result = checkInherentRisk({ isHighRiskDomain: true });
    assert.equal(result, false, "High-risk domain should block full auto");
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: checkInherentRisk returns false when requiresHumanAccountable", () => {
  const ctx = createIntegrationContext("aa-risk-human-");
  try {
    const result = checkInherentRisk({ requiresHumanAccountable: true });
    assert.equal(result, false, "Human accountable domains should block full auto");
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: checkInherentRisk returns true for low risk class", () => {
  const ctx = createIntegrationContext("aa-risk-low-");
  try {
    const result = checkInherentRisk({ riskClass: "low" });
    assert.equal(result, true, "Low risk should allow full auto");
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: checkInherentRisk returns true for medium risk with no other factors", () => {
  const ctx = createIntegrationContext("aa-risk-medium-");
  try {
    const result = checkInherentRisk({ riskClass: "medium" });
    assert.equal(result, true, "Medium risk should allow full auto");
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// Trust Level to Autonomy Level Mapping
// ============================================================================

test("TrustScorer: mapTrustLevelToAutonomyLevel maps fully_trusted to full_auto", () => {
  const ctx = createIntegrationContext("aa-autonomy-full-");
  try {
    const result = mapTrustLevelToAutonomyLevel("fully_trusted");
    assert.equal(result, "full_auto");
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: mapTrustLevelToAutonomyLevel fully_trusted with risk check downgrades to semi_auto", () => {
  const ctx = createIntegrationContext("aa-autonomy-downgrade-");
  try {
    const result = mapTrustLevelToAutonomyLevel("fully_trusted", {
      riskClass: "high",
    });
    assert.equal(result, "semi_auto", "High risk should downgrade fully_trusted to semi_auto");
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: mapTrustLevelToAutonomyLevel maps trusted to semi_auto", () => {
  const ctx = createIntegrationContext("aa-autonomy-trusted-");
  try {
    const result = mapTrustLevelToAutonomyLevel("trusted");
    assert.equal(result, "semi_auto");
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: mapTrustLevelToAutonomyLevel maps semi_trusted to semi_auto", () => {
  const ctx = createIntegrationContext("aa-autonomy-semi-");
  try {
    const result = mapTrustLevelToAutonomyLevel("semi_trusted");
    assert.equal(result, "semi_auto");
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: mapTrustLevelToAutonomyLevel maps supervised to supervised", () => {
  const ctx = createIntegrationContext("aa-autonomy-super-");
  try {
    const result = mapTrustLevelToAutonomyLevel("supervised");
    assert.equal(result, "supervised");
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: mapTrustLevelToAutonomyLevel maps probation to suggestion", () => {
  const ctx = createIntegrationContext("aa-autonomy-probation-");
  try {
    const result = mapTrustLevelToAutonomyLevel("probation");
    assert.equal(result, "suggestion");
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: mapTrustLevelToAutonomyLevel maps untrusted to suggestion", () => {
  const ctx = createIntegrationContext("aa-autonomy-untrusted-");
  try {
    const result = mapTrustLevelToAutonomyLevel("untrusted");
    assert.equal(result, "suggestion");
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// Trust Decay
// ============================================================================

test("TrustScorer: applyTrustDecay returns original score for zero inactive days", () => {
  const ctx = createIntegrationContext("aa-decay-zero-");
  try {
    const result = applyTrustDecay(800, 0);
    assert.equal(result, 800);
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: applyTrustDecay applies exponential decay", () => {
  const ctx = createIntegrationContext("aa-decay-normal-");
  try {
    const result = applyTrustDecay(1000, 30);
    // Decay rate 0.05, 30 days: 1000 * (0.95)^30 = ~215
    assert.ok(result < 300, "30 days of decay should significantly reduce score");
    assert.ok(result > 0, "Score should not be negative");
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: applyTrustDecay respects custom decay rate", () => {
  const ctx = createIntegrationContext("aa-decay-custom-");
  try {
    const result = applyTrustDecay(1000, 30, 0.1);
    // Decay rate 0.1, 30 days: 1000 * (0.9)^30 = ~42
    assert.ok(result < 100, "Higher decay rate should reduce score more");
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: applyTrustDecay never returns negative", () => {
  const ctx = createIntegrationContext("aa-decay-floor-");
  try {
    const result = applyTrustDecay(100, 365);
    assert.ok(result >= 0, "Decay should never produce negative score");
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// End-to-end Trust Calculation Pipeline
// ============================================================================

test("TrustScorer: full pipeline from score to autonomy level", () => {
  const ctx = createIntegrationContext("aa-pipeline-");
  try {
    const score: CapabilityTrustScore = {
      domainId: "coding",
      totalExecutions: 500,
      successfulExecutions: 490,
      failedExecutions: 10,
      humanOverrides: 2,
      incidents: 0,
      lastIncidentAgeDays: 90,
      lastIncidentSeverity: undefined,
      currentAutonomy: "semi_auto",
    };

    const trustScore = calculateTrustScore(score);
    const trustLevel = mapTrustLevel(trustScore);
    const autonomyLevel = mapTrustLevelToAutonomyLevel(trustLevel);

    assert.ok(trustScore >= 700, "High success rate should yield high trust");
    assert.ok(["fully_trusted", "trusted", "semi_trusted"].includes(trustLevel), "Should be at least semi_trusted");
    assert.ok(["full_auto", "semi_auto"].includes(autonomyLevel), "Should be semi_auto or higher");
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: pipeline with incidents shows trust degradation", () => {
  const ctx = createIntegrationContext("aa-pipeline-incident-");
  try {
    const score: CapabilityTrustScore = {
      domainId: "coding",
      totalExecutions: 500,
      successfulExecutions: 490,
      failedExecutions: 10,
      humanOverrides: 2,
      incidents: 5,
      lastIncidentAgeDays: 10,
      lastIncidentSeverity: "P2",
      currentAutonomy: "semi_auto",
    };

    const trustScore = calculateTrustScore(score);
    const trustLevel = mapTrustLevel(trustScore);
    const autonomyLevel = mapTrustLevelToAutonomyLevel(trustLevel);

    // Incidents should reduce score significantly
    assert.ok(trustScore < 900, "Incidents should reduce trust score");
    // Should still be semi_auto or supervised given recent good performance
    assert.ok(["supervised", "semi_auto"].includes(autonomyLevel), "Recent good performance should maintain level");
  } finally {
    ctx.cleanup();
  }
});

test("TrustScorer: frozen agent has lowest autonomy", () => {
  const ctx = createIntegrationContext("aa-frozen-");
  try {
    const score: CapabilityTrustScore = {
      domainId: "coding",
      totalExecutions: 10,
      successfulExecutions: 1,
      failedExecutions: 9,
      humanOverrides: 10,
      incidents: 5,
      lastIncidentAgeDays: 0,
      lastIncidentSeverity: "P0",
      currentAutonomy: "frozen",
    };

    const trustScore = calculateTrustScore(score);
    const trustLevel = mapTrustLevel(trustScore);

    // P0 incident means should be suggestion level
    assert.ok(trustScore < 300, "Poor score should map to low trust level");
    assert.ok(["probation", "untrusted"].includes(trustLevel), "Should be low trust level");
  } finally {
    ctx.cleanup();
  }
});