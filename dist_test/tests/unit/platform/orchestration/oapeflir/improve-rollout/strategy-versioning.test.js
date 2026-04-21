import test from "node:test";
import assert from "node:assert/strict";
import { createStrategyVersion } from "../../../../../../src/platform/orchestration/oapeflir/improve-rollout/strategy-versioning.js";
test("createStrategyVersion creates version with suggest level by default", () => {
    const result = createStrategyVersion("Test Strategy", []);
    assert.equal(result.title, "Test Strategy");
    assert.equal(result.releaseLevel, "suggest");
    assert.ok(result.strategyVersionId.startsWith("strategy_version_"));
    assert.deepEqual(result.sourceLearningObjectIds, []);
});
test("createStrategyVersion maps learning objects to IDs", () => {
    const learningObjects = [
        { learningObjectId: "lo_1", learningType: "failure_pattern", title: "Test", summary: "Summary", confidence: 0.9, evidenceRefs: [], sourceSignalIds: [], recommendation: "Rec", validatedBy: "evidence", promotionStatus: "validated", createdAt: Date.now() },
        { learningObjectId: "lo_2", learningType: "user_correction", title: "Test2", summary: "Summary2", confidence: 0.8, evidenceRefs: [], sourceSignalIds: [], recommendation: "Rec2", validatedBy: "evidence", promotionStatus: "validated", createdAt: Date.now() },
    ];
    const result = createStrategyVersion("Test", learningObjects, "stable");
    assert.deepEqual(result.sourceLearningObjectIds, ["lo_1", "lo_2"]);
});
test("createStrategyVersion accepts all release levels", () => {
    const levels = ["off", "suggest", "shadow", "canary_5", "partial_25", "partial_50", "partial_75", "stable"];
    for (const level of levels) {
        const result = createStrategyVersion("Test", [], level);
        assert.equal(result.releaseLevel, level);
    }
});
test("createStrategyVersion sets createdAt to current time", () => {
    const before = Date.now();
    const result = createStrategyVersion("Test", []);
    const after = Date.now();
    assert.ok(result.createdAt >= before);
    assert.ok(result.createdAt <= after);
});
//# sourceMappingURL=strategy-versioning.test.js.map