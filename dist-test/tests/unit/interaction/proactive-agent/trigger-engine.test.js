/**
 * Unit tests for trigger-engine utilities
 */
import assert from "node:assert/strict";
import test from "node:test";
import { resolveTriggerActionMode } from "../../../../src/interaction/proactive-agent/trigger-engine/index.js";
test("resolveTriggerActionMode returns suggest when requireConfirmation is true", () => {
    const mode = resolveTriggerActionMode(true, "low");
    assert.equal(mode, "suggest");
});
test("resolveTriggerActionMode returns silent_record for critical risk without confirmation", () => {
    const mode = resolveTriggerActionMode(false, "critical");
    assert.equal(mode, "silent_record");
});
test("resolveTriggerActionMode returns auto_execute for low/medium/high risk without confirmation", () => {
    assert.equal(resolveTriggerActionMode(false, "low"), "auto_execute");
    assert.equal(resolveTriggerActionMode(false, "medium"), "auto_execute");
    assert.equal(resolveTriggerActionMode(false, "high"), "auto_execute");
});
//# sourceMappingURL=trigger-engine.test.js.map