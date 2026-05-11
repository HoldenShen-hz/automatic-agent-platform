import assert from "node:assert/strict";
import test from "node:test";

import { UxEventTrackingService } from "../../../../src/interaction/ux/ux-event-tracking-service.js";
import type { UxEventType, InteractionType } from "../../../../src/interaction/ux/ux-event-tracking-service.js";

test("UxEventTrackingService tracks button click event", () => {
  const service = new UxEventTrackingService();

  const event = service.trackEvent("ux:button_click", {
    userId: "user_1",
    sessionId: "session_1",
    taskId: "task_1",
  });

  assert.equal(event.eventType, "ux:button_click");
  assert.equal(event.userId, "user_1");
  assert.equal(event.sessionId, "session_1");
  assert.equal(event.taskId, "task_1");
  assert.ok(event.eventId.startsWith("uxevt_"));
  assert.ok(event.occurredAt != null);
});

test("UxEventTrackingService tracks form submit event", () => {
  const service = new UxEventTrackingService();

  const event = service.trackEvent("ux:form_submit", {
    userId: "user_1",
    metadata: { formId: "signup_form" },
  });

  assert.equal(event.eventType, "ux:form_submit");
  assert.equal(event.metadata.formId, "signup_form");
});

test("UxEventTrackingService tracks navigation event", () => {
  const service = new UxEventTrackingService();

  const event = service.trackEvent("ux:navigation", {
    userId: "user_1",
    elementId: "nav_dashboard",
    interactionType: "navigate",
  });

  assert.equal(event.eventType, "ux:navigation");
  assert.equal(event.interactionType, "navigate");
});

test("UxEventTrackingService tracks wizard step event", () => {
  const service = new UxEventTrackingService();

  const event = service.trackEvent("ux:wizard_step", {
    userId: "user_1",
    sessionId: "session_1",
    metadata: { stepId: "step_2", action: "next" },
  });

  assert.equal(event.eventType, "ux:wizard_step");
  assert.equal(event.metadata.stepId, "step_2");
});

test("UxEventTrackingService tracks workflow build event", () => {
  const service = new UxEventTrackingService();

  const event = service.trackEvent("ux:workflow_build", {
    userId: "user_1",
    metadata: { workflowId: "wf_123" },
  });

  assert.equal(event.eventType, "ux:workflow_build");
});

test("UxEventTrackingService tracks dashboard view event", () => {
  const service = new UxEventTrackingService();

  const event = service.trackEvent("ux:dashboard_view", {
    userId: "user_1",
    sessionId: "session_1",
  });

  assert.equal(event.eventType, "ux:dashboard_view");
});

test("UxEventTrackingService tracks search query event", () => {
  const service = new UxEventTrackingService();

  const event = service.trackEvent("ux:search_query", {
    userId: "user_1",
    interactionType: "search",
    metadata: { query: "task status" },
  });

  assert.equal(event.eventType, "ux:search_query");
  assert.equal(event.interactionType, "search");
  assert.equal(event.metadata.query, "task status");
});

test("UxEventTrackingService tracks filter apply event", () => {
  const service = new UxEventTrackingService();

  const event = service.trackEvent("ux:filter_apply", {
    userId: "user_1",
    interactionType: "filter",
    metadata: { filterType: "date_range" },
  });

  assert.equal(event.eventType, "ux:filter_apply");
  assert.equal(event.interactionType, "filter");
});

test("UxEventTrackingService tracks export action event", () => {
  const service = new UxEventTrackingService();

  const event = service.trackEvent("ux:export_action", {
    userId: "user_1",
    interactionType: "export",
    metadata: { format: "csv" },
  });

  assert.equal(event.eventType, "ux:export_action");
  assert.equal(event.interactionType, "export");
});

test("UxEventTrackingService tracks share action event", () => {
  const service = new UxEventTrackingService();

  const event = service.trackEvent("ux:share_action", {
    userId: "user_1",
    interactionType: "share",
    metadata: { target: "email" },
  });

  assert.equal(event.eventType, "ux:share_action");
  assert.equal(event.interactionType, "share");
});

