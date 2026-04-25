import assert from "node:assert/strict";
import test from "node:test";

import { calculateTrustScore, mapTrustLevel } from "../../../../src/interaction/autonomy/trust-scorer/index.js";
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

test("calculateTrustScore returns 0 when no executions", () => {
  const score = makeScore({ totalExecutions: 0, successfulExecutions: 0 });
  assert.equal(calculateTrustScore(score), 0);
});

test("calculateTrustScore returns 100 for perfect execution record", () => {
  const score = makeScore({ totalExecutions: 100, successfulExecutions: 100, humanOverrides: 0, incidents: 0 });
  const result = calculateTrustScore(score);
  assert.equal(result, 100);
});

test("calculateTrustScore applies override penalty", () => {
  // 50% success rate = 50 points, 5 human overrides out of 100 = 1 point penalty
  const score = makeScore({ totalExecutions: 100, successfulExecutions: 50, humanOverrides: 5, incidents: 0 });
  const result = calculateTrustScore(score);
  // 50 - 1 + 2 (volume bonus) = 51
  assert.equal(result, 51);
});

test("calculateTrustScore applies incident penalty", () => {
  // 100% success = 100 points, 2 incidents * 15 = 30 penalty, volume bonus = 2
  const score = makeScore({ totalExecutions: 100, successfulExecutions: 100, humanOverrides: 0, incidents: 2 });
  const result = calculateTrustScore(score);
  // 100 - 0 - 30 + 2 = 72
  assert.equal(result, 72);
});

test("calculateTrustScore caps at 100", () => {
  // High volume with perfect record should cap at 100
  const score = makeScore({ totalExecutions: 500, successfulExecutions: 500, humanOverrides: 0, incidents: 0 });
  const result = calculateTrustScore(score);
  // 100 points + 10 volume bonus = 110, capped to 100
  assert.equal(result, 100);
});

test("calculateTrustScore returns at least 0", () => {
  // Many incidents should not push below 0
  const score = makeScore({ totalExecutions: 50, successfulExecutions: 10, humanOverrides: 20, incidents: 10 });
  const result = calculateTrustScore(score);
  assert.ok(result >= 0);
});

test("calculateTrustScore applies volume bonus", () => {
  // 100 executions = 2 volume bonus points
  const score1 = makeScore({ totalExecutions: 100, successfulExecutions: 80, humanOverrides: 0, incidents: 0 });
  const score2 = makeScore({ totalExecutions: 50, successfulExecutions: 40, humanOverrides: 0, incidents: 0 });
  const result1 = calculateTrustScore(score1);
  const result2 = calculateTrustScore(score2);
  // Score1 should have higher volume bonus (2 vs 1)
  assert.ok(result1 > result2);
});

test("mapTrustLevel returns fully_trusted for score >= 95", () => {
  assert.equal(mapTrustLevel(95), "fully_trusted");
  assert.equal(mapTrustLevel(100), "fully_trusted");
});

test("mapTrustLevel returns trusted for score >= 85", () => {
  assert.equal(mapTrustLevel(85), "trusted");
  assert.equal(mapTrustLevel(94), "trusted");
});

test("mapTrustLevel returns semi_trusted for score >= 70", () => {
  assert.equal(mapTrustLevel(70), "semi_trusted");
  assert.equal(mapTrustLevel(84), "semi_trusted");
});

test("mapTrustLevel returns supervised for score >= 50", () => {
  assert.equal(mapTrustLevel(50), "supervised");
  assert.equal(mapTrustLevel(69), "supervised");
});

test("mapTrustLevel returns probation for score >= 30", () => {
  assert.equal(mapTrustLevel(30), "probation");
  assert.equal(mapTrustLevel(49), "probation");
});

test("mapTrustLevel returns untrusted for score < 30", () => {
  assert.equal(mapTrustLevel(0), "untrusted");
  assert.equal(mapTrustLevel(29), "untrusted");
});

test("calculateTrustScore handles boundary case for exact 50 executions", () => {
  const score = makeScore({ totalExecutions: 50, successfulExecutions: 50, humanOverrides: 0, incidents: 0 });
  const result = calculateTrustScore(score);
  // 100 + 1 volume = 101, capped at 100
  assert.equal(result, 100);
});

test("calculateTrustScore works with minimal executions", () => {
  const score = makeScore({ totalExecutions: 1, successfulExecutions: 1, humanOverrides: 0, incidents: 0 });
  const result = calculateTrustScore(score);
  // 100 success points, 0 penalty, 0 volume bonus = 100
  assert.equal(result, 100);
});

