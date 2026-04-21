import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapRiskLevelToSeverity,
  calculateNotificationPriority,
  buildAccessibleLabel,
  getSeverityColorTokens,
  sortByPriority,
  filterByStatus,
  groupByStage,
  WCAG_COMPLIANCE_NOTES,
  type NotificationSeverity,
} from "../../../../../../src/platform/interface/console/hitl/notification.js";
import type { HitlQueueItem } from "../../../../../../src/platform/orchestration/hitl/hitl-operator-console-service.js";

function createMockQueueItem(overrides: Partial<HitlQueueItem> = {}): HitlQueueItem {
  return {
    queueItemId: "test_queue_item_1",
    approvalId: "test_approval_1",
    taskId: "test_task_1",
    executionId: "test_execution_1",
    tenantId: "test_tenant",
    title: "Test Approval Request",
    stageRef: "plan",
    riskLevel: "high",
    explanationSummary: "High risk operation requires approval",
    recommendedOptionId: "option_1",
    deliveryChannels: ["console", "email"],
    deliveryIds: ["delivery_1"],
    status: "pending",
    acknowledgedBy: null,
    takeoverSessionId: null,
    createdAt: "2026-04-21T10:00:00.000Z",
    updatedAt: "2026-04-21T10:00:00.000Z",
    ...overrides,
  };
}

