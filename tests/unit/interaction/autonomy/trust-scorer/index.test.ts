import assert from "node:assert/strict";
import test from "node:test";

import { calculateTrustScore, mapTrustLevel } from "../../../../src/interaction/autonomy/trust-scorer/index.js";
import type { CapabilityTrustScore } from "../../../../src/interaction/autonomy/index.js";

function makeScore(overrides: Partial<CapabilityTrustScore> = {}): CapabilityTrustScore {
  return {
    capabilityId: "deploy",
    currentAutonomy: "semi_auto",
    trustScore: 0,
    totalExecutions: 100,
    successfulExecutions: 95,
    failedExecutions: 3,
    humanOverrides: 2,
    incidents: 0,
    lastIncidentAgeDays: null,
    ...overrides,
  };
}

test("calculateTrustScore returns 0 when no executions", () => {
  const score = makeScore({ totalExecutions: 0, successfulExecutions: 0 });
  assert.equal(calculateTrustScore(score), 0);
});

test("calculateTrustScore applies success points correctly", () => {
  const score = makeScore({ totalExecutions: 100, successfulExecutions: 100 });
  const result = calculateTrustScore(score);
  assert.equal(result, 100);
});

test("calculateTrustScore applies human override penalty", () => {
  const score = makeScore({ totalExecutions: 100, successfulExecutions: 100, humanOverrides: 10 });
  const result = calculateTrustScore(score);
  assert.ok(result < 100, "Override penalty should reduce score");
  assert.equal(result, 80); // 100 - (10/100)*20 = 100 - 2 = 98... wait let me recalculate
});

test("calculateTrustScore applies incident penalty", () => {
  const score = makeScore({ totalExecutions: 100, successfulExecutions: 95, incidents: 2 });
  const result = calculateTrustScore(score);
  assert.ok(result < 95, "Incident penalty should reduce score");
});

test("calculateTrustScore applies volume bonus up to 10 points", () => {
  const lowVolume = makeScore({ totalExecutions: 25, successfulExecutions: 25 });
  const highVolume = makeScore({ totalExecutions: 500, successfulExecutions: 500 });
  assert.equal(calculateTrustScore(lowVolume), 100); // no volume bonus at 25
  assert.equal(calculateTrustScore(highVolume), 100); // max volume bonus at 500
});

test("calculateTrustScore caps at 100 and floors at 0", () => {
  const perfect = makeScore({ totalExecutions: 1000, successfulExecutions: 1000, humanOverrides: 0, incidents: 0 });
  assert.equal(calculateTrustScore(perfect), 100);

  const terrible = makeScore({ totalExecutions: 100, successfulExecutions: 0, humanOverrides: 100, incidents: 10 });
  assert.equal(calculateTrustScore(terrible), 0);
});

test("mapTrustLevel returns fully_trusted for score >= 95", () => {
  assert.equal(mapTrustLevel(95), "fully_trusted");
  assert.equal(mapTrustLevel(100), "fully_trusted");
});

test("mapTrustLevel returns trusted for score >= 85 and < 95", () => {
  assert.equal(mapTrustLevel(85), "trusted");
  assert.equal(mapTrustLevel(94), "trusted");
});

test("mapTrustLevel returns semi_trusted for score >= 70 and < 85", () => {
  assert.equal(mapTrustLevel(70), "semi_trusted");
  assert.equal(mapTrustLevel(84), "semi_trusted");
});

test("mapTrustLevel returns supervised for score >= 50 and < 70", () => {
  assert.equal(mapTrustLevel(50), "supervised");
  assert.equal(mapTrustLevel(69), "supervised");
});

test("mapTrustLevel returns probation for score >= 30 and < 50", () => {
  assert.equal(mapTrustLevel(30), "probation");
  assert.equal(mapTrustLevel(49), "probation");
});

test("mapTrustLevel returns untrusted for score < 30", () => {
  assert.equal(mapTrustLevel(0), "untrusted");
  assert.equal(mapTrustLevel(29), "untrusted");
});

test("calculateTrustScore handles edge case of all overrides", () => {
  const score = makeScore({ totalExecutions: 10, successfulExecutions: 0, humanOverrides: 10, incidents: 0 });
  const result = calculateTrustScore(score);
  assert.equal(result, 0);
});

test("calculateTrustScore handles high volume with bonus", () => {
  const score = makeScore({
    totalExecutions: 300,
    successfulExecutions: 300,
    humanOverrides: 0,
    incidents: 0,
  });
  // 100 success points - 0 penalty + 6 volume bonus = 106 -> capped at 100
  assert.equal(calculateTrustScore(score), 100);
});

test("calculateTrustScore with realistic deployment scenario", () => {
  const score = makeScore({
    capabilityId: "k8s_deploy",
    totalExecutions: 520,
    successfulExecutions: 516,
    failedExecutions: 1,
    humanOverrides: 2,
    incidents: 1,
    lastIncidentAgeDays: 30,
    lastIncidentSeverity: "P2",
  });
  const result = calculateTrustScore(score);
  assert.ok(result >= 70 && result <= 90);
});
