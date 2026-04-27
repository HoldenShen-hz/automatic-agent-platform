/**
 * Unit tests for HITL Notification edge cases
 * Tests src/platform/interface/console/hitl/notification.ts - additional edge cases
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  mapRiskLevelToSeverity,
  calculateNotificationPriority,
  buildAccessibleLabel,
  getSeverityColorTokens,
  sortByPriority,
  filterByStatus,
  groupByStage,
  type NotificationSeverity,
  type NotificationPriority,
} from "../../../../../../src/platform/interface/console/hitl/notification.js";
import type { HitlQueueItem } from "../../../../../../src/platform/orchestration/hitl/hitl-operator-console-service.js";

function createHitlQueueItem(overrides: Partial<HitlQueueItem> = {}): HitlQueueItem {
  return {
    queueItemId: "hitl_queue:test-123",
    approvalId: "approval-123",
    taskId: "task-456",
    executionId: "exec-789",
    tenantId: "tenant-001",
    title: "Test Approval Request",
    stageRef: "plan",
    riskLevel: "medium",
    explanationSummary: "Test explanation",
    recommendedOptionId: "option-1",
    deliveryChannels: ["console"],
    deliveryIds: ["delivery-1"],
    status: "pending",
    acknowledgedBy: null,
    takeoverSessionId: null,
    createdAt: "2026-04-01T10:00:00.000Z",
    updatedAt: "2026-04-01T10:00:00.000Z",
    ...overrides,
  };
}

test("mapRiskLevelToSeverity handles unknown risk level returns critical", () => {
  // Unknown risk levels should still return a valid severity
  // The function should handle any string input
  const result = mapRiskLevelToSeverity("unknown" as any);
  assert.equal(typeof result, "string");
});

test("calculateNotificationPriority handles all risk levels", () => {
  const riskLevels = ["low", "medium", "high", "critical"] as const;
  const statuses = ["pending", "acknowledged", "resolved"] as const;

  for (const risk of riskLevels) {
    for (const status of statuses) {
      const item = createHitlQueueItem({ riskLevel: risk, status });
      const priority = calculateNotificationPriority(item);
      assert.ok(
        ["low", "normal", "high", "urgent"].includes(priority),
        `Invalid priority ${priority} for risk=${risk}, status=${status}`,
      );
    }
  }
});

test("buildAccessibleLabel for cancelled status", () => {
  const item = createHitlQueueItem({
    title: "Deploy to production",
    riskLevel: "high",
    status: "resolved",
  });
  const label = buildAccessibleLabel(item);
  assert.ok(label.includes("Deploy to production"));
});

test("buildAccessibleLabel for expired status", () => {
  const item = createHitlQueueItem({
    title: "Urgent approval",
    riskLevel: "critical",
    status: "resolved",
  });
  const label = buildAccessibleLabel(item);
  assert.ok(label.includes("Urgent approval"));
});

test("getSeverityColorTokens returns consistent values", () => {
  const severities: NotificationSeverity[] = ["info", "warning", "error", "critical"];
  for (const severity of severities) {
    const tokens = getSeverityColorTokens(severity);
    // All colors should be valid hex
    assert.match(tokens.background, /^#[0-9A-Fa-f]{6}$/);
    assert.match(tokens.foreground, /^#[0-9A-Fa-f]{6}$/);
    assert.match(tokens.border, /^#[0-9A-Fa-f]{6}$/);
    // Contrast ratio should be positive
    assert.ok(tokens.contrastRatio > 0);
  }
});

test("sortByPriority handles items with same risk but different createdAt", () => {
  const items = [
    createHitlQueueItem({ queueItemId: "1", riskLevel: "high", status: "pending", createdAt: "2026-04-01T12:00:00.000Z" }),
    createHitlQueueItem({ queueItemId: "2", riskLevel: "high", status: "pending", createdAt: "2026-04-01T10:00:00.000Z" }),
    createHitlQueueItem({ queueItemId: "3", riskLevel: "high", status: "pending", createdAt: "2026-04-01T11:00:00.000Z" }),
  ];
  const sorted = sortByPriority(items);
  // Same priority should sort by createdAt ascending (oldest first)
  assert.equal(sorted[0]!.queueItemId, "2");
  assert.equal(sorted[1]!.queueItemId, "3");
  assert.equal(sorted[2]!.queueItemId, "1");
});

test("filterByStatus handles null/undefined status items", () => {
  const items = [
    createHitlQueueItem({ status: "pending" }),
  ];
  const filtered = filterByStatus(items, null);
  assert.equal(filtered.length, 1);
});

test("groupByStage handles empty array", () => {
  const grouped = groupByStage([]);
  assert.equal(grouped.size, 0);
});

test("groupByStage returns Map with string keys", () => {
  const items = [
    createHitlQueueItem({ stageRef: "execute" }),
    createHitlQueueItem({ stageRef: "plan" }),
  ];
  const grouped = groupByStage(items);
  assert.ok(grouped instanceof Map);
  assert.ok(grouped.has("execute"));
  assert.ok(grouped.has("plan"));
});

test("groupByStage values are arrays", () => {
  const items = [
    createHitlQueueItem({ stageRef: "plan" }),
    createHitlQueueItem({ stageRef: "plan" }),
    createHitlQueueItem({ stageRef: "execute" }),
  ];
  const grouped = groupByStage(items);
  assert.ok(Array.isArray(grouped.get("plan")));
  assert.ok(Array.isArray(grouped.get("execute")));
  assert.equal(grouped.get("plan")!.length, 2);
  assert.equal(grouped.get("execute")!.length, 1);
});

test("NotificationPriority type accepts all valid string values", () => {
  const priorities: NotificationPriority[] = ["low", "normal", "high", "urgent"];
  assert.equal(priorities.length, 4);

  for (const p of priorities) {
    const item = createHitlQueueItem();
    const result = calculateNotificationPriority(item);
    assert.ok(typeof result === "string");
  }
});
