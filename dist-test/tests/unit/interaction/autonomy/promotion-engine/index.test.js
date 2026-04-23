import assert from "node:assert/strict";
import test from "node:test";
import { assessPromotion } from "../../../../../src/interaction/autonomy/promotion-engine/index.js";
function makeScore(overrides = {}) {
    return {
        capabilityId: "deploy",
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
    assert.ok(result.reasonCodes.includes("autonomy.promotion_blocked_by_incident"));
});
test("assessPromotion promotes suggestion to supervised when thresholds met", () => {
    const score = makeScore({
        currentAutonomy: "suggestion",
        totalExecutions: 50,
        successfulExecutions: 48,
        failedExecutions: 1,
        incidents: 0,
    });
    const result = assessPromotion(score);
    assert.equal(result.shouldPromote, true);
    assert.equal(result.currentLevel, "suggestion");
    assert.equal(result.targetLevel, "supervised");
    assert.ok(result.reasonCodes.includes("autonomy.meets_supervised_threshold"));
});
test("assessPromotion promotes supervised to semi_auto when thresholds met", () => {
    const score = makeScore({
        currentAutonomy: "supervised",
        totalExecutions: 200,
        successfulExecutions: 197,
        failedExecutions: 1,
        incidents: 0,
    });
    const result = assessPromotion(score);
    assert.equal(result.shouldPromote, true);
    assert.equal(result.currentLevel, "supervised");
    assert.equal(result.targetLevel, "semi_auto");
    assert.ok(result.reasonCodes.includes("autonomy.meets_semi_auto_threshold"));
});
test("assessPromotion promotes semi_auto to full_auto when thresholds met", () => {
    const score = makeScore({
        currentAutonomy: "semi_auto",
        totalExecutions: 500,
        successfulExecutions: 497,
        failedExecutions: 1,
        incidents: 0,
    });
    const result = assessPromotion(score);
    assert.equal(result.shouldPromote, true);
    assert.equal(result.currentLevel, "semi_auto");
    assert.equal(result.targetLevel, "full_auto");
    assert.ok(result.reasonCodes.includes("autonomy.meets_full_auto_threshold"));
});
test("assessPromotion does not promote at suggestion level with insufficient volume", () => {
    const score = makeScore({
        currentAutonomy: "suggestion",
        totalExecutions: 30,
        successfulExecutions: 29,
        failedExecutions: 1,
        incidents: 0,
    });
    const result = assessPromotion(score);
    assert.equal(result.shouldPromote, false);
    assert.equal(result.currentLevel, "suggestion");
    assert.equal(result.targetLevel, "suggestion");
    assert.ok(result.reasonCodes.includes("autonomy.promotion_threshold_not_met"));
});
test("assessPromotion does not promote at suggestion level with insufficient success rate", () => {
    const score = makeScore({
        currentAutonomy: "suggestion",
        totalExecutions: 60,
        successfulExecutions: 55,
        failedExecutions: 2, // 55 + 2 = 57, but total is 60... wait let me recalculate
        incidents: 0,
    });
    const result = assessPromotion(score);
    // 55/60 = 0.917 < 0.95, so promotion threshold not met
    assert.equal(result.shouldPromote, false);
    assert.ok(result.reasonCodes.includes("autonomy.promotion_threshold_not_met"));
});
test("assessPromotion does not promote at supervised level with insufficient volume", () => {
    const score = makeScore({
        currentAutonomy: "supervised",
        totalExecutions: 150,
        successfulExecutions: 148,
        failedExecutions: 1,
        incidents: 0,
    });
    const result = assessPromotion(score);
    assert.equal(result.shouldPromote, false);
    assert.ok(result.reasonCodes.includes("autonomy.promotion_threshold_not_met"));
});
test("assessPromotion does not promote at semi_auto level with insufficient volume", () => {
    const score = makeScore({
        currentAutonomy: "semi_auto",
        totalExecutions: 400,
        successfulExecutions: 396,
        failedExecutions: 2,
        incidents: 0,
    });
    const result = assessPromotion(score);
    assert.equal(result.shouldPromote, false);
    assert.ok(result.reasonCodes.includes("autonomy.promotion_threshold_not_met"));
});
test("assessPromotion does not promote already at full_auto", () => {
    const score = makeScore({
        currentAutonomy: "full_auto",
        totalExecutions: 1000,
        successfulExecutions: 995,
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
    assert.equal(result.targetLevel, "suggestion");
});
//# sourceMappingURL=index.test.js.map