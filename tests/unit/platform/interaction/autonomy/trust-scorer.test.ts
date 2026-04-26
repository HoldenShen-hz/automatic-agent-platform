import test from "node:test";
import { strict as assert } from "node:assert/strict";
import {
  calculateTrustScore,
  mapTrustLevel,
} from "../../../../../src/interaction/autonomy/trust-scorer/index.js";
import type { CapabilityTrustScore } from "../../../../../src/interaction/autonomy/index.js";

function mockTrustScore(overrides: Partial<CapabilityTrustScore> = {}): CapabilityTrustScore {
  return {
    capabilityId: "test-capability",
    currentAutonomy: "supervised",
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

test("calculateTrustScore returns 0 for zero executions", () => {
  const score = mockTrustScore({ totalExecutions: 0 });
  assert.strictEqual(calculateTrustScore(score), 0);
});

test("calculateTrustScore perfect success rate yields high score", () => {
  const score = mockTrustScore({ totalExecutions: 100, successfulExecutions: 100, humanOverrides: 0, incidents: 0 });
  const result = calculateTrustScore(score);
  assert.ok(result >= 90);
});

test("calculateTrustScore human overrides apply penalty", () => {
  const scoreWithOverrides = mockTrustScore({ totalExecutions: 10, successfulExecutions: 10, humanOverrides: 5, incidents: 0 });
  const scoreWithoutOverrides = mockTrustScore({ totalExecutions: 10, successfulExecutions: 10, humanOverrides: 0, incidents: 0 });
  assert.ok(calculateTrustScore(scoreWithOverrides) < calculateTrustScore(scoreWithoutOverrides));
});

test("calculateTrustScore incidents apply penalty", () => {
  const scoreWithIncidents = mockTrustScore({ totalExecutions: 100, successfulExecutions: 95, humanOverrides: 0, incidents: 3 });
  const scoreWithoutIncidents = mockTrustScore({ totalExecutions: 100, successfulExecutions: 95, humanOverrides: 0, incidents: 0 });
  assert.ok(calculateTrustScore(scoreWithIncidents) < calculateTrustScore(scoreWithoutIncidents));
});

test("calculateTrustScore volume bonus up to 10 points", () => {
  const lowVolume = mockTrustScore({ totalExecutions: 20, successfulExecutions: 18, humanOverrides: 0, incidents: 0 });
  const highVolume = mockTrustScore({ totalExecutions: 200, successfulExecutions: 180, humanOverrides: 0, incidents: 0 });
  assert.ok(calculateTrustScore(highVolume) > calculateTrustScore(lowVolume));
});

test("calculateTrustScore caps at 100", () => {
  const score = mockTrustScore({ totalExecutions: 1000, successfulExecutions: 1000, humanOverrides: 0, incidents: 0 });
  const result = calculateTrustScore(score);
  assert.ok(result <= 100);
});

test("calculateTrustScore minimum is 0", () => {
  const score = mockTrustScore({ totalExecutions: 100, successfulExecutions: 0, humanOverrides: 50, incidents: 10 });
  const result = calculateTrustScore(score);
  assert.ok(result >= 0);
});

test("mapTrustLevel returns fully_trusted for 95+", () => {
  assert.strictEqual(mapTrustLevel(95), "fully_trusted");
  assert.strictEqual(mapTrustLevel(100), "fully_trusted");
});

test("mapTrustLevel returns trusted for 85-94", () => {
  assert.strictEqual(mapTrustLevel(85), "trusted");
  assert.strictEqual(mapTrustLevel(94), "trusted");
});

test("mapTrustLevel returns semi_trusted for 70-84", () => {
  assert.strictEqual(mapTrustLevel(70), "semi_trusted");
  assert.strictEqual(mapTrustLevel(84), "semi_trusted");
});

test("mapTrustLevel returns supervised for 50-69", () => {
  assert.strictEqual(mapTrustLevel(50), "supervised");
  assert.strictEqual(mapTrustLevel(69), "supervised");
});

test("mapTrustLevel returns probation for 30-49", () => {
  assert.strictEqual(mapTrustLevel(30), "probation");
  assert.strictEqual(mapTrustLevel(49), "probation");
});

test("mapTrustLevel returns untrusted for below 30", () => {
  assert.strictEqual(mapTrustLevel(0), "untrusted");
  assert.strictEqual(mapTrustLevel(29), "untrusted");
});

test("calculateTrustScore with failed executions reduces score", () => {
  const score = mockTrustScore({ totalExecutions: 100, successfulExecutions: 80, failedExecutions: 20, humanOverrides: 0, incidents: 0 });
  const result = calculateTrustScore(score);
  assert.ok(result < 85);
});

test("mapTrustLevel boundary at 95 exactly", () => {
  assert.strictEqual(mapTrustLevel(94), "trusted");
  assert.strictEqual(mapTrustLevel(95), "fully_trusted");
});

test("mapTrustLevel boundary at 85 exactly", () => {
  assert.strictEqual(mapTrustLevel(84), "semi_trusted");
  assert.strictEqual(mapTrustLevel(85), "trusted");
});

test("mapTrustLevel boundary at 70 exactly", () => {
  assert.strictEqual(mapTrustLevel(69), "supervised");
  assert.strictEqual(mapTrustLevel(70), "semi_trusted");
});

test("mapTrustLevel boundary at 50 exactly", () => {
  assert.strictEqual(mapTrustLevel(49), "probation");
  assert.strictEqual(mapTrustLevel(50), "supervised");
});

test("mapTrustLevel boundary at 30 exactly", () => {
  assert.strictEqual(mapTrustLevel(29), "untrusted");
  assert.strictEqual(mapTrustLevel(30), "probation");
});

test("calculateTrustScore different override rates affect score", () => {
  const lowOverrides = mockTrustScore({ totalExecutions: 10, successfulExecutions: 10, humanOverrides: 1 });
  const highOverrides = mockTrustScore({ totalExecutions: 10, successfulExecutions: 10, humanOverrides: 5 });
  assert.ok(calculateTrustScore(lowOverrides) > calculateTrustScore(highOverrides));
});

test("calculateTrustScore execution count affects bonus", () => {
  const lowExec = mockTrustScore({ totalExecutions: 50, successfulExecutions: 45, humanOverrides: 0, incidents: 0 });
  const highExec = mockTrustScore({ totalExecutions: 500, successfulExecutions: 450, humanOverrides: 0, incidents: 0 });
  assert.ok(calculateTrustScore(highExec) > calculateTrustScore(lowExec));
});
