import assert from "node:assert/strict";
import test from "node:test";
import { GamePublishingTaskTypeSchema, GAME_PUBLISHING_DOMAIN_PRESET, requiresGamePublishingReview, } from "../../../../src/domains/game-publishing/index.js";
test("GamePublishingTaskTypeSchema accepts valid task types", () => {
    const types = ["package", "review", "release"];
    for (const type of types) {
        const result = GamePublishingTaskTypeSchema.safeParse(type);
        assert.equal(result.success, true, `Expected ${type} to be valid`);
    }
});
test("GamePublishingTaskTypeSchema rejects invalid task types", () => {
    const result = GamePublishingTaskTypeSchema.safeParse("invalid");
    assert.equal(result.success, false);
});
test("GAME_PUBLISHING_DOMAIN_PRESET has correct structure", () => {
    assert.equal(GAME_PUBLISHING_DOMAIN_PRESET.domainId, "game-publishing");
    assert.ok(Array.isArray(GAME_PUBLISHING_DOMAIN_PRESET.defaultWorkflowIds));
    assert.ok(Array.isArray(GAME_PUBLISHING_DOMAIN_PRESET.defaultToolBundleIds));
    assert.ok(Array.isArray(GAME_PUBLISHING_DOMAIN_PRESET.requiredCapabilities));
    assert.ok(Array.isArray(GAME_PUBLISHING_DOMAIN_PRESET.reviewRequiredTaskTypes));
});
test("GAME_PUBLISHING_DOMAIN_PRESET has correct required capabilities", () => {
    assert.deepEqual(GAME_PUBLISHING_DOMAIN_PRESET.requiredCapabilities, ["package", "review", "release"]);
});
test("GAME_PUBLISHING_DOMAIN_PRESET has correct review required task types", () => {
    assert.deepEqual(GAME_PUBLISHING_DOMAIN_PRESET.reviewRequiredTaskTypes, ["review", "release"]);
});
test("requiresGamePublishingReview returns true for review task type", () => {
    assert.equal(requiresGamePublishingReview("review"), true);
});
test("requiresGamePublishingReview returns true for release task type", () => {
    assert.equal(requiresGamePublishingReview("release"), true);
});
test("requiresGamePublishingReview returns false for package task type", () => {
    assert.equal(requiresGamePublishingReview("package"), false);
});
//# sourceMappingURL=index.test.js.map