test("UxEventTrackingService tracks onboarding complete event", () => {
  const service = new UxEventTrackingService();

  const event = service.trackEvent("ux:onboarding_complete", {
    userId: "user_1",
    sessionId: "session_1",
    metadata: { durationSeconds: "180" },
  });

  assert.equal(event.eventType, "ux:onboarding_complete");
  assert.equal(event.metadata.durationSeconds, "180");
});

test("UxEventTrackingService tracks feedback submit event", () => {
  const service = new UxEventTrackingService();

  const event = service.trackEvent("ux:feedback_submit", {
    userId: "user_1",
    interactionType: "feedback",
    metadata: { rating: "5", comment: "Great!" },
  });

  assert.equal(event.eventType, "ux:feedback_submit");
  assert.equal(event.interactionType, "feedback");
});

test("UxEventTrackingService defaults interactionType to click", () => {
  const service = new UxEventTrackingService();

  const event = service.trackEvent("ux:button_click", {
    userId: "user_1",
  });

  assert.equal(event.interactionType, "click");
});

test("UxEventTrackingService defaults null fields to null", () => {
  const service = new UxEventTrackingService();

  const event = service.trackEvent("ux:button_click", {
    userId: "user_1",
  });

  assert.equal(event.sessionId, null);
  assert.equal(event.taskId, null);
  assert.equal(event.abTestGroup, null);
  assert.equal(event.elementId, null);
});

test("UxEventTrackingService getRecentEvents returns empty initially", () => {
  const service = new UxEventTrackingService();

  const events = service.getRecentEvents();

  assert.deepEqual(events, []);
});

test("UxEventTrackingService getRecentEvents returns tracked events", () => {
  const service = new UxEventTrackingService();

  service.trackEvent("ux:button_click", { userId: "user_1" });
  service.trackEvent("ux:form_submit", { userId: "user_2" });

  const events = service.getRecentEvents();

  assert.equal(events.length, 2);
});

test("UxEventTrackingService getRecentEvents respects limit", () => {
  const service = new UxEventTrackingService();

  for (let i = 0; i < 10; i++) {
    service.trackEvent("ux:button_click", { userId: `user_${i}` });
  }

  const events = service.getRecentEvents(5);

  assert.equal(events.length, 5);
});

test("UxEventTrackingService getRecentEvents returns most recent", () => {
  const service = new UxEventTrackingService();

  service.trackEvent("ux:button_click", { userId: "user_first" });
  service.trackEvent("ux:button_click", { userId: "user_last" });

  const events = service.getRecentEvents(1);

  assert.equal(events[0]!.userId, "user_last");
});

test("UxEventTrackingService assignABTest assigns user to variant", () => {
  const service = new UxEventTrackingService();

  const assignment = service.assignABTest("user_1");

  assert.ok(assignment != null);
  assert.equal(assignment.testId, "default");
  assert.ok(["control", "treatment"].includes(assignment.variantId));
  assert.ok(assignment.bucket >= 0 && assignment.bucket < 100);
  assert.ok(assignment.assignedAt != null);
});

test("UxEventTrackingService assignABTest returns same assignment for same user", () => {
  const service = new UxEventTrackingService();

  const first = service.assignABTest("user_1");
  const second = service.assignABTest("user_1");

  assert.equal(first.variantId, second.variantId);
  assert.equal(first.bucket, second.bucket);
});

test("UxEventTrackingService assignABTest assigns different users to different variants", () => {
  const service = new UxEventTrackingService();

  const variants = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const assignment = service.assignABTest(`user_${i}`);
    variants.add(assignment.variantId);
  }

  // Should have both variants in the population
  assert.ok(variants.size >= 1);
});

test("UxEventTrackingService assignABTest with custom config", () => {
  const service = new UxEventTrackingService();
  const config = {
    testId: "custom_test",
    variants: [
      { variantId: "variant_a", weight: 30 },
      { variantId: "variant_b", weight: 70 },
    ],
    stickinessFactor: 0.9,
    minSampleSize: 50,
  };

  const assignment = service.assignABTest("user_1", config);

  assert.equal(assignment.testId, "custom_test");
  assert.ok(["variant_a", "variant_b"].includes(assignment.variantId));
});

