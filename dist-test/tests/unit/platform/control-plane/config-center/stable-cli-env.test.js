import assert from "node:assert/strict";
import test from "node:test";
import { loadStableCampaignCliEnv } from "../../../../../src/platform/control-plane/config-center/stable-cli-env.js";
test("stable campaign env loader parses numeric overrides", () => {
    const config = loadStableCampaignCliEnv({
        AA_STABLE_CAMPAIGN_PROFILE: "24h",
        AA_STABLE_CAMPAIGN_OUTPUT_DIR: "/tmp/stable-campaign",
        AA_STABLE_CAMPAIGN_TARGET_DURATION_MS: "100",
        AA_STABLE_CAMPAIGN_SEGMENT_DURATION_MS: "25",
        AA_STABLE_CAMPAIGN_INTERVAL_MS: "5",
        AA_STABLE_CAMPAIGN_ITERATIONS_PER_CYCLE: "2",
        AA_STABLE_CAMPAIGN_VALIDATION_ITERATIONS: "3",
    });
    assert.equal(config.profile, "24h");
    assert.equal(config.outputDir, "/tmp/stable-campaign");
    assert.equal(config.targetDurationMs, 100);
    assert.equal(config.segmentDurationMs, 25);
    assert.equal(config.intervalMs, 5);
    assert.equal(config.iterationsPerCycle, 2);
    assert.equal(config.validationIterations, 3);
});
test("stable campaign env loader rejects malformed numeric overrides", () => {
    assert.throws(() => loadStableCampaignCliEnv({
        AA_STABLE_CAMPAIGN_SEGMENT_DURATION_MS: "-10",
    }), /stable\.invalid_env:AA_STABLE_CAMPAIGN_SEGMENT_DURATION_MS/);
});
test("stable campaign env loader parses valid profile", () => {
    const config = loadStableCampaignCliEnv({
        AA_STABLE_CAMPAIGN_PROFILE: "72h",
    });
    assert.equal(config.profile, "72h");
});
test("stable campaign env loader handles missing optional values", () => {
    const config = loadStableCampaignCliEnv({});
    // Default profile is "smoke" when not provided
    assert.equal(config.profile, "smoke");
    // outputDir has a default based on profile
    assert.ok(config.outputDir.includes("stable-campaign"));
    assert.equal(config.targetDurationMs, null);
});
//# sourceMappingURL=stable-cli-env.test.js.map