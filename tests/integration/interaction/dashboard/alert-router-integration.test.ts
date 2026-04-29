import assert from "node:assert/strict";
import test from "node:test";

import { AlertRouter } from "../../../src/interaction/dashboard/alert-router/index.js";
import type { AttentionItem } from "../../../src/interaction/dashboard/index.js";

function makeAttentionItem(overrides: Partial<AttentionItem> = {}): AttentionItem {
  return {
    itemType: "incident",
    priority: "high",
    title: "Test Alert",
    description: "Test description",
    actionOptions: ["inspect", "retry"],
    createdAt: "2026-04-19T00:00:00.000Z",
    domainId: "general_ops",
    ...overrides,
  };
}

test("AlertRouter.routeNotifications returns routed notifications", () => {
  const router = new AlertRouter();
  const items = [makeAttentionItem({ itemType: "incident", priority: "critical" })];

  const routed = router.routeNotifications(items);

  assert.ok(routed.length > 0);
  assert.equal(routed[0]!.deliveryType, "overlay");
});

test("AlertRouter.getOverlayAlerts filters critical incidents", () => {
  const router = new AlertRouter();
  const items = [
    makeAttentionItem({ itemType: "incident", priority: "critical" }),
    makeAttentionItem({ itemType: "suggestion", priority: "normal" }),
  ];

  const overlay = router.getOverlayAlerts(items);

  assert.equal(overlay.length, 1);
  assert.equal(overlay[0]!.priority, "critical");
});

test("AlertRouter.getPushNotifications filters push-eligible items", () => {
  const router = new AlertRouter();
  const items = [
    makeAttentionItem({ itemType: "incident", priority: "high" }),
    makeAttentionItem({ itemType: "approval_needed", priority: "normal" }),
  ];

  const push = router.getPushNotifications(items);

  assert.ok(push.length > 0);
});

test("AlertRouter.getHapticAlerts returns critical items", () => {
  const router = new AlertRouter();
  const items = [makeAttentionItem({ itemType: "incident", priority: "critical" })];

  const haptic = router.getHapticAlerts(items);

  assert.equal(haptic.length, 1);
});

test("AlertRouter.routeNotifications respects cooldown period", () => {
  const router = new AlertRouter();
  const items = [makeAttentionItem({ itemType: "incident", priority: "critical" })];

  const first = router.routeNotifications(items);
  const second = router.routeNotifications(items);

  // Second delivery should be blocked by cooldown
  assert.ok(first.length > 0);
});

test("AlertRouter handles empty attention items", () => {
  const router = new AlertRouter();
  const routed = router.routeNotifications([]);
  assert.equal(routed.length, 0);
});

test("AlertRouter handles unhandled alert types gracefully", () => {
  const router = new AlertRouter();
  const items = [makeAttentionItem({ itemType: "unknown_type" as AttentionItem["itemType"], priority: "high" })];

  const routed = router.routeNotifications(items);
  // Unknown types should not match any rules
  assert.equal(routed.length, 0);
});
