import test from "node:test";
import { strict as assert } from "node:assert/strict";
import { UserPreferenceTracker } from "../../../../../src/interaction/proactive-agent/user-preference-tracker.js";

function createTracker(config?: Partial<Parameters<typeof UserPreferenceTracker>[0]>): UserPreferenceTracker {
  return new UserPreferenceTracker(config);
}

test("UserPreferenceTracker records adopted feedback", () => {
  const tracker = createTracker();
  const feedback = tracker.recordAdopted("suggestion-1", "trigger-1", "domain-1", 100);

  assert.strictEqual(feedback.suggestionId, "suggestion-1");
  assert.strictEqual(feedback.triggerId, "trigger-1");
  assert.strictEqual(feedback.domainId, "domain-1");
  assert.strictEqual(feedback.response, "adopted");
  assert.strictEqual(feedback.latencyMs, 100);
  assert.ok(feedback.feedbackId.startsWith("feedback_"));
});

test("UserPreferenceTracker records dismissed feedback", () => {
  const tracker = createTracker();
  const feedback = tracker.recordDismissed("suggestion-1", "trigger-1", "domain-1");

  assert.strictEqual(feedback.response, "dismissed");
});

test("UserPreferenceTracker records ignored feedback", () => {
  const tracker = createTracker();
  const feedback = tracker.recordIgnored("suggestion-1", "trigger-1", "domain-1");

  assert.strictEqual(feedback.response, "ignored");
});

test("UserPreferenceTracker getTriggerStats returns null for unknown trigger", () => {
  const tracker = createTracker();
  const stats = tracker.getTriggerStats("nonexistent");

  assert.strictEqual(stats, null);
});

test("UserPreferenceTracker getTriggerStats returns correct stats", () => {
  const tracker = createTracker();
  tracker.recordAdopted("s1", "trigger-1", "domain-1");
  tracker.recordAdopted("s2", "trigger-1", "domain-1");
  tracker.recordDismissed("s3", "trigger-1", "domain-1");
  tracker.recordIgnored("s4", "trigger-1", "domain-1");

  const stats = tracker.getTriggerStats("trigger-1");

  assert.ok(stats !== null);
  assert.strictEqual(stats!.triggerId, "trigger-1");
  assert.strictEqual(stats!.totalSuggestions, 4);
  assert.strictEqual(stats!.adoptedCount, 2);
  assert.strictEqual(stats!.dismissedCount, 1);
  assert.strictEqual(stats!.ignoredCount, 1);
  assert.strictEqual(stats!.adoptionRate, 0.5);
});

test("UserPreferenceTracker getDomainStats returns correct stats", () => {
  const tracker = createTracker();
  tracker.recordAdopted("s1", "trigger-1", "domain-1");
  tracker.recordAdopted("s2", "trigger-1", "domain-2");
  tracker.recordAdopted("s3", "trigger-2", "domain-1");

  const stats = tracker.getDomainStats("domain-1");

  assert.ok(stats !== null);
  assert.strictEqual(stats!.domainId, "domain-1");
  assert.strictEqual(stats!.totalSuggestions, 2);
  assert.strictEqual(stats!.adoptedCount, 2);
});

test("UserPreferenceTracker getFrequencyMultiplier returns 1.0 without enough samples", () => {
  const tracker = createTracker({ minSamplesForAdjustment: 5 });
  tracker.recordAdopted("s1", "trigger-1", "domain-1");
  tracker.recordAdopted("s2", "trigger-1", "domain-1");

  const multiplier = tracker.getFrequencyMultiplier("trigger-1");

  assert.strictEqual(multiplier, 1.0);
});

test("UserPreferenceTracker getFrequencyMultiplier reduces frequency for low adoption", () => {
  const tracker = createTracker({
    minSamplesForAdjustment: 3,
    lowAdoptionThreshold: 0.3,
    minFrequencyMultiplier: 0.1,
  });
  tracker.recordDismissed("s1", "trigger-1", "domain-1");
  tracker.recordDismissed("s2", "trigger-1", "domain-1");
  tracker.recordDismissed("s3", "trigger-1", "domain-1");

  const multiplier = tracker.getFrequencyMultiplier("trigger-1");

  assert.ok(multiplier < 1.0);
  assert.ok(multiplier >= 0.1);
});

test("UserPreferenceTracker getFrequencyMultiplier increases frequency for high adoption", () => {
  const tracker = createTracker({
    minSamplesForAdjustment: 3,
    highAdoptionThreshold: 0.7,
    maxFrequencyMultiplier: 2.0,
  });
  tracker.recordAdopted("s1", "trigger-1", "domain-1");
  tracker.recordAdopted("s2", "trigger-1", "domain-1");
  tracker.recordAdopted("s3", "trigger-1", "domain-1");

  const multiplier = tracker.getFrequencyMultiplier("trigger-1");

  assert.ok(multiplier > 1.0);
  assert.ok(multiplier <= 2.0);
});

