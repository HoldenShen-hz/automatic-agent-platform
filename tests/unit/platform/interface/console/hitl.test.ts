/**
 * Unit tests for HITL Notification UI Components
 * @section §21 HITL UI Components
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  NotificationSeverity,
  NotificationPriority,
  mapRiskLevelToSeverity,
  calculateNotificationPriority,
  buildAccessibleLabel,
  getSeverityColorTokens,
  sortByPriority,
  filterByStatus,
  groupByStage,
  WCAG_COMPLIANCE_NOTES,
} from "../../../../../src/platform/five-plane-interface/console/hitl/notification.js";
import type { HitlQueueItem, HitlQueueStatus } from "../../../../../src/platform/five-plane-orchestration/hitl/hitl-operator-console-service.js";

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

test("mapRiskLevelToSeverity maps low to info", () => {
  const result = mapRiskLevelToSeverity("low");
  assert.equal(result, "info");
});

test("mapRiskLevelToSeverity maps medium to warning", () => {
  const result = mapRiskLevelToSeverity("medium");
  assert.equal(result, "warning");
});

test("mapRiskLevelToSeverity maps high to error", () => {
  const result = mapRiskLevelToSeverity("high");
  assert.equal(result, "error");
});

test("mapRiskLevelToSeverity maps critical to critical", () => {
  const result = mapRiskLevelToSeverity("critical");
  assert.equal(result, "critical");
});

test("calculateNotificationPriority returns urgent for critical pending items", () => {
  const item = createHitlQueueItem({ riskLevel: "critical", status: "pending" });
  const result = calculateNotificationPriority(item);
  assert.equal(result, "urgent");
});

test("calculateNotificationPriority returns high for high risk pending items", () => {
  const item = createHitlQueueItem({ riskLevel: "high", status: "pending" });
  const result = calculateNotificationPriority(item);
  assert.equal(result, "high");
});

test("calculateNotificationPriority returns low for acknowledged items", () => {
  const item = createHitlQueueItem({ riskLevel: "low", status: "acknowledged" });
  const result = calculateNotificationPriority(item);
  assert.equal(result, "low");
});

test("calculateNotificationPriority returns normal for other cases", () => {
  const item = createHitlQueueItem({ riskLevel: "low", status: "pending" });
  const result = calculateNotificationPriority(item);
  assert.equal(result, "normal");
});

test("calculateNotificationPriority returns normal for resolved items", () => {
  const item = createHitlQueueItem({ riskLevel: "high", status: "resolved" });
  const result = calculateNotificationPriority(item);
  assert.equal(result, "normal");
});

test("buildAccessibleLabel builds label for pending items", () => {
  const item = createHitlQueueItem({
    title: "Approve deployment",
    riskLevel: "high",
    status: "pending",
  });
  const label = buildAccessibleLabel(item);
  assert.ok(label.includes("HITL Approval: Approve deployment"));
  assert.ok(label.includes("Risk level: high"));
  assert.ok(label.includes("Awaiting your decision"));
});

test("buildAccessibleLabel builds label for non-pending items", () => {
  const item = createHitlQueueItem({
    title: "Approve deployment",
    riskLevel: "medium",
    status: "acknowledged",
  });
  const label = buildAccessibleLabel(item);
  assert.ok(label.includes("HITL Approval: Approve deployment"));
  assert.ok(label.includes("Risk level: medium"));
  assert.ok(label.includes("Status: acknowledged"));
});

test("getSeverityColorTokens returns correct tokens for info", () => {
  const tokens = getSeverityColorTokens("info");
  assert.equal(tokens.background, "#e8f4fd");
  assert.equal(tokens.foreground, "#0d4a6e");
  assert.equal(tokens.border, "#2196f3");
  assert.equal(tokens.contrastRatio, 5.2);
});

test("getSeverityColorTokens returns correct tokens for warning", () => {
  const tokens = getSeverityColorTokens("warning");
  assert.equal(tokens.background, "#fff8e1");
  assert.equal(tokens.foreground, "#6d4c00");
  assert.equal(tokens.border, "#ff9800");
  assert.equal(tokens.contrastRatio, 4.8);
});

test("getSeverityColorTokens returns correct tokens for error", () => {
  const tokens = getSeverityColorTokens("error");
  assert.equal(tokens.background, "#ffebee");
  assert.equal(tokens.foreground, "#b71c1c");
  assert.equal(tokens.border, "#f44336");
  assert.equal(tokens.contrastRatio, 5.1);
});

test("getSeverityColorTokens returns correct tokens for critical", () => {
  const tokens = getSeverityColorTokens("critical");
  assert.equal(tokens.background, "#ffcdd2");
  assert.equal(tokens.foreground, "#7f0000");
  assert.equal(tokens.border, "#d32f2f");
  assert.equal(tokens.contrastRatio, 7.2);
});

test("sortByPriority sorts urgent first", () => {
  const items = [
    createHitlQueueItem({ riskLevel: "low", status: "pending", createdAt: "2026-04-01T10:00:00.000Z" }),
    createHitlQueueItem({ riskLevel: "critical", status: "pending", createdAt: "2026-04-01T09:00:00.000Z" }),
    createHitlQueueItem({ riskLevel: "high", status: "pending", createdAt: "2026-04-01T08:00:00.000Z" }),
  ];
  const sorted = sortByPriority(items);
  assert.equal(sorted[0]!.riskLevel, "critical");
  assert.equal(sorted[1]!.riskLevel, "high");
  assert.equal(sorted[2]!.riskLevel, "low");
});

test("sortByPriority sorts by createdAt as secondary sort", () => {
  const items = [
    createHitlQueueItem({ riskLevel: "low", status: "pending", createdAt: "2026-04-01T10:00:00.000Z" }),
    createHitlQueueItem({ riskLevel: "low", status: "pending", createdAt: "2026-04-01T08:00:00.000Z" }),
    createHitlQueueItem({ riskLevel: "low", status: "pending", createdAt: "2026-04-01T09:00:00.000Z" }),
  ];
  const sorted = sortByPriority(items);
  assert.equal(sorted[0]!.createdAt, "2026-04-01T08:00:00.000Z");
  assert.equal(sorted[1]!.createdAt, "2026-04-01T09:00:00.000Z");
  assert.equal(sorted[2]!.createdAt, "2026-04-01T10:00:00.000Z");
});

test("sortByPriority does not mutate original array", () => {
  const items = [
    createHitlQueueItem({ riskLevel: "critical", status: "pending", createdAt: "2026-04-01T10:00:00.000Z" }),
    createHitlQueueItem({ riskLevel: "low", status: "pending", createdAt: "2026-04-01T09:00:00.000Z" }),
  ];
  const originalFirst = items[0];
  sortByPriority(items);
  assert.equal(items[0], originalFirst);
});

test("filterByStatus returns all items when status is null", () => {
  const items = [
    createHitlQueueItem({ status: "pending" }),
    createHitlQueueItem({ status: "acknowledged" }),
  ];
  const filtered = filterByStatus(items, null);
  assert.equal(filtered.length, 2);
});

test("filterByStatus filters by pending status", () => {
  const items = [
    createHitlQueueItem({ status: "pending" }),
    createHitlQueueItem({ status: "acknowledged" }),
    createHitlQueueItem({ status: "pending" }),
  ];
  const filtered = filterByStatus(items, "pending");
  assert.equal(filtered.length, 2);
  for (const item of filtered) {
    assert.equal(item.status, "pending");
  }
});

test("filterByStatus filters by acknowledged status", () => {
  const items = [
    createHitlQueueItem({ status: "pending" }),
    createHitlQueueItem({ status: "acknowledged" }),
  ];
  const filtered = filterByStatus(items, "acknowledged");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]!.status, "acknowledged");
});

test("filterByStatus filters by resolved status", () => {
  const items = [
    createHitlQueueItem({ status: "resolved" }),
    createHitlQueueItem({ status: "pending" }),
  ];
  const filtered = filterByStatus(items, "resolved");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]!.status, "resolved");
});

test("groupByStage groups items by stageRef", () => {
  const stageRef1 = "plan";
  const stageRef2 = "execute";
  const items = [
    createHitlQueueItem({ stageRef: stageRef1 }),
    createHitlQueueItem({ stageRef: stageRef2 }),
    createHitlQueueItem({ stageRef: stageRef1 }),
  ];
  const grouped = groupByStage(items);
  assert.equal(grouped.size, 2);
  assert.equal(grouped.get(stageRef1)!.length, 2);
  assert.equal(grouped.get(stageRef2)!.length, 1);
});

test("groupByStage handles empty array", () => {
  const grouped = groupByStage([]);
  assert.equal(grouped.size, 0);
});

test("groupByStage handles single item", () => {
  const items = [createHitlQueueItem()];
  const grouped = groupByStage(items);
  assert.equal(grouped.size, 1);
});

test("WCAG_COMPLIANCE_NOTES is a string constant", () => {
  assert.equal(typeof WCAG_COMPLIANCE_NOTES, "string");
  assert.ok(WCAG_COMPLIANCE_NOTES.length > 0);
  assert.ok(WCAG_COMPLIANCE_NOTES.includes("WCAG 2.1 AA"));
});

test("NotificationSeverity type is exported correctly", () => {
  const severity: NotificationSeverity = "info";
  assert.equal(severity, "info");
});

test("NotificationPriority type is exported correctly", () => {
  const priority: NotificationPriority = "normal";
  assert.equal(priority, "normal");
});