test("calculateTrustScore with high override rate approaches 0", () => {
  const score = makeScore({ totalExecutions: 100, successfulExecutions: 50, humanOverrides: 100, incidents: 0 });
  const result = calculateTrustScore(score);
  // successPoints = 50, overridePenalty = 20, volumeBonus = 2
  // 50 - 20 + 2 = 32
  assert.equal(result, 32);
});

test("calculateTrustScore with all overrides goes to 0 or above", () => {
  const score = makeScore({ totalExecutions: 50, successfulExecutions: 25, humanOverrides: 50, incidents: 0 });
  const result = calculateTrustScore(score);
  // successPoints = 50, overridePenalty = 20, volumeBonus = 1
  // 50 - 20 + 1 = 31
  assert.ok(result >= 0);
});

test("calculateTrustScore with many incidents floors at 0", () => {
  const score = makeScore({ totalExecutions: 100, successfulExecutions: 100, humanOverrides: 0, incidents: 10 });
  const result = calculateTrustScore(score);
  // 100 - 0 - 150 + 2 = -48, floored at 0
  assert.equal(result, 0);
});

test("calculateTrustScore volume bonus maxes at 10", () => {
  const score = makeScore({ totalExecutions: 1000, successfulExecutions: 900, humanOverrides: 0, incidents: 0 });
  const result = calculateTrustScore(score);
  // 90 successPoints + 10 volume bonus = 100
  assert.equal(result, 100);
});

test("calculateTrustScore volume bonus increments every 50 executions", () => {
  const score0 = makeScore({ totalExecutions: 0, successfulExecutions: 0, humanOverrides: 0, incidents: 0 });
  const score49 = makeScore({ totalExecutions: 49, successfulExecutions: 49, humanOverrides: 0, incidents: 0 });
  const score50 = makeScore({ totalExecutions: 50, successfulExecutions: 50, humanOverrides: 0, incidents: 0 });
  const score99 = makeScore({ totalExecutions: 99, successfulExecutions: 99, humanOverrides: 0, incidents: 0 });
  const score100 = makeScore({ totalExecutions: 100, successfulExecutions: 100, humanOverrides: 0, incidents: 0 });

  assert.equal(calculateTrustScore(score0), 0);
  // floor(49/50) = 0 volume bonus
  assert.equal(calculateTrustScore(score49), 100);
  // floor(50/50) = 1 volume bonus, but capped at 100
  assert.equal(calculateTrustScore(score50), 100);
  assert.equal(calculateTrustScore(score99), 100);
  assert.equal(calculateTrustScore(score100), 100);
});

test("mapTrustLevel boundary at exactly 95 is fully_trusted", () => {
  assert.equal(mapTrustLevel(95), "fully_trusted");
});

test("mapTrustLevel boundary at exactly 85 is trusted", () => {
  assert.equal(mapTrustLevel(85), "trusted");
});

test("mapTrustLevel boundary at exactly 70 is semi_trusted", () => {
  assert.equal(mapTrustLevel(70), "semi_trusted");
});

test("mapTrustLevel boundary at exactly 50 is supervised", () => {
  assert.equal(mapTrustLevel(50), "supervised");
});

test("mapTrustLevel boundary at exactly 30 is probation", () => {
  assert.equal(mapTrustLevel(30), "probation");
});

test("mapTrustLevel boundary at 29 is untrusted", () => {
  assert.equal(mapTrustLevel(29), "untrusted");
});

test("calculateTrustScore with 0 successful executions but some overrides", () => {
  const score = makeScore({ totalExecutions: 50, successfulExecutions: 0, humanOverrides: 25, incidents: 0 });
  const result = calculateTrustScore(score);
  // successPoints = 0, overridePenalty = 10, volumeBonus = 1
  // 0 - 10 + 1 = -9, floored at 0
  assert.equal(result, 0);
});

test("calculateTrustScore mixed execution results", () => {
  const score = makeScore({ totalExecutions: 100, successfulExecutions: 75, failedExecutions: 25, humanOverrides: 5, incidents: 1 });
  const result = calculateTrustScore(score);
  // successPoints = 75, overridePenalty = 1, incidentPenalty = 15, volumeBonus = 2
  // 75 - 1 - 15 + 2 = 61
  assert.equal(result, 61);
});

test("mapTrustLevel negative score returns untrusted", () => {
  // Although calculateTrustScore never returns negative, mapTrustLevel should handle any number
  assert.equal(mapTrustLevel(-10), "untrusted");
});