import { describe, it, expect } from "vitest";
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
      expect(mapRiskLevelToSeverity("low")).toBe("info");
    });

    it("should map medium risk to warning severity", () => {
      expect(mapRiskLevelToSeverity("medium")).toBe("warning");
    });

    it("should map high risk to error severity", () => {
      expect(mapRiskLevelToSeverity("high")).toBe("error");
    });

    it("should map critical risk to critical severity", () => {
      expect(mapRiskLevelToSeverity("critical")).toBe("critical");
    });
  });

  describe("calculateNotificationPriority", () => {
    it("should return urgent for critical pending items", () => {
      const item = createMockQueueItem({ riskLevel: "critical", status: "pending" });
      expect(calculateNotificationPriority(item)).toBe("urgent");
    });

    it("should return high for high risk pending items", () => {
      const item = createMockQueueItem({ riskLevel: "high", status: "pending" });
      expect(calculateNotificationPriority(item)).toBe("high");
    });

    it("should return low for acknowledged items", () => {
      const item = createMockQueueItem({ riskLevel: "high", status: "acknowledged" });
      expect(calculateNotificationPriority(item)).toBe("low");
    });

    it("should return normal for resolved items", () => {
      const item = createMockQueueItem({ status: "resolved" });
      expect(calculateNotificationPriority(item)).toBe("normal");
    });

    it("should return normal for pending low risk items", () => {
      const item = createMockQueueItem({ riskLevel: "low", status: "pending" });
      expect(calculateNotificationPriority(item)).toBe("normal");
    });
  });

  describe("buildAccessibleLabel", () => {
    it("should build label for pending approval", () => {
      const item = createMockQueueItem({ status: "pending" });
      const label = buildAccessibleLabel(item);
      expect(label).toContain("Awaiting your decision");
      expect(label).toContain("risk level: high");
    });

    it("should build label with status for non-pending approval", () => {
      const item = createMockQueueItem({ status: "acknowledged" });
      const label = buildAccessibleLabel(item);
      expect(label).toContain("Status: acknowledged");
    });

    it("should include title in label", () => {
      const item = createMockQueueItem({ title: "Delete Production Database" });
      const label = buildAccessibleLabel(item);
      expect(label).toContain("Delete Production Database");
    });
  });

  describe("getSeverityColorTokens", () => {
    it("should return compliant color tokens for info", () => {
      const tokens = getSeverityColorTokens("info");
      expect(tokens.contrastRatio).toBeGreaterThanOrEqual(4.5); // WCAG AA requirement
      expect(tokens.background).toBeDefined();
      expect(tokens.foreground).toBeDefined();
    });

    it("should return compliant color tokens for warning", () => {
      const tokens = getSeverityColorTokens("warning");
      expect(tokens.contrastRatio).toBeGreaterThanOrEqual(4.5);
    });

    it("should return compliant color tokens for error", () => {
      const tokens = getSeverityColorTokens("error");
      expect(tokens.contrastRatio).toBeGreaterThanOrEqual(4.5);
    });

    it("should return highest contrast for critical", () => {
      const tokens = getSeverityColorTokens("critical");
      expect(tokens.contrastRatio).toBeGreaterThanOrEqual(4.5);
      expect(tokens.contrastRatio).toBeGreaterThan(tokens.contrastRatio);
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
      expect(sorted[0].queueItemId).toBe("2"); // critical first
      expect(sorted[1].queueItemId).toBe("3"); // high second
      expect(sorted[2].queueItemId).toBe("1"); // low last
    });

    it("should use createdAt as secondary sort", () => {
      const items = [
        createMockQueueItem({ queueItemId: "1", riskLevel: "high", status: "pending", createdAt: "2026-04-21T10:02:00.000Z" }),
        createMockQueueItem({ queueItemId: "2", riskLevel: "high", status: "pending", createdAt: "2026-04-21T10:00:00.000Z" }),
      ];
      const sorted = sortByPriority(items);
      expect(sorted[0].queueItemId).toBe("2"); // older first
    });

    it("should not mutate original array", () => {
      const items = [createMockQueueItem({ queueItemId: "1" })];
      sortByPriority(items);
      expect(items[0].queueItemId).toBe("1");
    });
  });

  describe("filterByStatus", () => {
    it("should return all items when status is null", () => {
      const items = [
        createMockQueueItem({ queueItemId: "1", status: "pending" }),
        createMockQueueItem({ queueItemId: "2", status: "acknowledged" }),
      ];
      const filtered = filterByStatus(items, null);
      expect(filtered).toHaveLength(2);
    });

    it("should filter by pending status", () => {
      const items = [
        createMockQueueItem({ queueItemId: "1", status: "pending" }),
        createMockQueueItem({ queueItemId: "2", status: "acknowledged" }),
        createMockQueueItem({ queueItemId: "3", status: "resolved" }),
      ];
      const filtered = filterByStatus(items, "pending");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].queueItemId).toBe("1");
    });

    it("should filter by acknowledged status", () => {
      const items = [
        createMockQueueItem({ queueItemId: "1", status: "pending" }),
        createMockQueueItem({ queueItemId: "2", status: "acknowledged" }),
      ];
      const filtered = filterByStatus(items, "acknowledged");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].queueItemId).toBe("2");
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
      expect(groups.get("plan")).toHaveLength(2);
      expect(groups.get("execute")).toHaveLength(1);
    });

    it("should handle empty items array", () => {
      const groups = groupByStage([]);
      expect(groups.size).toBe(0);
    });

    it("should handle items with no shared stages", () => {
      const items = [
        createMockQueueItem({ queueItemId: "1", stageRef: "observe" }),
        createMockQueueItem({ queueItemId: "2", stageRef: "release" }),
      ];
      const groups = groupByStage(items);
      expect(groups.size).toBe(2);
    });
  });

  describe("WCAG_COMPLIANCE_NOTES", () => {
    it("should contain WCAG documentation", () => {
      expect(WCAG_COMPLIANCE_NOTES).toContain("WCAG 2.1 AA");
      expect(WCAG_COMPLIANCE_NOTES).toContain("contrast");
      expect(WCAG_COMPLIANCE_NOTES).toContain("keyboard");
    });
  });
});