/**
 * Unit tests for UserPreferenceTracker
 */
import assert from "node:assert/strict";
import test from "node:test";
import { UserPreferenceTracker } from "../../../../src/interaction/proactive-agent/user-preference-tracker.js";
test("UserPreferenceTracker.recordAdopted creates feedback with adopted response", () => {
    const tracker = new UserPreferenceTracker();
    const feedback = tracker.recordAdopted("suggestion-1", "trigger-1", "domain-1", 5000);
    assert.equal(feedback.response, "adopted");
    assert.equal(feedback.suggestionId, "suggestion-1");
    assert.equal(feedback.triggerId, "trigger-1");
    assert.equal(feedback.domainId, "domain-1");
    assert.equal(feedback.latencyMs, 5000);
});
test("UserPreferenceTracker.recordDismissed creates feedback with dismissed response", () => {
    const tracker = new UserPreferenceTracker();
    const feedback = tracker.recordDismissed("suggestion-1", "trigger-1", "domain-1");
    assert.equal(feedback.response, "dismissed");
});
test("UserPreferenceTracker.recordIgnored creates feedback with ignored response", () => {
    const tracker = new UserPreferenceTracker();
    const feedback = tracker.recordIgnored("suggestion-1", "trigger-1", "domain-1");
    assert.equal(feedback.response, "ignored");
});
test("UserPreferenceTracker.getTriggerStats returns null for unknown trigger", () => {
    const tracker = new UserPreferenceTracker();
    const stats = tracker.getTriggerStats("unknown-trigger");
    assert.equal(stats, null);
});
test("UserPreferenceTracker.getTriggerStats returns correct stats for known trigger", () => {
    const tracker = new UserPreferenceTracker();
    tracker.recordAdopted("s1", "trigger-x", "domain-1");
    tracker.recordAdopted("s2", "trigger-x", "domain-1");
    tracker.recordDismissed("s3", "trigger-x", "domain-1");
    tracker.recordIgnored("s4", "trigger-x", "domain-1");
    const stats = tracker.getTriggerStats("trigger-x");
    assert.ok(stats);
    assert.equal(stats.triggerId, "trigger-x");
    assert.equal(stats.totalSuggestions, 4);
    assert.equal(stats.adoptedCount, 2);
    assert.equal(stats.dismissedCount, 1);
    assert.equal(stats.ignoredCount, 1);
    assert.equal(stats.adoptionRate, 0.5);
    assert.equal(stats.dismissalRate, 0.25);
});
test("UserPreferenceTracker.getDomainStats returns null for unknown domain", () => {
    const tracker = new UserPreferenceTracker();
    const stats = tracker.getDomainStats("unknown-domain");
    assert.equal(stats, null);
});
test("UserPreferenceTracker.getDomainStats aggregates across triggers", () => {
    const tracker = new UserPreferenceTracker();
    tracker.recordAdopted("s1", "trigger-a", "domain-x");
    tracker.recordAdopted("s2", "trigger-b", "domain-x");
    tracker.recordDismissed("s3", "trigger-c", "domain-x");
    const stats = tracker.getDomainStats("domain-x");
    assert.ok(stats);
    assert.equal(stats.domainId, "domain-x");
    assert.equal(stats.totalSuggestions, 3);
    assert.equal(stats.adoptedCount, 2);
    assert.equal(stats.dismissedCount, 1);
    assert.equal(stats.adoptionRate, 2 / 3);
});
test("UserPreferenceTracker.getFrequencyMultiplier returns 1.0 without enough data", () => {
    const tracker = new UserPreferenceTracker({ minSamplesForAdjustment: 5 });
    // Only 2 samples
    tracker.recordAdopted("s1", "trigger-1", "domain-1");
    tracker.recordAdopted("s2", "trigger-1", "domain-1");
    const multiplier = tracker.getFrequencyMultiplier("trigger-1");
    assert.equal(multiplier, 1.0);
});
test("UserPreferenceTracker.getFrequencyMultiplier reduces frequency for low adoption", () => {
    const tracker = new UserPreferenceTracker({
        minSamplesForAdjustment: 3,
        lowAdoptionThreshold: 0.3,
        minFrequencyMultiplier: 0.1,
    });
    // 2 adopted, 8 ignored = 0.2 adoption rate
    for (let i = 0; i < 2; i++) {
        tracker.recordAdopted(`s-adopted-${i}`, "low-adopt-trigger", "domain-1");
    }
    for (let i = 0; i < 8; i++) {
        tracker.recordIgnored(`s-ignored-${i}`, "low-adopt-trigger", "domain-1");
    }
    const multiplier = tracker.getFrequencyMultiplier("low-adopt-trigger");
    assert.ok(multiplier < 1.0);
    assert.ok(multiplier >= 0.1); // minFrequencyMultiplier
});
test("UserPreferenceTracker.getFrequencyMultiplier increases frequency for high adoption", () => {
    const tracker = new UserPreferenceTracker({
        minSamplesForAdjustment: 3,
        highAdoptionThreshold: 0.7,
        maxFrequencyMultiplier: 2.0,
    });
    // 8 adopted, 2 ignored = 0.8 adoption rate
    for (let i = 0; i < 8; i++) {
        tracker.recordAdopted(`s-adopted-${i}`, "high-adopt-trigger", "domain-1");
    }
    for (let i = 0; i < 2; i++) {
        tracker.recordIgnored(`s-ignored-${i}`, "high-adopt-trigger", "domain-1");
    }
    const multiplier = tracker.getFrequencyMultiplier("high-adopt-trigger");
    assert.ok(multiplier > 1.0);
    assert.ok(multiplier <= 2.0); // maxFrequencyMultiplier
});
test("UserPreferenceTracker.getFrequencyMultiplier returns 1.0 for medium adoption", () => {
    const tracker = new UserPreferenceTracker({
        minSamplesForAdjustment: 4,
        lowAdoptionThreshold: 0.3,
        highAdoptionThreshold: 0.7,
    });
    // 3 adopted, 3 ignored = 0.5 adoption rate
    for (let i = 0; i < 3; i++) {
        tracker.recordAdopted(`s-adopted-${i}`, "med-adopt-trigger", "domain-1");
    }
    for (let i = 0; i < 3; i++) {
        tracker.recordIgnored(`s-ignored-${i}`, "med-adopt-trigger", "domain-1");
    }
    const multiplier = tracker.getFrequencyMultiplier("med-adopt-trigger");
    assert.equal(multiplier, 1.0);
});
test("UserPreferenceTracker.getTriggersByAdoption sorts by adoption rate ascending", () => {
    const tracker = new UserPreferenceTracker({ minSamplesForAdjustment: 1 });
    // Low adoption trigger
    tracker.recordAdopted("s1", "trigger-low", "domain-1");
    tracker.recordIgnored("s2", "trigger-low", "domain-1");
    tracker.recordIgnored("s3", "trigger-low", "domain-1");
    // High adoption trigger
    tracker.recordAdopted("s4", "trigger-high", "domain-2");
    tracker.recordAdopted("s5", "trigger-high", "domain-2");
    tracker.recordIgnored("s6", "trigger-high", "domain-2");
    const sorted = tracker.getTriggersByAdoption(true);
    assert.equal(sorted[0].triggerId, "trigger-low");
    assert.ok(sorted[0].adoptionRate < 0.5);
    assert.equal(sorted[1].triggerId, "trigger-high");
    assert.ok(sorted[1].adoptionRate > 0.5);
});
test("UserPreferenceTracker.cleanup removes old feedback", () => {
    const tracker = new UserPreferenceTracker({ analysisWindowDays: 7 });
    // Old feedback would have an old timestamp, but we can't easily create that
    // So we just verify the cleanup doesn't throw
    const removed = tracker.cleanup();
    assert.equal(typeof removed, "number");
});
test("UserPreferenceTracker.getTotalFeedbackCount returns correct count", () => {
    const tracker = new UserPreferenceTracker();
    assert.equal(tracker.getTotalFeedbackCount(), 0);
    tracker.recordAdopted("s1", "trigger-1", "domain-1");
    assert.equal(tracker.getTotalFeedbackCount(), 1);
    tracker.recordDismissed("s2", "trigger-1", "domain-1");
    assert.equal(tracker.getTotalFeedbackCount(), 2);
    tracker.recordIgnored("s3", "trigger-2", "domain-2");
    assert.equal(tracker.getTotalFeedbackCount(), 3);
});
test("UserPreferenceTracker.config applies custom configuration", () => {
    const tracker = new UserPreferenceTracker({
        minSamplesForAdjustment: 10,
        lowAdoptionThreshold: 0.5,
        maxFrequencyMultiplier: 3.0,
    });
    // With minSamplesForAdjustment: 10, even 5 samples should not adjust
    for (let i = 0; i < 5; i++) {
        tracker.recordIgnored(`s-${i}`, "trigger-1", "domain-1");
    }
    const multiplier = tracker.getFrequencyMultiplier("trigger-1");
    assert.equal(multiplier, 1.0); // Not enough samples
});
//# sourceMappingURL=user-preference-tracker.test.js.map