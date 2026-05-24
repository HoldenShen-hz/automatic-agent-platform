import assert from "node:assert/strict";
import test from "node:test";

import type { HitlQueueItem } from "../../../../../../src/platform/five-plane-orchestration/hitl/hitl-operator-console-service.js";
import {
  WCAG_COMPLIANCE_NOTES,
  buildAccessibleLabel,
  calculateNotificationPriority,
  filterByStatus,
  getSeverityColorTokens,
  groupByStage,
  mapRiskLevelToSeverity,
  sortByPriority,
} from "../../../../../../src/platform/five-plane-interface/console/hitl/notification.js";

function makeQueueItem(overrides: Partial<HitlQueueItem> = {}): HitlQueueItem {
  return {
    queueItemId: "queue-1",
    approvalId: "approval-1",
    taskId: "task-1",
    executionId: "exec-1",
    tenantId: "tenant-1",
    title: "Test Approval",
    stageRef: "assess" as HitlQueueItem["stageRef"],
    riskLevel: "low",
    explanationSummary: "summary",
    recommendedOptionId: null,
    deliveryChannels: [],
    deliveryIds: [],
    status: "pending",
    acknowledgedBy: null,
    takeoverSessionId: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("notification helpers map risk levels and build accessible labels from canonical queue items", () => {
  const item = makeQueueItem({ riskLevel: "critical", title: "Approve deployment" });

  assert.equal(mapRiskLevelToSeverity("low"), "info");
  assert.equal(mapRiskLevelToSeverity("medium"), "warning");
  assert.equal(mapRiskLevelToSeverity("high"), "error");
  assert.equal(mapRiskLevelToSeverity("critical"), "critical");
  assert.equal(calculateNotificationPriority(item), "urgent");
  assert.match(buildAccessibleLabel(item), /Approve deployment/);
});

test("notification helpers expose WCAG-compliant color tokens", () => {
  const info = getSeverityColorTokens("info");
  const critical = getSeverityColorTokens("critical");

  assert.ok(info.contrastRatio >= 4.5);
  assert.ok(critical.contrastRatio >= 4.5);
  assert.ok(WCAG_COMPLIANCE_NOTES.includes("WCAG 2.1 AA"));
});

test("notification helpers sort, filter, and group queue items", () => {
  const items = [
    makeQueueItem({
      queueItemId: "queue-low",
      riskLevel: "low",
      stageRef: "assess" as HitlQueueItem["stageRef"],
      createdAt: "2024-01-03T00:00:00.000Z",
      updatedAt: "2024-01-03T00:00:00.000Z",
    }),
    makeQueueItem({
      queueItemId: "queue-critical",
      riskLevel: "critical",
      stageRef: "assess" as HitlQueueItem["stageRef"],
      createdAt: "2024-01-02T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
    }),
    makeQueueItem({
      queueItemId: "queue-resolved",
      riskLevel: "high",
      status: "resolved",
      stageRef: "review" as HitlQueueItem["stageRef"],
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    }),
  ];

  const sorted = sortByPriority(items);
  const filtered = filterByStatus(items, "resolved");
  const grouped = groupByStage(items);

  assert.equal(sorted[0]?.queueItemId, "queue-critical");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.queueItemId, "queue-resolved");
  assert.equal(grouped.get("assess")?.length, 2);
  assert.equal(grouped.get("review")?.length, 1);
});
