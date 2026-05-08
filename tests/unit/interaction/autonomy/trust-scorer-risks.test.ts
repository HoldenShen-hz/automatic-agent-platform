/**
 * Unit tests for trust-scorer functions
 *
 * Tests calculateTrustScore and mapTrustLevel which handle the trust scoring
 * and trust level mapping logic.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateTrustScore,
  mapTrustLevel,
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

// --- mapTrustLevel tests ---

test("mapTrustLevel maps score >= 95 to fully_trusted", () => {
  assert.equal(mapTrustLevel(95), "fully_trusted");
  assert.equal(mapTrustLevel(100), "fully_trusted");
});

test("mapTrustLevel maps score >= 85 and < 95 to trusted", () => {
  assert.equal(mapTrustLevel(85), "trusted");
  assert.equal(mapTrustLevel(94), "trusted");
});

test("mapTrustLevel maps score >= 70 and < 85 to semi_trusted", () => {
  assert.equal(mapTrustLevel(70), "semi_trusted");
  assert.equal(mapTrustLevel(84), "semi_trusted");
});

test("mapTrustLevel maps score >= 50 and < 70 to supervised", () => {
  assert.equal(mapTrustLevel(50), "supervised");
  assert.equal(mapTrustLevel(69), "supervised");
});

test("mapTrustLevel maps score >= 30 and < 50 to probation", () => {
  assert.equal(mapTrustLevel(30), "probation");
  assert.equal(mapTrustLevel(49), "probation");
});

test("mapTrustLevel maps score < 30 to untrusted", () => {
  assert.equal(mapTrustLevel(0), "untrusted");
  assert.equal(mapTrustLevel(29), "untrusted");
});
