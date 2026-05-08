import assert from "node:assert/strict";
import test from "node:test";

import {
  sortAttentionQueue,
  AlertRouter,
  type NotificationDeliveryType,
} from "../../../../../src/interaction/dashboard/alert-router/index.js";

interface AttentionItem {
  readonly id: string;
  readonly itemType: "incident" | "approval_needed" | "budget_warning" | "quality_alert" | "suggestion";
  readonly priority: "critical" | "high" | "normal" | "low";
  readonly createdAt: string;
  readonly message: string;
  readonly domainId: string;
}

function makeItem(overrides: Partial<AttentionItem> = {}): AttentionItem {
  return {
    id: "item-1",
    itemType: "suggestion",
    priority: "normal",
    createdAt: "2026-04-01T00:00:00.000Z",
    message: "Test item",
    domainId: "test-domain",
    ...overrides,
  };
}

test("sortAttentionQueue returns empty array for empty input", () => {
  const result = sortAttentionQueue([]);

  assert.equal(result.length, 0);
});

test("sortAttentionQueue sorts by priority critical first", () => {
  const items = [
    makeItem({ id: "low", priority: "low", createdAt: "2026-04-01T00:00:00.000Z" }),
    makeItem({ id: "critical", priority: "critical", createdAt: "2026-04-01T00:00:00.000Z" }),
    makeItem({ id: "high", priority: "high", createdAt: "2026-04-01T00:00:00.000Z" }),
  ];

  const result = sortAttentionQueue(items);

  assert.equal(result[0]?.id, "critical");
  assert.equal(result[1]?.id, "high");
  assert.equal(result[2]?.id, "low");
});

test("sortAttentionQueue sorts by priority high before normal", () => {
  const items = [
    makeItem({ id: "normal", priority: "normal", createdAt: "2026-04-01T00:00:00.000Z" }),
    makeItem({ id: "high", priority: "high", createdAt: "2026-04-01T00:00:00.000Z" }),
  ];

  const result = sortAttentionQueue(items);

  assert.equal(result[0]?.id, "high");
  assert.equal(result[1]?.id, "normal");
});

test("sortAttentionQueue sorts by priority normal before low", () => {
  const items = [
    makeItem({ id: "low", priority: "low", createdAt: "2026-04-01T00:00:00.000Z" }),
    makeItem({ id: "normal", priority: "normal", createdAt: "2026-04-01T00:00:00.000Z" }),
  ];

  const result = sortAttentionQueue(items);

  assert.equal(result[0]?.id, "normal");
  assert.equal(result[1]?.id, "low");
});

test("sortAttentionQueue sorts by createdAt within same priority", () => {
  const items = [
    makeItem({ id: "later", priority: "normal", createdAt: "2026-04-02T00:00:00.000Z" }),
    makeItem({ id: "earlier", priority: "normal", createdAt: "2026-04-01T00:00:00.000Z" }),
  ];

  const result = sortAttentionQueue(items);

  assert.equal(result[0]?.id, "later");
  assert.equal(result[1]?.id, "earlier");
});

test("sortAttentionQueue does not mutate original array", () => {
  const items = [
    makeItem({ id: "item", priority: "high", createdAt: "2026-04-01T00:00:00.000Z" }),
  ];

  sortAttentionQueue(items);

  assert.equal(items[0]?.id, "item");
});

test("sortAttentionQueue handles all same priority", () => {
  const items = [
    makeItem({ id: "c", priority: "normal", createdAt: "2026-04-03T00:00:00.000Z" }),
    makeItem({ id: "a", priority: "normal", createdAt: "2026-04-01T00:00:00.000Z" }),
    makeItem({ id: "b", priority: "normal", createdAt: "2026-04-02T00:00:00.000Z" }),
  ];

  const result = sortAttentionQueue(items);

  assert.equal(result[0]?.id, "c");
  assert.equal(result[1]?.id, "b");
  assert.equal(result[2]?.id, "a");
});

test("sortAttentionQueue handles mixed priorities and times", () => {
  const items = [
    makeItem({ id: "late-high", priority: "high", createdAt: "2026-04-05T00:00:00.000Z" }),
    makeItem({ id: "early-critical", priority: "critical", createdAt: "2026-04-01T00:00:00.000Z" }),
    makeItem({ id: "early-normal", priority: "normal", createdAt: "2026-04-01T00:00:00.000Z" }),
  ];

  const result = sortAttentionQueue(items);

  // critical always comes before high, even if high is earlier
  assert.equal(result[0]?.id, "early-critical");
  assert.equal(result[1]?.id, "late-high");
  assert.equal(result[2]?.id, "early-normal");
});

test("sortAttentionQueue handles single item", () => {
  const items = [makeItem({ id: "only" })];

  const result = sortAttentionQueue(items);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, "only");
});

test("sortAttentionQueue preserves readonly input", () => {
  const items: readonly AttentionItem[] = [
    makeItem({ id: "a", priority: "low", createdAt: "2026-04-01T00:00:00.000Z" }),
    makeItem({ id: "b", priority: "critical", createdAt: "2026-04-01T00:00:00.000Z" }),
  ];

  const result = sortAttentionQueue(items);

  assert.equal(result[0]?.id, "b");
});