test("UserPreferenceTracker getFrequencyMultiplier returns 1.0 for medium adoption", () => {
  const tracker = createTracker({
    minSamplesForAdjustment: 3,
    lowAdoptionThreshold: 0.3,
    highAdoptionThreshold: 0.7,
  });
  tracker.recordAdopted("s1", "trigger-1", "domain-1");
  tracker.recordDismissed("s2", "trigger-1", "domain-1");
  tracker.recordAdopted("s3", "trigger-1", "domain-1");

  const multiplier = tracker.getFrequencyMultiplier("trigger-1");

  assert.strictEqual(multiplier, 1.0);
});

test("UserPreferenceTracker getTriggersByAdoption returns sorted triggers", () => {
  const tracker = createTracker({ minSamplesForAdjustment: 1 });
  tracker.recordAdopted("s1", "trigger-high", "domain-1");
  tracker.recordDismissed("s2", "trigger-low", "domain-1");

  const sorted = tracker.getTriggersByAdoption(true);

  assert.ok(sorted.length >= 2);
  assert.strictEqual(sorted[0]!.triggerId, "trigger-low");
});

test("UserPreferenceTracker getDomainsByAdoption returns sorted domains", () => {
  const tracker = createTracker({ minSamplesForAdjustment: 1 });
  tracker.recordAdopted("s1", "trigger-1", "domain-high");
  tracker.recordDismissed("s2", "trigger-2", "domain-low");

  const sorted = tracker.getDomainsByAdoption(true);

  assert.ok(sorted.length >= 2);
  assert.strictEqual(sorted[0]!.domainId, "domain-low");
});

test("UserPreferenceTracker cleanup removes old feedback", () => {
  const tracker = createTracker({ analysisWindowDays: 7 });
  tracker.recordAdopted("s1", "trigger-1", "domain-1");

  const removed = tracker.cleanup();

  assert.strictEqual(removed, 0);
  assert.strictEqual(tracker.getTotalFeedbackCount(), 1);
});

test("UserPreferenceTracker getTotalFeedbackCount returns count", () => {
  const tracker = createTracker();
  tracker.recordAdopted("s1", "trigger-1", "domain-1");
  tracker.recordDismissed("s2", "trigger-1", "domain-1");

  assert.strictEqual(tracker.getTotalFeedbackCount(), 2);
});

test("UserPreferenceTracker with custom config uses custom values", () => {
  const tracker = createTracker({
    minSamplesForAdjustment: 10,
    lowAdoptionThreshold: 0.2,
    highAdoptionThreshold: 0.8,
    maxFrequencyMultiplier: 3.0,
    minFrequencyMultiplier: 0.05,
    analysisWindowDays: 14,
  });

  assert.strictEqual(tracker.getFrequencyMultiplier("any"), 1.0);
});

test("UserPreferenceTracker recordFeedback returns feedback with all fields", () => {
  const tracker = createTracker();
  const feedback = tracker.recordFeedback("s1", "trigger-1", "domain-1", "adopted", 500);

  assert.strictEqual(feedback.feedbackId.startsWith("feedback_"), true);
  assert.strictEqual(feedback.suggestionId, "s1");
  assert.strictEqual(feedback.triggerId, "trigger-1");
  assert.strictEqual(feedback.domainId, "domain-1");
  assert.strictEqual(feedback.response, "adopted");
  assert.strictEqual(feedback.latencyMs, 500);
  assert.ok(feedback.respondedAt.length > 0);
});

test("UserPreferenceTracker avgResponseLatencyMs is computed", () => {
  const tracker = createTracker();
  tracker.recordAdopted("s1", "trigger-1", "domain-1", 100);
  tracker.recordAdopted("s2", "trigger-1", "domain-1", 200);
  tracker.recordAdopted("s3", "trigger-1", "domain-1", 300);

  const stats = tracker.getTriggerStats("trigger-1");

  assert.ok(stats !== null);
  assert.strictEqual(stats!.avgResponseLatencyMs, 200);
});

test("UserPreferenceTracker avgResponseLatencyMs is null when no latency data", () => {
  const tracker = createTracker();
  tracker.recordAdopted("s1", "trigger-1", "domain-1");
  tracker.recordDismissed("s2", "trigger-1", "domain-1");

  const stats = tracker.getTriggerStats("trigger-1");

  assert.ok(stats !== null);
  assert.strictEqual(stats!.avgResponseLatencyMs, null);
});
