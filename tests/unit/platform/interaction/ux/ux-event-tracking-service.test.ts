import test from "node:test";
import { strict as assert } from "node:assert/strict";
import { UxEventTrackingService } from "../../../../../src/interaction/ux/ux-event-tracking-service.js";

test("UxEventTrackingService trackEvent returns track entry", () => {
  const service = new UxEventTrackingService();
  const event = service.trackEvent("ux:button_click", { userId: "user-1" });

  assert.ok(event.eventId.startsWith("uxevt_"));
  assert.strictEqual(event.eventType, "ux:button_click");
  assert.strictEqual(event.userId, "user-1");
  assert.ok(event.occurredAt.length > 0);
});

test("UxEventTrackingService trackEvent with optional fields", () => {
  const service = new UxEventTrackingService();
  const event = service.trackEvent("ux:form_submit", {
    userId: "user-1",
    sessionId: "session-1",
    taskId: "task-1",
    abTestGroup: "treatment",
    metadata: { formId: "contact-form" },
  });

  assert.strictEqual(event.sessionId, "session-1");
  assert.strictEqual(event.taskId, "task-1");
  assert.strictEqual(event.abTestGroup, "treatment");
  assert.deepStrictEqual(event.metadata, { formId: "contact-form" });
});

test("UxEventTrackingService getRecentEvents returns events", () => {
  const service = new UxEventTrackingService();
  service.trackEvent("ux:button_click", { userId: "user-1" });
  service.trackEvent("ux:navigation", { userId: "user-1" });

  const events = service.getRecentEvents(10);

  assert.strictEqual(events.length, 2);
});

test("UxEventTrackingService getRecentEvents respects limit", () => {
  const service = new UxEventTrackingService();
  for (let i = 0; i < 5; i++) {
    service.trackEvent("ux:button_click", { userId: "user-1" });
  }

  const events = service.getRecentEvents(3);

  assert.strictEqual(events.length, 3);
});

test("UxEventTrackingService assignABTest assigns user to variant", () => {
  const service = new UxEventTrackingService();
  const assignment = service.assignABTest("user-1", {
    testId: "onboarding_v2",
    variants: [
      { variantId: "control", weight: 50 },
      { variantId: "treatment", weight: 50 },
    ],
    stickinessFactor: 0.95,
    minSampleSize: 100,
  });

  assert.strictEqual(assignment.testId, "onboarding_v2");
  assert.ok(["control", "treatment"].includes(assignment.variantId));
  assert.ok(assignment.bucket >= 0 && assignment.bucket < 100);
});

test("UxEventTrackingService assignABTest is sticky for same user", () => {
  const service = new UxEventTrackingService();
  const first = service.assignABTest("user-1", {
    testId: "test_1",
    variants: [{ variantId: "control", weight: 50 }, { variantId: "treatment", weight: 50 }],
    stickinessFactor: 0.95,
    minSampleSize: 100,
  });

  const second = service.assignABTest("user-1", {
    testId: "test_1",
    variants: [{ variantId: "control", weight: 50 }, { variantId: "treatment", weight: 50 }],
    stickinessFactor: 0.95,
    minSampleSize: 100,
  });

  assert.strictEqual(first.variantId, second.variantId);
  assert.strictEqual(first.bucket, second.bucket);
});

test("UxEventTrackingService assignABTest different testId returns new assignment", () => {
  const service = new UxEventTrackingService();
  service.assignABTest("user-1", {
    testId: "test_1",
    variants: [{ variantId: "control", weight: 100 }],
    stickinessFactor: 0.95,
    minSampleSize: 100,
  });

  const second = service.assignABTest("user-1", {
    testId: "test_2",
    variants: [{ variantId: "control", weight: 100 }],
    stickinessFactor: 0.95,
    minSampleSize: 100,
  });

  assert.strictEqual(second.testId, "test_2");
});

test("UxEventTrackingService getABTestAssignment returns assignment", () => {
  const service = new UxEventTrackingService();
  service.assignABTest("user-1", {
    testId: "test_1",
    variants: [{ variantId: "control", weight: 100 }],
    stickinessFactor: 0.95,
    minSampleSize: 100,
  });

  const assignment = service.getABTestAssignment("user-1", "test_1");

  assert.ok(assignment !== null);
  assert.strictEqual(assignment!.testId, "test_1");
});

test("UxEventTrackingService getABTestAssignment returns null for unknown user", () => {
  const service = new UxEventTrackingService();
  const assignment = service.getABTestAssignment("unknown-user", "test_1");

  assert.strictEqual(assignment, null);
});

test("UxEventTrackingService getABTestAssignment returns null for different test", () => {
  const service = new UxEventTrackingService();
  service.assignABTest("user-1", {
    testId: "test_1",
    variants: [{ variantId: "control", weight: 100 }],
    stickinessFactor: 0.95,
    minSampleSize: 100,
  });

  const assignment = service.getABTestAssignment("user-1", "test_2");

  assert.strictEqual(assignment, null);
});

test("UxEventTrackingService recordConversion tracks conversion event", () => {
  const service = new UxEventTrackingService();
  service.assignABTest("user-1", {
    testId: "onboarding_v2",
    variants: [{ variantId: "treatment", weight: 100 }],
    stickinessFactor: 0.95,
    minSampleSize: 100,
  });

  service.recordConversion("user-1", "onboarding_v2", "signup_goal");

  const events = service.getRecentEvents(10);
  const conversionEvent = events.find((e) => e.eventType === "ux:feedback_submit");

  assert.ok(conversionEvent !== undefined);
});

test("UxEventTrackingService trackEvent interactionType defaults to click", () => {
  const service = new UxEventTrackingService();
  const event = service.trackEvent("ux:button_click", { userId: "user-1" });

  assert.strictEqual(event.interactionType, "click");
});

test("UxEventTrackingService trackEvent interactionType can be set", () => {
  const service = new UxEventTrackingService();
  const event = service.trackEvent("ux:form_submit", {
    userId: "user-1",
    interactionType: "submit",
  });

  assert.strictEqual(event.interactionType, "submit");
});

test("UxEventTrackingService assignABTest with weighted variants", () => {
  const service = new UxEventTrackingService();
  const assignment = service.assignABTest("user-1", {
    testId: "test_weighted",
    variants: [
      { variantId: "control", weight: 80 },
      { variantId: "treatment", weight: 20 },
    ],
    stickinessFactor: 0.95,
    minSampleSize: 100,
  });

  assert.ok(["control", "treatment"].includes(assignment.variantId));
});

test("UxEventTrackingService getRecentEvents with default limit", () => {
  const service = new UxEventTrackingService();
  for (let i = 0; i < 150; i++) {
    service.trackEvent("ux:button_click", { userId: "user-1" });
  }

  const events = service.getRecentEvents();

  assert.strictEqual(events.length, 100);
});