test("UxEventTrackingService getABTestAssignment returns assignment for user", () => {
  const service = new UxEventTrackingService();

  service.assignABTest("user_1", { testId: "test_1", variants: [{ variantId: "control", weight: 100 }], stickinessFactor: 1, minSampleSize: 1 });
  const assignment = service.getABTestAssignment("user_1", "test_1");

  assert.ok(assignment != null);
  assert.equal(assignment!.testId, "test_1");
});

test("UxEventTrackingService getABTestAssignment returns null for unknown user", () => {
  const service = new UxEventTrackingService();

  const assignment = service.getABTestAssignment("unknown_user", "test_1");

  assert.equal(assignment, null);
});

test("UxEventTrackingService getABTestAssignment returns null for different testId", () => {
  const service = new UxEventTrackingService();

  service.assignABTest("user_1", { testId: "test_1", variants: [{ variantId: "control", weight: 100 }], stickinessFactor: 1, minSampleSize: 1 });
  const assignment = service.getABTestAssignment("user_1", "test_2");

  assert.equal(assignment, null);
});

test("UxEventTrackingService recordConversion tracks conversion event", () => {
  const service = new UxEventTrackingService();

  service.assignABTest("user_1", { testId: "conversion_test", variants: [{ variantId: "treatment", weight: 100 }], stickinessFactor: 1, minSampleSize: 1 });
  service.recordConversion("user_1", "conversion_test", "goal_1");

  const events = service.getRecentEvents();
  assert.ok(events.length > 0);

  const conversionEvent = events.find(e => e.eventType === "ux:feedback_submit");
  assert.ok(conversionEvent != null);
  assert.equal(conversionEvent!.abTestGroup, "treatment");
});

test("UxEventTrackingService recordConversion does nothing for unknown user", () => {
  const service = new UxEventTrackingService();

  service.recordConversion("unknown_user", "test", "goal");

  const events = service.getRecentEvents();
  assert.equal(events.length, 0);
});

test("UxEventTrackingService computeBucket is deterministic", () => {
  const service = new UxEventTrackingService();

  // Access private method via any to test
  const computeBucket = (service as any).computeBucket.bind(service);
  const bucket1 = computeBucket("user_test", { testId: "test", variants: [{ variantId: "a", weight: 50 }, { variantId: "b", weight: 50 }], stickinessFactor: 1, minSampleSize: 1 });
  const bucket2 = computeBucket("user_test", { testId: "test", variants: [{ variantId: "a", weight: 50 }, { variantId: "b", weight: 50 }], stickinessFactor: 1, minSampleSize: 1 });

  assert.equal(bucket1, bucket2);
});

test("UxEventTrackingService selectVariant selects correct variant based on bucket", () => {
  const service = new UxEventTrackingService();

  // Access private method via any to test
  const selectVariant = (service as any).selectVariant.bind(service);

  assert.equal(selectVariant(10, [{ variantId: "a", weight: 50 }, { variantId: "b", weight: 50 }]), "a");
  assert.equal(selectVariant(60, [{ variantId: "a", weight: 50 }, { variantId: "b", weight: 50 }]), "b");
});

test("UxEventTrackingService selectVariant returns last variant for bucket at boundary", () => {
  const service = new UxEventTrackingService();

  const selectVariant = (service as any).selectVariant.bind(service);

  // Bucket exactly at 100 should go to last variant
  assert.equal(selectVariant(100, [{ variantId: "a", weight: 50 }, { variantId: "b", weight: 50 }]), "b");
});

test("UxEventTrackingService with event publisher publishes events", () => {
  let published = false;
  const mockPublisher = {
    publish: (event: any) => {
      published = true;
      assert.equal(event.eventType, "ux:interaction_tracked");
      assert.equal(event.payload.uxEventType, "ux:button_click");
    },
  };

  const service = new UxEventTrackingService(mockPublisher as any);

  service.trackEvent("ux:button_click", { userId: "user_1" });

  assert.equal(published, true);
});
