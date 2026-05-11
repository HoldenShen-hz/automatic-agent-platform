import assert from "node:assert/strict";
import test from "node:test";

import { assessPromotion } from "../../../../src/interaction/autonomy/promotion-engine/index.js";
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
    lastIncidentAgeDays: 120,
    ...overrides,
  };
}

test("assessPromotion blocks promotion when incidents > 0", () => {
  const score = makeScore({
    currentAutonomy: "suggestion",
    totalExecutions: 100,
    successfulExecutions: 95,
    incidents: 1,
  });
  const result = assessPromotion(score);
  assert.equal(result.shouldPromote, false);
  assert.ok(result.reasonCodes.includes("autonomy.promotion_blocked_by_incident"));
});

test("assessPromotion blocks promotion when failedExecutions > 2", () => {
  const score = makeScore({
    currentAutonomy: "suggestion",
    totalExecutions: 100,
    successfulExecutions: 95,
    failedExecutions: 3,
    incidents: 0,
  });
  const result = assessPromotion(score);
  assert.equal(result.shouldPromote, false);
});

test("assessPromotion promotes suggestion to supervised at 95% success with 50+ executions", () => {
  const score = makeScore({
    currentAutonomy: "suggestion",
    totalExecutions: 50,
    successfulExecutions: 48, // 96%
    failedExecutions: 2,
    incidents: 0,
  });
  const result = assessPromotion(score);
  assert.equal(result.shouldPromote, true);
  assert.equal(result.targetLevel, "supervised");
  assert.ok(result.reasonCodes.includes("autonomy.meets_supervised_threshold"));
});

test("assessPromotion does not promote suggestion below 50 executions", () => {
  const score = makeScore({
    currentAutonomy: "suggestion",
    totalExecutions: 49,
    successfulExecutions: 49,
    failedExecutions: 0,
    incidents: 0,
  });
  const result = assessPromotion(score);
  assert.equal(result.shouldPromote, false);
});

test("assessPromotion does not promote suggestion below 95% success", () => {
  const score = makeScore({
    currentAutonomy: "suggestion",
    totalExecutions: 50,
    successfulExecutions: 47, // 94%
    failedExecutions: 3,
    incidents: 0,
  });
  const result = assessPromotion(score);
  assert.equal(result.shouldPromote, false);
});

test("assessPromotion promotes supervised to semi_auto at 98% with 200+ executions", () => {
  const score = makeScore({
    currentAutonomy: "supervised",
    totalExecutions: 200,
    successfulExecutions: 196, // 98%
    failedExecutions: 4,
    incidents: 0,
  });
  const result = assessPromotion(score);
  assert.equal(result.shouldPromote, true);
  assert.equal(result.targetLevel, "semi_auto");
  assert.ok(result.reasonCodes.includes("autonomy.meets_semi_auto_threshold"));
});

test("assessPromotion does not promote supervised below 200 executions", () => {
  const score = makeScore({
    currentAutonomy: "supervised",
    totalExecutions: 199,
    successfulExecutions: 199,
    failedExecutions: 0,
    incidents: 0,
  });
  const result = assessPromotion(score);
  assert.equal(result.shouldPromote, false);
});

test("assessPromotion requires platform_team approval for semi_auto to full_auto at 99% with 500+ executions", () => {
  const score = makeScore({
    currentAutonomy: "semi_auto",
    totalExecutions: 500,
    successfulExecutions: 495, // 99%
    failedExecutions: 5,
    incidents: 0,
  });
  const result = assessPromotion(score);
  assert.equal(result.shouldPromote, true);
  assert.equal(result.targetLevel, "full_auto");
  assert.equal(result.approvalRequired, true);
  assert.equal(result.approvalRole, "platform_team");
  assert.ok(result.reasonCodes.includes("autonomy.full_auto_requires_governance_override"));
});

test("assessPromotion does not promote semi_auto below 500 executions", () => {
  const score = makeScore({
    currentAutonomy: "semi_auto",
    totalExecutions: 499,
    successfulExecutions: 495,
    failedExecutions: 4,
    incidents: 0,
  });
  const result = assessPromotion(score);
  assert.equal(result.shouldPromote, false);
});

test("assessPromotion returns not_met reason when thresholds not met", () => {
  const score = makeScore({
    currentAutonomy: "suggestion",
    totalExecutions: 30,
    successfulExecutions: 28,
    failedExecutions: 2,
    incidents: 0,
  });
  const result = assessPromotion(score);
  assert.equal(result.shouldPromote, false);
  assert.ok(result.reasonCodes.includes("autonomy.promotion_threshold_not_met"));
});

test("assessPromotion handles zero executions", () => {
  const score = makeScore({
    currentAutonomy: "suggestion",
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    incidents: 0,
  });
  const result = assessPromotion(score);
  assert.equal(result.shouldPromote, false);
  assert.equal(result.currentLevel, "suggestion");
  assert.equal(result.targetLevel, "suggestion");
});

test("assessPromotion preserves current autonomy when not promoting", () => {
  const score = makeScore({
    currentAutonomy: "full_auto",
    totalExecutions: 1000,
    successfulExecutions: 990,
    failedExecutions: 10,
    incidents: 0,
  });
  const result = assessPromotion(score);
  assert.equal(result.shouldPromote, false);
  assert.equal(result.currentLevel, "full_auto");
  assert.equal(result.targetLevel, "full_auto");
});