test("AlertRouter.routeNotifications routes critical incident to overlay/push/haptic", () => {
  const router = new AlertRouter();
  const items = [
    makeItem({ id: "alert-1", itemType: "incident", priority: "critical" }),
  ];

  const routed = router.routeNotifications(items);

  assert.equal(routed.length, 3);
  const deliveryTypes = routed.map((r) => r.deliveryType).sort();
  assert.deepEqual(deliveryTypes, ["haptic", "overlay", "push"]);
});

test("AlertRouter.routeNotifications routes normal suggestion to push only", () => {
  const router = new AlertRouter();
  const items = [
    makeItem({ id: "alert-2", itemType: "suggestion", priority: "normal" }),
  ];

  const routed = router.routeNotifications(items);

  assert.equal(routed.length, 1);
  assert.equal(routed[0]?.deliveryType, "push");
});

test("AlertRouter.routeNotifications routes low suggestion to no delivery", () => {
  const router = new AlertRouter();
  const items = [
    makeItem({ id: "alert-3", itemType: "suggestion", priority: "low" }),
  ];

  const routed = router.routeNotifications(items);

  assert.equal(routed.length, 0);
});

test("AlertRouter.getOverlayAlerts returns only overlay-eligible items", () => {
  const router = new AlertRouter();
  const items = [
    makeItem({ id: "overlay-1", itemType: "incident", priority: "high" }),
    makeItem({ id: "push-only", itemType: "suggestion", priority: "normal" }),
  ];

  const overlayAlerts = router.getOverlayAlerts(items);

  assert.equal(overlayAlerts.length, 1);
  assert.equal(overlayAlerts[0]?.id, "overlay-1");
});

test("AlertRouter.getPushNotifications returns only push-eligible items", () => {
  const router = new AlertRouter();
  const items = [
    makeItem({ id: "push-1", itemType: "approval_needed", priority: "normal" }),
    makeItem({ id: "no-push", itemType: "suggestion", priority: "low" }),
  ];

  const pushNotifications = router.getPushNotifications(items);

  assert.equal(pushNotifications.length, 1);
  assert.equal(pushNotifications[0]?.id, "push-1");
});

test("AlertRouter.getHapticAlerts returns only haptic-eligible items", () => {
  const router = new AlertRouter();
  const items = [
    makeItem({ id: "haptic-1", itemType: "incident", priority: "critical" }),
    makeItem({ id: "no-haptic", itemType: "approval_needed", priority: "normal" }),
  ];

  const hapticAlerts = router.getHapticAlerts(items);

  assert.equal(hapticAlerts.length, 1);
  assert.equal(hapticAlerts[0]?.id, "haptic-1");
});

test("AlertRouter respects cooldown - second delivery within cooldown is blocked", () => {
  const router = new AlertRouter();
  const item = makeItem({ id: "cooldown-test", itemType: "incident", priority: "critical" });

  const first = router.routeNotifications([item]);
  assert.equal(first.length, 3);

  const second = router.routeNotifications([item]);
  assert.equal(second.length, 0);
});

test("AlertRouter enableOverlay=false disables overlay alerts", () => {
  const router = new AlertRouter({ enableOverlay: false });
  const items = [
    makeItem({ id: "overlay-disabled", itemType: "incident", priority: "critical" }),
  ];

  const overlayAlerts = router.getOverlayAlerts(items);

  assert.equal(overlayAlerts.length, 0);
});

test("AlertRouter enablePush=false disables push notifications", () => {
  const router = new AlertRouter({ enablePush: false });
  const items = [
    makeItem({ id: "push-disabled", itemType: "approval_needed", priority: "normal" }),
  ];

  const pushNotifications = router.getPushNotifications(items);

  assert.equal(pushNotifications.length, 0);
});

test("AlertRouter enableHaptic=false disables haptic alerts", () => {
  const router = new AlertRouter({ enableHaptic: false });
  const items = [
    makeItem({ id: "haptic-disabled", itemType: "incident", priority: "critical" }),
  ];

  const hapticAlerts = router.getHapticAlerts(items);

  assert.equal(hapticAlerts.length, 0);
});

test("AlertRouter.routeNotifications includes targetEndpoint", () => {
  const router = new AlertRouter();
  const items = [
    makeItem({ id: "endpoint-test", itemType: "incident", priority: "critical", domainId: "domain-42" }),
  ];

  const routed = router.routeNotifications(items);

  const overlay = routed.find((r) => r.deliveryType === "overlay");
  assert.ok(overlay);
  assert.equal(overlay.targetEndpoint, "overlay://domain-42/incident");

  const push = routed.find((r) => r.deliveryType === "push");
  assert.ok(push);
  assert.equal(push.targetEndpoint, "push://tenant/domain-42");

  const haptic = routed.find((r) => r.deliveryType === "haptic");
  assert.ok(haptic);
  assert.equal(haptic.targetEndpoint, "haptic://device/domain-42");
});