import assert from "node:assert/strict";
import test from "node:test";
import { loadStableSequenceCliEnv } from "../../../../../src/platform/control-plane/config-center/stable-cli-env.js";
test("stable sequence env loader parses profiles and timing options", () => {
    const config = loadStableSequenceCliEnv({
        AA_STABLE_SEQUENCE_EVIDENCE_ROOT: "/tmp/evidence",
        AA_STABLE_SEQUENCE_PROFILES: "smoke,24h",
        AA_STABLE_SEQUENCE_TARGET_DURATION_MS: "5000",
        AA_STABLE_SEQUENCE_SEGMENT_DURATION_MS: "1000",
        AA_STABLE_SEQUENCE_INTERVAL_MS: "50",
        AA_STABLE_SEQUENCE_ITERATIONS_PER_CYCLE: "2",
        AA_STABLE_SEQUENCE_VALIDATION_ITERATIONS: "3",
        AA_STABLE_SEQUENCE_ENFORCE_WALL_CLOCK: "true",
        AA_STABLE_SEQUENCE_RUN_UNTIL_COMPLETE: "1",
        AA_STABLE_SEQUENCE_SLEEP_MS: "25",
        AA_STABLE_SEQUENCE_MAX_PASSES: "4",
    });
    assert.deepEqual(config.profileNames, ["smoke", "24h"]);
    assert.equal(config.evidenceRootDir, "/tmp/evidence");
    assert.equal(config.sharedProfileOptions.targetDurationMs, 5000);
    assert.equal(config.sharedProfileOptions.enforceWallClockDuration, true);
    assert.equal(config.runUntilComplete, true);
    assert.equal(config.sleepMs, 25);
    assert.equal(config.maxPasses, 4);
});
test("stable sequence env loader handles empty env with defaults", () => {
    const config = loadStableSequenceCliEnv({});
    assert.deepEqual(config.profileNames, ["24h", "72h"]);
    assert.ok(config.evidenceRootDir.length > 0);
    assert.equal(config.sleepMs, 0);
    assert.equal(config.maxPasses, null);
});
test("stable sequence env loader parses single profile", () => {
    const config = loadStableSequenceCliEnv({
        AA_STABLE_SEQUENCE_PROFILES: "smoke",
    });
    assert.deepEqual(config.profileNames, ["smoke"]);
});
//# sourceMappingURL=stable-sequence-env.test.js.map