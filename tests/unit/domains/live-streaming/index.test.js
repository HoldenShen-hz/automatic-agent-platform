import assert from "node:assert/strict";
import test from "node:test";
import { LiveStreamingTaskTypeSchema, LIVE_STREAMING_DOMAIN_PRESET, requiresLiveStreamingReview, } from "../../../../src/domains/live-streaming/index.js";
test("LiveStreamingTaskTypeSchema accepts valid task types", () => {
    const types = ["prepare", "moderate", "respond"];
    for (const type of types) {
        const result = LiveStreamingTaskTypeSchema.safeParse(type);
        assert.equal(result.success, true, `Expected ${type} to be valid`);
    }
});
test("LiveStreamingTaskTypeSchema rejects invalid task types", () => {
    const result = LiveStreamingTaskTypeSchema.safeParse("invalid");
    assert.equal(result.success, false);
});
test("LIVE_STREAMING_DOMAIN_PRESET has correct structure", () => {
    assert.equal(LIVE_STREAMING_DOMAIN_PRESET.domainId, "live-streaming");
    assert.ok(Array.isArray(LIVE_STREAMING_DOMAIN_PRESET.defaultWorkflowIds));
    assert.ok(Array.isArray(LIVE_STREAMING_DOMAIN_PRESET.defaultToolBundleIds));
    assert.ok(Array.isArray(LIVE_STREAMING_DOMAIN_PRESET.requiredCapabilities));
    assert.ok(Array.isArray(LIVE_STREAMING_DOMAIN_PRESET.reviewRequiredTaskTypes));
});
test("LIVE_STREAMING_DOMAIN_PRESET has correct required capabilities", () => {
    assert.deepEqual(LIVE_STREAMING_DOMAIN_PRESET.requiredCapabilities, ["prepare", "moderate", "respond"]);
});
test("LIVE_STREAMING_DOMAIN_PRESET has correct review required task types", () => {
    assert.deepEqual(LIVE_STREAMING_DOMAIN_PRESET.reviewRequiredTaskTypes, ["moderate", "respond"]);
});
test("requiresLiveStreamingReview returns true for moderate task type", () => {
    assert.equal(requiresLiveStreamingReview("moderate"), true);
});
test("requiresLiveStreamingReview returns true for respond task type", () => {
    assert.equal(requiresLiveStreamingReview("respond"), true);
});
test("requiresLiveStreamingReview returns false for prepare task type", () => {
    assert.equal(requiresLiveStreamingReview("prepare"), false);
});
//# sourceMappingURL=index.test.js.map