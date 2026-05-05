/**
 * Unit tests for trust-scorer risk functions
 *
 * Tests checkInherentRisk and mapTrustLevelToAutonomyLevel which handle
 * the R1-10 inherent risk check before mapping trust level to autonomy level.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateTrustScore,
  checkInherentRisk,
  mapTrustLevel,
  mapTrustLevelToAutonomyLevel,
} from "../../../../src/interaction/autonomy/trust-scorer/index.js";
import type { CapabilityTrustScore } from "../../../../src/interaction/autonomy/index.js";

function makeScore(overrides: Partial<CapabilityTrustScore> = {}): CapabilityTrustScore {
  return {
    capabilityId: "test-capability",
    currentAutonomy: "suggestion",
    trustScore: 0,
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    humanOverrides: 0,
    incidents: 0,
    lastIncidentAgeDays: null,
    ...overrides,
  };
}

// --- checkInherentRisk tests ---

test("checkInherentRisk returns false for critical risk class", () => {
  const result = checkInherentRisk({ riskClass: "critical" });
  assert.equal(result, false);
});

test("checkInherentRisk returns false for high risk class", () => {
  const result = checkInherentRisk({ riskClass: "high" });
  assert.equal(result, false);
});

test("checkInherentRisk returns false when isHighRiskDomain is true", () => {
  const result = checkInherentRisk({ isHighRiskDomain: true });
  assert.equal(result, false);
});

test("checkInherentRisk returns false when requiresHumanAccountable is true", () => {
  const result = checkInherentRisk({ requiresHumanAccountable: true });
  assert.equal(result, false);
});

test("checkInherentRisk returns true for low risk with no additional flags", () => {
  const result = checkInherentRisk({ riskClass: "low" });
  assert.equal(result, true);
});

test("checkInherentRisk returns true for medium risk without other flags", () => {
  const result = checkInherentRisk({ riskClass: "medium" });
  assert.equal(result, true);
});

test("checkInherentRisk returns true when only domainId is provided", () => {
  const result = checkInherentRisk({ domainId: "some-domain" });
  assert.equal(result, true);
});

test("checkInherentRisk returns false for high risk class even with domainId", () => {
  const result = checkInherentRisk({ riskClass: "high", domainId: "some-domain" });
  assert.equal(result, false);
});

test("checkInherentRisk returns false when multiple safe conditions exist but one is critical", () => {
  // Critical overrides other safe conditions
  const result = checkInherentRisk({
    riskClass: "critical",
    isHighRiskDomain: false,
    requiresHumanAccountable: false,
  });
  assert.equal(result, false);
});

// --- mapTrustLevelToAutonomyLevel tests ---

test("mapTrustLevelToAutonomyLevel maps fully_trusted to full_auto when no inherent risk", () => {
  const result = mapTrustLevelToAutonomyLevel("fully_trusted");
  assert.equal(result, "full_auto");
});

test("mapTrustLevelToAutonomyLevel maps fully_trusted to semi_auto when critical risk class", () => {
  const result = mapTrustLevelToAutonomyLevel("fully_trusted", { riskClass: "critical" });
  assert.equal(result, "semi_auto");
});

test("mapTrustLevelToAutonomyLevel maps fully_trusted to semi_auto when high risk class", () => {
  const result = mapTrustLevelToAutonomyLevel("fully_trusted", { riskClass: "high" });
  assert.equal(result, "semi_auto");
});

test("mapTrustLevelToAutonomyLevel maps fully_trusted to semi_auto when isHighRiskDomain", () => {
  const result = mapTrustLevelToAutonomyLevel("fully_trusted", { isHighRiskDomain: true });
  assert.equal(result, "semi_auto");
});

test("mapTrustLevelToAutonomyLevel maps fully_trusted to semi_auto when requiresHumanAccountable", () => {
  const result = mapTrustLevelToAutonomyLevel("fully_trusted", { requiresHumanAccountable: true });
  assert.equal(result, "semi_auto");
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

test("mapTrustLevelToAutonomyLevel handles fully_trusted with empty options object", () => {
  // Empty object means no risk flags set
  const result = mapTrustLevelToAutonomyLevel("fully_trusted", {});
  assert.equal(result, "full_auto");
});

test("mapTrustLevelToAutonomyLevel handles fully_trusted with null options", () => {
  const result = mapTrustLevelToAutonomyLevel("fully_trusted", null as never);
  assert.equal(result, "full_auto");
});

// --- calculateTrustScore base 0-100 range tests ---

test("calculateTrustScore returns 0 for no executions", () => {
  const score = makeScore({ totalExecutions: 0, successfulExecutions: 0 });
  assert.equal(calculateTrustScore(score), 0);
});

test("calculateTrustScore returns 0 when totalExecutions is 0 even with other fields", () => {
  const score = makeScore({
    totalExecutions: 0,
    successfulExecutions: 100,
    humanOverrides: 5,
    incidents: 2,
  });
  assert.equal(calculateTrustScore(score), 0);
});

test("calculateTrustScore applies success points on the 0-100 scale", () => {
  const score = makeScore({
    totalExecutions: 100,
    successfulExecutions: 50,
    humanOverrides: 0,
    incidents: 0,
  });
  const result = calculateTrustScore(score);
  // 50 success points + 2 volume bonus = 52
  assert.equal(result, 52);
});

test("calculateTrustScore applies override penalty on the 0-100 scale", () => {
  const score = makeScore({
    totalExecutions: 100,
    successfulExecutions: 100,
    humanOverrides: 5,
    incidents: 0,
  });
  const result = calculateTrustScore(score);
  // 100 - 1 + 2 = 100 after clamping
  assert.equal(result, 100);
});

test("calculateTrustScore applies incident penalty on the 0-100 scale", () => {
  const score = makeScore({
    totalExecutions: 100,
    successfulExecutions: 100,
    humanOverrides: 0,
    incidents: 2,
  });
  const result = calculateTrustScore(score);
  // 100 - 30 + 2 = 72
  assert.equal(result, 72);
});

test("calculateTrustScore applies volume bonus up to 10 points", () => {
  const score = makeScore({
    totalExecutions: 500,
    successfulExecutions: 500,
    humanOverrides: 0,
    incidents: 0,
  });
  const result = calculateTrustScore(score);
  // 100 + 10 = 110, capped at 100
  assert.equal(result, 100);
});

test("calculateTrustScore never returns negative", () => {
  const score = makeScore({
    totalExecutions: 50,
    successfulExecutions: 5,
    humanOverrides: 30,
    incidents: 10,
  });
  const result = calculateTrustScore(score);
  assert.ok(result >= 0);
});

test("calculateTrustScore handles large volumes correctly", () => {
  const score = makeScore({
    totalExecutions: 1000,
    successfulExecutions: 950,
    humanOverrides: 10,
    incidents: 3,
  });
  const result = calculateTrustScore(score);
  // 95 - 0.2 - 45 + 10 = 59.8 => 60
  assert.equal(result, 60);
});
