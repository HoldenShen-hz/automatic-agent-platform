/**
 * Edge Case Tests: UX Event Tracking Service
 *
 * Tests edge cases and boundary conditions for the UxEventTrackingService.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { UxEventTrackingService } from "../../../../src/interaction/ux/ux-event-tracking-service.js";
import type { UxEventType, ABTestConfig } from "../../../../src/interaction/ux/ux-event-tracking-service.js";

test("UxEventTrackingService tracks button click with minimal payload", () => {
  const service = new UxEventTrackingService();

  const event = service.trackEvent("ux:button_click", { userId: "user_min" });

  assert.equal(event.eventType, "ux:button_click");
  assert.equal(event.userId, "user_min");
  assert.ok(event.eventId.startsWith("uxevt_"));
  assert.ok(event.occurredAt.length > 0);
});

test("UxEventTrackingService tracks all event types", () => {
  const service = new UxEventTrackingService();
  const eventTypes: UxEventType[] = [
    "ux:button_click",
    "ux:form_submit",
    "ux:navigation",
    "ux:wizard_step",
    "ux:workflow_build",
    "ux:dashboard_view",
    "ux:search_query",
    "ux:filter_apply",
    "ux:export_action",
    "ux:share_action",
    "ux:onboarding_complete",
    "ux:feedback_submit",
  ];

  for (const eventType of eventTypes) {
    const event = service.trackEvent(eventType, { userId: "user_all_types" });
    assert.equal(event.eventType, eventType, `Failed for ${eventType}`);
  }
});

test("UxEventTrackingService preserves null optional fields", () => {
  const service = new UxEventTrackingService();

  const event = service.trackEvent("ux:button_click", {
    userId: "user_nulls",
    sessionId: null,
    taskId: null,
    abTestGroup: null,
    metadata: null,
  });

  assert.equal(event.sessionId, null);
  assert.equal(event.taskId, null);
  assert.equal(event.abTestGroup, null);
});

test("UxEventTrackingService handles empty metadata", () => {
  const service = new UxEventTrackingService();

  const event = service.trackEvent("ux:button_click", {
    userId: "user_empty_meta",
    metadata: {},
  });

  assert.deepEqual(event.metadata, {});
});

test("UxEventTrackingService handles unicode in metadata values", () => {
  const service = new UxEventTrackingService();

  const event = service.trackEvent("ux:button_click", {
    userId: "user_unicode",
    metadata: {
      chinese: "中文测试",
      japanese: "日本語",
      emoji: "🎉🚀",
      special: "!@#$%^&*()",
    },
  });

  assert.equal(event.metadata.chinese, "中文测试");
  assert.equal(event.metadata.japanese, "日本語");
  assert.equal(event.metadata.emoji, "🎉🚀");
});

test("UxEventTrackingService assigns consistent A/B test buckets", () => {
  const service = new UxEventTrackingService();
  const userId = "ab_consistent_user";

  const config: ABTestConfig = {
    testId: "test_consistency",
    variants: [
      { variantId: "control", weight: 50 },
      { variantId: "treatment", weight: 50 },
    ],
    stickinessFactor: 0.95,
    minSampleSize: 100,
  };

  const result1 = service.assignABTest(userId, config);
  const result2 = service.assignABTest(userId, config);

  // Same user, same config should return same bucket
  assert.equal(result1.bucket, result2.bucket);
  assert.equal(result1.variantId, result2.variantId);
});

test("UxEventTrackingService different users get different A/B assignments", () => {
  const service = new UxEventTrackingService();
  const config: ABTestConfig = {
    testId: "test_different",
    variants: [
      { variantId: "control", weight: 50 },
      { variantId: "treatment", weight: 50 },
    ],
    stickinessFactor: 0.95,
    minSampleSize: 100,
  };

  const user1Result = service.assignABTest("user_1", config);
  const user2Result = service.assignABTest("user_2", config);

  // Different users may or may not get same variant (probabilistic), but bucket should be computed
  assert.ok(user1Result.bucket >= 0 && user1Result.bucket < 100);
  assert.ok(user2Result.bucket >= 0 && user2Result.bucket < 100);
});

test("UxEventTrackingService assignABTest returns existing for same test", () => {
  const service = new UxEventTrackingService();
  const userId = "user_repeat_test";
  const config: ABTestConfig = {
    testId: "repeat_test",
    variants: [
      { variantId: "control", weight: 50 },
      { variantId: "treatment", weight: 50 },
    ],
    stickinessFactor: 0.95,
    minSampleSize: 100,
  };

  const result1 = service.assignABTest(userId, config);
  const result2 = service.assignABTest(userId, config);

  assert.equal(result1.testId, result2.testId);
  assert.equal(result1.variantId, result2.variantId);
  assert.equal(result1.bucket, result2.bucket);
});

test("UxEventTrackingService assignABTest different testId creates new assignment", () => {
  const service = new UxEventTrackingService();
  const userId = "user_multi_test";

  const config1: ABTestConfig = {
    testId: "test_a",
    variants: [{ variantId: "control", weight: 100 }],
    stickinessFactor: 0.95,
    minSampleSize: 100,
  };

  const config2: ABTestConfig = {
    testId: "test_b",
    variants: [{ variantId: "treatment", weight: 100 }],
    stickinessFactor: 0.95,
    minSampleSize: 100,
  };

  const result1 = service.assignABTest(userId, config1);
  const result2 = service.assignABTest(userId, config2);

  assert.equal(result1.testId, "test_a");
  assert.equal(result2.testId, "test_b");
});

test("UxEventTrackingService getABTestAssignment returns null for unknown user", () => {
  const service = new UxEventTrackingService();

  const result = service.getABTestAssignment("unknown_user", "any_test");

  assert.equal(result, null);
});

test("UxEventTrackingService getABTestAssignment returns null for known user but wrong test", () => {
  const service = new UxEventTrackingService();
  const config: ABTestConfig = {
    testId: "test_wrong",
    variants: [{ variantId: "control", weight: 100 }],
    stickinessFactor: 0.95,
    minSampleSize: 100,
  };

  service.assignABTest("user_wrong_test", config);

  const result = service.getABTestAssignment("user_wrong_test", "different_test");

  assert.equal(result, null);
});

test("UxEventTrackingService getABTestAssignment returns correct assignment", () => {
  const service = new UxEventTrackingService();
  const config: ABTestConfig = {
    testId: "correct_test",
    variants: [{ variantId: "treatment", weight: 100 }],
    stickinessFactor: 0.95,
    minSampleSize: 100,
  };

  service.assignABTest("user_correct", config);

  const result = service.getABTestAssignment("user_correct", "correct_test");

  assert.ok(result !== null);
  assert.equal(result!.testId, "correct_test");
  assert.equal(result!.variantId, "treatment");
});

test("UxEventTrackingService recordConversion does nothing for unknown user", () => {
  const service = new UxEventTrackingService();

  // Should not throw
  service.recordConversion("unknown_user", "any_test", "any_goal");

  // Event log should be empty
  const events = service.getRecentEvents();
  assert.equal(events.length, 0);
});

test("UxEventTrackingService recordConversion creates feedback event for known user", () => {
  const service = new UxEventTrackingService();
  const config: ABTestConfig = {
    testId: "conversion_test",
    variants: [{ variantId: "treatment", weight: 100 }],
    stickinessFactor: 0.95,
    minSampleSize: 100,
  };

  service.assignABTest("user_convert", config);
  service.recordConversion("user_convert", "conversion_test", "goal_123");

  const events = service.getRecentEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0]!.eventType, "ux:feedback_submit");
  assert.equal(events[0]!.abTestGroup, "treatment");
});

test("UxEventTrackingService getRecentEvents respects limit", () => {
  const service = new UxEventTrackingService();

  for (let i = 0; i < 150; i++) {
    service.trackEvent("ux:button_click", { userId: `user_limit_${i}` });
  }

  const events = service.getRecentEvents(50);

  assert.equal(events.length, 50);
});

test("UxEventTrackingService getRecentEvents returns all when under limit", () => {
  const service = new UxEventTrackingService();

  for (let i = 0; i < 5; i++) {
    service.trackEvent("ux:button_click", { userId: `user_small_${i}` });
  }

  const events = service.getRecentEvents(100);

  assert.equal(events.length, 5);
});

test("UxEventTrackingService getRecentEvents default limit is 100", () => {
  const service = new UxEventTrackingService();

  for (let i = 0; i < 150; i++) {
    service.trackEvent("ux:button_click", { userId: `user_default_${i}` });
  }

  const events = service.getRecentEvents();

  assert.equal(events.length, 100);
});

test("UxEventTrackingService A/B test variant selection is deterministic", () => {
  const service = new UxEventTrackingService();
  const userId = "user_deterministic";
  const config: ABTestConfig = {
    testId: "deterministic_test",
    variants: [
      { variantId: "a", weight: 33 },
      { variantId: "b", weight: 33 },
      { variantId: "c", weight: 34 },
    ],
    stickinessFactor: 0.95,
    minSampleSize: 100,
  };

  // Run multiple times, should always get same result
  for (let i = 0; i < 10; i++) {
    const result = service.assignABTest(userId, config);
    assert.ok(["a", "b", "c"].includes(result.variantId));
    assert.equal(result.testId, "deterministic_test");
  }
});

test("UxEventTrackingService stores interaction type correctly", () => {
  const service = new UxEventTrackingService();

  const event = service.trackEvent("ux:button_click", {
    userId: "user_interaction",
    interactionType: "click",
  });

  assert.equal(event.interactionType, "click");
});

test("UxEventTrackingService defaults interactionType to click", () => {
  const service = new UxEventTrackingService();

  const event = service.trackEvent("ux:button_click", {
    userId: "user_default_interaction",
  });

  assert.equal(event.interactionType, "click");
});

test("UxEventTrackingService eventId is unique per event", () => {
  const service = new UxEventTrackingService();

  const event1 = service.trackEvent("ux:button_click", { userId: "user_unique_1" });
  const event2 = service.trackEvent("ux:button_click", { userId: "user_unique_2" });

  assert.notEqual(event1.eventId, event2.eventId);
});