describe("HITL Notification Components", () => {
  describe("mapRiskLevelToSeverity", () => {
    it("should map low risk to info severity", () => {
      assert.strictEqual(mapRiskLevelToSeverity("low"), "info");
    });

    it("should map medium risk to warning severity", () => {
      assert.strictEqual(mapRiskLevelToSeverity("medium"), "warning");
    });

    it("should map high risk to error severity", () => {
      assert.strictEqual(mapRiskLevelToSeverity("high"), "error");
    });

    it("should map critical risk to critical severity", () => {
      assert.strictEqual(mapRiskLevelToSeverity("critical"), "critical");
    });
  });

  describe("calculateNotificationPriority", () => {
    it("should return urgent for critical pending items", () => {
      const item = createMockQueueItem({ riskLevel: "critical", status: "pending" });
      assert.strictEqual(calculateNotificationPriority(item), "urgent");
    });

    it("should return high for high risk pending items", () => {
      const item = createMockQueueItem({ riskLevel: "high", status: "pending" });
      assert.strictEqual(calculateNotificationPriority(item), "high");
    });

    it("should return low for acknowledged items", () => {
      const item = createMockQueueItem({ riskLevel: "high", status: "acknowledged" });
      assert.strictEqual(calculateNotificationPriority(item), "low");
    });

    it("should return normal for resolved items", () => {
      const item = createMockQueueItem({ status: "resolved" });
      assert.strictEqual(calculateNotificationPriority(item), "normal");
    });

    it("should return normal for pending low risk items", () => {
      const item = createMockQueueItem({ riskLevel: "low", status: "pending" });
      assert.strictEqual(calculateNotificationPriority(item), "normal");
    });
  });

  describe("buildAccessibleLabel", () => {
    it("should build label for pending approval", () => {
      const item = createMockQueueItem({ status: "pending" });
      const label = buildAccessibleLabel(item);
      assert.ok(label.includes("Awaiting your decision"));
      assert.ok(label.includes("risk level: high"));
    });

    it("should build label with status for non-pending approval", () => {
      const item = createMockQueueItem({ status: "acknowledged" });
      const label = buildAccessibleLabel(item);
      assert.ok(label.includes("Status: acknowledged"));
    });

    it("should include title in label", () => {
      const item = createMockQueueItem({ title: "Delete Production Database" });
      const label = buildAccessibleLabel(item);
      assert.ok(label.includes("Delete Production Database"));
    });
  });

  describe("getSeverityColorTokens", () => {
    it("should return compliant color tokens for info", () => {
      const tokens = getSeverityColorTokens("info");
      assert.ok(tokens.contrastRatio >= 4.5); // WCAG AA requirement
      assert.ok(tokens.background !== undefined);
      assert.ok(tokens.foreground !== undefined);
    });

    it("should return compliant color tokens for warning", () => {
      const tokens = getSeverityColorTokens("warning");
      assert.ok(tokens.contrastRatio >= 4.5);
    });

    it("should return compliant color tokens for error", () => {
      const tokens = getSeverityColorTokens("error");
      assert.ok(tokens.contrastRatio >= 4.5);
    });

    it("should return highest contrast for critical", () => {
      const tokens = getSeverityColorTokens("critical");
      assert.ok(tokens.contrastRatio >= 4.5);
    });
  });

  describe("sortByPriority", () => {
    it("should sort urgent items first", () => {
      const items = [
        createMockQueueItem({ queueItemId: "1", riskLevel: "low", status: "pending", createdAt: "2026-04-21T10:00:00.000Z" }),
        createMockQueueItem({ queueItemId: "2", riskLevel: "critical", status: "pending", createdAt: "2026-04-21T10:01:00.000Z" }),
        createMockQueueItem({ queueItemId: "3", riskLevel: "high", status: "pending", createdAt: "2026-04-21T10:02:00.000Z" }),
      ];
      const sorted = sortByPriority(items);
      const first = sorted[0];
      const second = sorted[1];
      const third = sorted[2];
      assert.strictEqual(first?.queueItemId, "2"); // critical first
      assert.strictEqual(second?.queueItemId, "3"); // high second
      assert.strictEqual(third?.queueItemId, "1"); // low last
    });

    it("should use createdAt as secondary sort", () => {
      const items = [
        createMockQueueItem({ queueItemId: "1", riskLevel: "high", status: "pending", createdAt: "2026-04-21T10:02:00.000Z" }),
        createMockQueueItem({ queueItemId: "2", riskLevel: "high", status: "pending", createdAt: "2026-04-21T10:00:00.000Z" }),
      ];
      const sorted = sortByPriority(items);
      const first = sorted[0];
      assert.strictEqual(first?.queueItemId, "2"); // older first
    });

    it("should not mutate original array", () => {
      const items = [createMockQueueItem({ queueItemId: "1" })];
      sortByPriority(items);
      const first = items[0];
      assert.strictEqual(first?.queueItemId, "1");
    });
  });

  describe("filterByStatus", () => {
    it("should return all items when status is null", () => {
      const items = [
        createMockQueueItem({ queueItemId: "1", status: "pending" }),
        createMockQueueItem({ queueItemId: "2", status: "acknowledged" }),
      ];
      const filtered = filterByStatus(items, null);
      assert.strictEqual(filtered.length, 2);
    });

    it("should filter by pending status", () => {
      const items = [
        createMockQueueItem({ queueItemId: "1", status: "pending" }),
        createMockQueueItem({ queueItemId: "2", status: "acknowledged" }),
        createMockQueueItem({ queueItemId: "3", status: "resolved" }),
      ];
      const filtered = filterByStatus(items, "pending");
      assert.strictEqual(filtered.length, 1);
      const first = filtered[0];
      assert.strictEqual(first?.queueItemId, "1");
    });

    it("should filter by acknowledged status", () => {
      const items = [
        createMockQueueItem({ queueItemId: "1", status: "pending" }),
        createMockQueueItem({ queueItemId: "2", status: "acknowledged" }),
      ];
      const filtered = filterByStatus(items, "acknowledged");
      assert.strictEqual(filtered.length, 1);
      const first = filtered[0];
      assert.strictEqual(first?.queueItemId, "2");
    });
  });

  describe("groupByStage", () => {
    it("should group items by stage reference", () => {
      const items = [
        createMockQueueItem({ queueItemId: "1", stageRef: "plan" }),
        createMockQueueItem({ queueItemId: "2", stageRef: "execute" }),
        createMockQueueItem({ queueItemId: "3", stageRef: "plan" }),
      ];
      const groups = groupByStage(items);
      const planGroup = groups.get("plan");
      const executeGroup = groups.get("execute");
      assert.strictEqual(planGroup?.length, 2);
      assert.strictEqual(executeGroup?.length, 1);
    });

    it("should handle empty items array", () => {
      const groups = groupByStage([]);
      assert.strictEqual(groups.size, 0);
    });

    it("should handle items with no shared stages", () => {
      const items = [
        createMockQueueItem({ queueItemId: "1", stageRef: "observe" }),
        createMockQueueItem({ queueItemId: "2", stageRef: "release" }),
      ];
      const groups = groupByStage(items);
      assert.strictEqual(groups.size, 2);
    });
  });

  describe("WCAG_COMPLIANCE_NOTES", () => {
    it("should contain WCAG documentation", () => {
      assert.ok(WCAG_COMPLIANCE_NOTES.includes("WCAG 2.1 AA"));
      assert.ok(WCAG_COMPLIANCE_NOTES.includes("contrast"));
      assert.ok(WCAG_COMPLIANCE_NOTES.includes("keyboard"));
    });
  });
});