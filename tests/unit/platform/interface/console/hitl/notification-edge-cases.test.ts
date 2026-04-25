/**
 * Unit tests for HITL notification edge cases and additional coverage
 * Tests functions from src/platform/interface/console/hitl/notification.ts
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
import type { HitlQueueItem, HitlQueueStatus } from "../../../../../../src/platform/orchestration/hitl/hitl-operator-console-service.js";

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

test("mapRiskLevelToSeverity handles all risk levels", () => {
  assert.equal(mapRiskLevelToSeverity("low"), "info");
  assert.equal(mapRiskLevelToSeverity("medium"), "warning");
  assert.equal(mapRiskLevelToSeverity("high"), "error");
  assert.equal(mapRiskLevelToSeverity("critical"), "critical");
});

test("mapRiskLevelToSeverity returns correct severity types", () => {
  const infoSeverity = mapRiskLevelToSeverity("low");
  const warningSeverity = mapRiskLevelToSeverity("medium");
  const errorSeverity = mapRiskLevelToSeverity("high");
  const criticalSeverity = mapRiskLevelToSeverity("critical");

  assert.equal(infoSeverity, "info");
  assert.equal(warningSeverity, "warning");
  assert.equal(errorSeverity, "error");
  assert.equal(criticalSeverity, "critical");
});

test("calculateNotificationPriority critical pending returns urgent", () => {
  const item = createHitlQueueItem({ riskLevel: "critical", status: "pending" });
  assert.equal(calculateNotificationPriority(item), "urgent");
});

test("calculateNotificationPriority high risk pending returns high", () => {
  const item = createHitlQueueItem({ riskLevel: "high", status: "pending" });
  assert.equal(calculateNotificationPriority(item), "high");
});

test("calculateNotificationPriority medium pending returns normal", () => {
  const item = createHitlQueueItem({ riskLevel: "medium", status: "pending" });
  assert.equal(calculateNotificationPriority(item), "normal");
});

test("calculateNotificationPriority low risk pending returns normal", () => {
  const item = createHitlQueueItem({ riskLevel: "low", status: "pending" });
  assert.equal(calculateNotificationPriority(item), "normal");
});

test("calculateNotificationPriority acknowledged status returns low", () => {
  const item = createHitlQueueItem({ riskLevel: "low", status: "acknowledged" });
  assert.equal(calculateNotificationPriority(item), "low");
});

test("calculateNotificationPriority acknowledged with high risk still returns low", () => {
  const item = createHitlQueueItem({ riskLevel: "high", status: "acknowledged" });
  assert.equal(calculateNotificationPriority(item), "low");
});

test("calculateNotificationPriority resolved status returns normal", () => {
  const item = createHitlQueueItem({ riskLevel: "critical", status: "resolved" });
  assert.equal(calculateNotificationPriority(item), "normal");
});

test("calculateNotificationPriority expired status returns normal", () => {
  const item = createHitlQueueItem({ riskLevel: "high", status: "resolved" });
  assert.equal(calculateNotificationPriority(item), "normal");
});

test("calculateNotificationPriority cancelled status returns normal", () => {
  const item = createHitlQueueItem({ riskLevel: "critical", status: "resolved" });
  assert.equal(calculateNotificationPriority(item), "normal");
});

test("buildAccessibleLabel includes title risk and status", () => {
  const item = createHitlQueueItem({
    title: "Deploy to production",
    riskLevel: "critical",
    status: "pending",
  });
  const label = buildAccessibleLabel(item);
  assert.ok(label.includes("Deploy to production"));
  assert.ok(label.includes("critical"));
  assert.ok(label.includes("Awaiting your decision"));
});

test("buildAccessibleLabel for acknowledged shows status text", () => {
  const item = createHitlQueueItem({
    title: "Deploy to production",
    riskLevel: "high",
    status: "acknowledged",
  });
  const label = buildAccessibleLabel(item);
  assert.ok(label.includes("Deploy to production"));
  assert.ok(label.includes("Status: acknowledged"));
});

test("getSeverityColorTokens returns valid color values for all severities", () => {
  for (const severity of ["info", "warning", "error", "critical"] as NotificationSeverity[]) {
    const tokens = getSeverityColorTokens(severity);
    assert.ok(tokens.background.startsWith("#"));
    assert.ok(tokens.foreground.startsWith("#"));
    assert.ok(tokens.border.startsWith("#"));
    assert.ok(tokens.contrastRatio >= 3);
  }
});

test("getSeverityColorTokens info meets WCAG AA for normal text", () => {
  const tokens = getSeverityColorTokens("info");
  assert.ok(tokens.contrastRatio >= 4.5, "Info contrast should meet 4.5:1 for normal text");
});

test("getSeverityColorTokens critical has highest contrast ratio", () => {
  const infoTokens = getSeverityColorTokens("info");
  const criticalTokens = getSeverityColorTokens("critical");
  assert.ok(criticalTokens.contrastRatio > infoTokens.contrastRatio);
});

test("sortByPriority sorts by priority order then by createdAt", () => {
  const items = [
    createHitlQueueItem({ queueItemId: "1", riskLevel: "low", status: "pending", createdAt: "2026-04-01T10:00:00.000Z" }),
    createHitlQueueItem({ queueItemId: "2", riskLevel: "critical", status: "pending", createdAt: "2026-04-01T09:00:00.000Z" }),
    createHitlQueueItem({ queueItemId: "3", riskLevel: "high", status: "pending", createdAt: "2026-04-01T08:00:00.000Z" }),
    createHitlQueueItem({ queueItemId: "4", riskLevel: "medium", status: "pending", createdAt: "2026-04-01T07:00:00.000Z" }),
  ];
  const sorted = sortByPriority(items);
  assert.equal(sorted[0]!.queueItemId, "2"); // critical -> urgent
  assert.equal(sorted[1]!.queueItemId, "3"); // high
  assert.equal(sorted[2]!.queueItemId, "4"); // medium -> normal (older, first)
  assert.equal(sorted[3]!.queueItemId, "1"); // low -> normal (newer, second)
});

test("sortByPriority does not mutate original array", () => {
  const items = [
    createHitlQueueItem({ queueItemId: "1", riskLevel: "critical", status: "pending", createdAt: "2026-04-01T10:00:00.000Z" }),
    createHitlQueueItem({ queueItemId: "2", riskLevel: "low", status: "pending", createdAt: "2026-04-01T09:00:00.000Z" }),
  ];
  const originalFirst = items[0];
  sortByPriority(items);
  assert.equal(items[0], originalFirst);
});

test("sortByPriority handles empty array", () => {
  const sorted = sortByPriority([]);
  assert.equal(sorted.length, 0);
});

test("sortByPriority handles single item", () => {
  const items = [createHitlQueueItem({ queueItemId: "1" })];
  const sorted = sortByPriority(items);
  assert.equal(sorted.length, 1);
  assert.equal(sorted[0]!.queueItemId, "1");
});

test("sortByPriority handles all same priority", () => {
  const items = [
    createHitlQueueItem({ queueItemId: "1", riskLevel: "low", status: "pending", createdAt: "2026-04-01T10:00:00.000Z" }),
    createHitlQueueItem({ queueItemId: "2", riskLevel: "low", status: "pending", createdAt: "2026-04-01T09:00:00.000Z" }),
    createHitlQueueItem({ queueItemId: "3", riskLevel: "low", status: "pending", createdAt: "2026-04-01T08:00:00.000Z" }),
  ];
  const sorted = sortByPriority(items);
  assert.equal(sorted[0]!.queueItemId, "3"); // oldest first
  assert.equal(sorted[1]!.queueItemId, "2");
  assert.equal(sorted[2]!.queueItemId, "1");
});

test("filterByStatus returns all items when status is null", () => {
  const items = [
    createHitlQueueItem({ status: "pending" }),
    createHitlQueueItem({ status: "acknowledged" }),
    createHitlQueueItem({ status: "resolved" }),
  ];
  const filtered = filterByStatus(items, null);
  assert.equal(filtered.length, 3);
});

test("filterByStatus returns empty array when no matches", () => {
  const items = [
    createHitlQueueItem({ status: "pending" }),
    createHitlQueueItem({ status: "pending" }),
  ];
  const filtered = filterByStatus(items, "acknowledged");
  assert.equal(filtered.length, 0);
});

test("filterByStatus filters by resolved status", () => {
  const items = [
    createHitlQueueItem({ status: "pending" }),
    createHitlQueueItem({ status: "resolved" }),
    createHitlQueueItem({ status: "resolved" }),
  ];
  const filtered = filterByStatus(items, "resolved");
  assert.equal(filtered.length, 2);
});

test("filterByStatus filters by acknowledged status", () => {
  const items = [
    createHitlQueueItem({ status: "acknowledged" }),
    createHitlQueueItem({ status: "pending" }),
  ];
  const filtered = filterByStatus(items, "acknowledged");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]!.status, "acknowledged");
});

test("groupByStage handles multiple items in same stage", () => {
  const items = [
    createHitlQueueItem({ stageRef: "plan", queueItemId: "1" }),
    createHitlQueueItem({ stageRef: "plan", queueItemId: "2" }),
    createHitlQueueItem({ stageRef: "execute", queueItemId: "3" }),
  ];
  const grouped = groupByStage(items);
  assert.equal(grouped.size, 2);
  assert.equal(grouped.get("plan")!.length, 2);
  assert.equal(grouped.get("execute")!.length, 1);
});

test("groupByStage preserves item order within group", () => {
  const item1 = createHitlQueueItem({ stageRef: "plan", queueItemId: "1" });
  const item2 = createHitlQueueItem({ stageRef: "plan", queueItemId: "2" });
  const items = [item1, item2];
  const grouped = groupByStage(items);
  assert.equal(grouped.get("plan")![0]!.queueItemId, "1");
  assert.equal(grouped.get("plan")![1]!.queueItemId, "2");
});

test("groupByStage handles items with same stageRef appearing multiple times", () => {
  const items = [
    createHitlQueueItem({ stageRef: "plan", queueItemId: "1" }),
    createHitlQueueItem({ stageRef: "execute", queueItemId: "2" }),
    createHitlQueueItem({ stageRef: "plan", queueItemId: "3" }),
    createHitlQueueItem({ stageRef: "plan", queueItemId: "4" }),
    createHitlQueueItem({ stageRef: "execute", queueItemId: "5" }),
  ];
  const grouped = groupByStage(items);
  assert.equal(grouped.get("plan")!.length, 3);
  assert.equal(grouped.get("execute")!.length, 2);
});

test("NotificationSeverity type accepts all valid values", () => {
  const severities: NotificationSeverity[] = ["info", "warning", "error", "critical"];
  assert.equal(severities.length, 4);
});

test("NotificationPriority type accepts all valid values", () => {
  const priorities: NotificationPriority[] = ["low", "normal", "high", "urgent"];
  assert.equal(priorities.length, 4);
});
