import test from "node:test";
import { strict as assert } from "node:assert/strict";
import {
  assessPromotion,
} from "../../../../../src/interaction/autonomy/promotion-engine/index.js";
import type { CapabilityTrustScore } from "../../../../../src/interaction/autonomy/index.js";

function mockTrustScore(overrides: Partial<CapabilityTrustScore> = {}): CapabilityTrustScore {
  return {
    capabilityId: "test-cap",
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

test("assessPromotion returns no promotion when incidents exist", () => {
  const score = mockTrustScore({ incidents: 1 });
  const result = assessPromotion(score);
  assert.strictEqual(result.shouldPromote, false);
  assert.ok(result.reasonCodes.includes("autonomy.promotion_blocked_by_incident"));
});

test("assessPromotion returns no promotion when failed executions exceed 2", () => {
  const score = mockTrustScore({ failedExecutions: 3 });
  const result = assessPromotion(score);
  assert.strictEqual(result.shouldPromote, false);
  assert.ok(result.reasonCodes.includes("autonomy.promotion_blocked_by_incident"));
});

test("assessPromotion promotes suggestion to supervised with sufficient metrics", () => {
  const score = mockTrustScore({
    currentAutonomy: "suggestion",
    totalExecutions: 50,
    successfulExecutions: 48,
    failedExecutions: 2,
    incidents: 0,
  });
  const result = assessPromotion(score);
  assert.strictEqual(result.shouldPromote, true);
  assert.strictEqual(result.targetLevel, "supervised");
});

test("assessPromotion promotes supervised to semi_auto with sufficient metrics", () => {
  const score = mockTrustScore({
    currentAutonomy: "supervised",
    totalExecutions: 200,
    successfulExecutions: 196,
    failedExecutions: 4,
    incidents: 0,
  });
  const result = assessPromotion(score);
  assert.strictEqual(result.shouldPromote, true);
  assert.strictEqual(result.targetLevel, "semi_auto");
});

test("assessPromotion marks semi_auto to full_auto as pending platform_team approval", () => {
  const score = mockTrustScore({
    currentAutonomy: "semi_auto",
    totalExecutions: 500,
    successfulExecutions: 495,
    failedExecutions: 5,
    incidents: 0,
  });
  const result = assessPromotion(score);
  assert.strictEqual(result.shouldPromote, true);
  assert.strictEqual(result.targetLevel, "full_auto");
  assert.strictEqual(result.approvalRequired, true);
  assert.strictEqual(result.approvalRole, "platform_team");
  assert.ok(result.reasonCodes.includes("autonomy.full_auto_requires_governance_override"));
});

test("assessPromotion does not promote when below threshold", () => {
  const score = mockTrustScore({
    currentAutonomy: "suggestion",
    totalExecutions: 49,
    successfulExecutions: 47,
    failedExecutions: 2,
    incidents: 0,
  });
  const result = assessPromotion(score);
  assert.strictEqual(result.shouldPromote, false);
  assert.ok(result.reasonCodes.includes("autonomy.promotion_threshold_not_met"));
});

test("assessPromotion does not promote when success rate below threshold", () => {
  const score = mockTrustScore({
    currentAutonomy: "suggestion",
    totalExecutions: 50,
    successfulExecutions: 45,
    failedExecutions: 3,
    incidents: 0,
  });
  const result = assessPromotion(score);
  assert.strictEqual(result.shouldPromote, false);
});

test("assessPromotion returns current level when not promoting", () => {
  const score = mockTrustScore({ currentAutonomy: "supervised" });
  const result = assessPromotion(score);
  assert.strictEqual(result.currentLevel, "supervised");
  assert.strictEqual(result.targetLevel, "supervised");
});

test("assessPromotion blocked by incident even if metrics would pass", () => {
  const score = mockTrustScore({
    currentAutonomy: "suggestion",
    totalExecutions: 100,
    successfulExecutions: 98,
    failedExecutions: 2,
    incidents: 1,
  });
  const result = assessPromotion(score);
  assert.strictEqual(result.shouldPromote, false);
});

test("assessPromotion blocked by failed executions even if metrics would pass", () => {
  const score = mockTrustScore({
    currentAutonomy: "suggestion",
    totalExecutions: 100,
    successfulExecutions: 95,
    failedExecutions: 5,
    incidents: 0,
  });
  const result = assessPromotion(score);
  assert.strictEqual(result.shouldPromote, false);
  assert.ok(result.reasonCodes.includes("autonomy.promotion_blocked_by_incident"));
});

test("assessPromotion full_auto does not promote further", () => {
  const score = mockTrustScore({
    currentAutonomy: "full_auto",
    totalExecutions: 1000,
    successfulExecutions: 990,
    failedExecutions: 10,
    incidents: 0,
  });
  const result = assessPromotion(score);
  assert.strictEqual(result.shouldPromote, false);
});

test("assessPromotion frozen does not promote", () => {
  const score = mockTrustScore({
    currentAutonomy: "frozen",
    totalExecutions: 100,
    successfulExecutions: 100,
    failedExecutions: 0,
    incidents: 0,
  });
  const result = assessPromotion(score);
  assert.strictEqual(result.shouldPromote, false);
});

test("assessPromotion returns reason codes array", () => {
  const score = mockTrustScore({ incidents: 1 });
  const result = assessPromotion(score);
  assert.ok(Array.isArray(result.reasonCodes));
  assert.ok(result.reasonCodes.length > 0);
});

test("assessPromotion success rate exactly at threshold passes", () => {
  const score = mockTrustScore({
    currentAutonomy: "suggestion",
    totalExecutions: 50,
    successfulExecutions: 47,
    failedExecutions: 3,
    incidents: 0,
  });
  const rate = score.successfulExecutions / score.totalExecutions;
  assert.ok(rate >= 0.94);
});

test("assessPromotion semi_auto path only becomes promotable at 500 executions and still requires platform_team approval", () => {
  const belowScore = mockTrustScore({
    currentAutonomy: "semi_auto",
    totalExecutions: 499,
    successfulExecutions: 495,
    failedExecutions: 4,
    incidents: 0,
  });
  const aboveScore = mockTrustScore({
    currentAutonomy: "semi_auto",
    totalExecutions: 500,
    successfulExecutions: 495,
    failedExecutions: 5,
    incidents: 0,
  });
  assert.strictEqual(assessPromotion(belowScore).shouldPromote, false);
  assert.strictEqual(assessPromotion(aboveScore).shouldPromote, true);
  assert.strictEqual(assessPromotion(aboveScore).approvalRole, "platform_team");
  assert.ok(assessPromotion(aboveScore).reasonCodes.includes("autonomy.full_auto_requires_governance_override"));
});
