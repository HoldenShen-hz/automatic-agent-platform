import assert from "node:assert/strict";
import test from "node:test";

import {
  checkInherentRisk,
  mapTrustLevelToAutonomyLevel,
  applyTrustDecay,
} from "../../../../src/interaction/autonomy/trust-scorer/index.js";
import type { TrustLevel } from "../../../../src/interaction/autonomy/index.js";

test("checkInherentRisk returns true when no risk factors present", () => {
  assert.equal(checkInherentRisk({}), true);
});

test("checkInherentRisk returns false for critical risk class", () => {
  assert.equal(checkInherentRisk({ riskClass: "critical" }), false);
});

test("checkInherentRisk returns false for high risk class", () => {
  assert.equal(checkInherentRisk({ riskClass: "high" }), false);
});

test("checkInherentRisk returns false for high-risk domain", () => {
  assert.equal(checkInherentRisk({ isHighRiskDomain: true }), false);
});

test("checkInherentRisk returns false when human accountable required", () => {
  assert.equal(checkInherentRisk({ requiresHumanAccountable: true }), false);
});

test("checkInherentRisk returns true for low risk class with no other factors", () => {
  assert.equal(checkInherentRisk({ riskClass: "low" }), true);
});

test("checkInherentRisk returns true for medium risk class with no other factors", () => {
  assert.equal(checkInherentRisk({ riskClass: "medium" }), true);
});

test("checkInherentRisk combines multiple risk factors", () => {
  // low + not high risk domain + not human accountable = true
  assert.equal(checkInherentRisk({ riskClass: "low", isHighRiskDomain: false, requiresHumanAccountable: false }), true);
  // low + high risk domain = false
  assert.equal(checkInherentRisk({ riskClass: "low", isHighRiskDomain: true }), false);
  // medium + human accountable = false
  assert.equal(checkInherentRisk({ riskClass: "medium", requiresHumanAccountable: true }), false);
});

test("mapTrustLevelToAutonomyLevel maps fully_trusted to full_auto without risk", () => {
  assert.equal(mapTrustLevelToAutonomyLevel("fully_trusted"), "full_auto");
});

test("mapTrustLevelToAutonomyLevel maps fully_trusted to semi_auto when inherent risk present", () => {
  assert.equal(mapTrustLevelToAutonomyLevel("fully_trusted", { riskClass: "high" }), "semi_auto");
  assert.equal(mapTrustLevelToAutonomyLevel("fully_trusted", { isHighRiskDomain: true }), "semi_auto");
  assert.equal(mapTrustLevelToAutonomyLevel("fully_trusted", { requiresHumanAccountable: true }), "semi_auto");
  assert.equal(mapTrustLevelToAutonomyLevel("fully_trusted", { riskClass: "critical" }), "semi_auto");
});

test("mapTrustLevelToAutonomyLevel maps trusted to semi_auto", () => {
  assert.equal(mapTrustLevelToAutonomyLevel("trusted"), "semi_auto");
});

test("mapTrustLevelToAutonomyLevel maps semi_trusted to semi_auto", () => {
  assert.equal(mapTrustLevelToAutonomyLevel("semi_trusted"), "semi_auto");
});

test("mapTrustLevelToAutonomyLevel maps supervised to supervised", () => {
  assert.equal(mapTrustLevelToAutonomyLevel("supervised"), "supervised");
});

test("mapTrustLevelToAutonomyLevel maps probation to suggestion", () => {
  assert.equal(mapTrustLevelToAutonomyLevel("probation"), "suggestion");
});

test("mapTrustLevelToAutonomyLevel maps untrusted to suggestion", () => {
  assert.equal(mapTrustLevelToAutonomyLevel("untrusted"), "suggestion");
});

test("mapTrustLevelToAutonomyLevel handles unknown trust levels as suggestion", () => {
  // Default case in switch
  assert.equal(mapTrustLevelToAutonomyLevel("untrusted"), "suggestion");
});

test("applyTrustDecay returns original score when inactiveDays is 0", () => {
  assert.equal(applyTrustDecay(500, 0), 500);
});

test("applyTrustDecay returns original score when inactiveDays is negative", () => {
  assert.equal(applyTrustDecay(500, -10), 500);
});

test("applyTrustDecay applies decay correctly for positive inactiveDays", () => {
  // Score 1000 with 1 day at 5% rate: 1000 * (1-0.05)^1 = 950
  const result = applyTrustDecay(1000, 1, 0.05);
  assert.equal(result, 950);
});

test("applyTrustDecay applies decay compounding over multiple days", () => {
  // Score 1000 with 10 days at 5% rate: 1000 * (0.95)^10 ≈ 598.7
  const result = applyTrustDecay(1000, 10, 0.05);
  assert.equal(result, 599);
});

test("applyTrustDecay floors at 0", () => {
  // Large inactive days should floor at 0
  const result = applyTrustDecay(100, 1000, 0.5);
  assert.equal(result, 0);
});

test("applyTrustDecay uses custom decay rate", () => {
  // Score 1000 with 1 day at 10% rate: 1000 * 0.9 = 900
  const result = applyTrustDecay(1000, 1, 0.1);
  assert.equal(result, 900);
});

test("applyTrustDecay handles small scores", () => {
  const result = applyTrustDecay(10, 5, 0.05);
  assert.ok(result >= 0);
  assert.ok(result <= 10);
});

test("applyTrustDecay with default rate of 0.05", () => {
  // Score 1000 with 1 day at default 5% rate
  const result = applyTrustDecay(1000, 1);
  assert.equal(result, 950);
});