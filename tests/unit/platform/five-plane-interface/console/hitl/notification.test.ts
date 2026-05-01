import { strict as assert } from "node:assert";
import { test } from "node:test";

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
} from "../../../../../src/platform/five-plane-interface/console/hitl/notification.js";

// Minimal HitlQueueItem for testing - only the fields actually used by notification.ts
function makeQueueItem(overrides: Partial<{
  riskLevel: "low" | "medium" | "high" | "critical";
  status: "pending" | "acknowledged" | "resolved";
  title: string;
  stageRef: string;
  createdAt: string;
}> = {}): {
  riskLevel: "low" | "medium" | "high" | "critical";
  status: "pending" | "acknowledged" | "resolved";
  title: string;
  stageRef: string;
  createdAt: string;
} {
  return {
    riskLevel: "low",
    status: "pending",
    title: "Test Approval",
    stageRef: "stage_01",
    createdAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("mapRiskLevelToSeverity maps low to info", () => {
  assert.equal(mapRiskLevelToSeverity("low"), "info");
});

test("mapRiskLevelToSeverity maps medium to warning", () => {
  assert.equal(mapRiskLevelToSeverity("medium"), "warning");
});

test("mapRiskLevelToSeverity maps high to error", () => {
  assert.equal(mapRiskLevelToSeverity("high"), "error");
});

test("mapRiskLevelToSeverity maps critical to critical", () => {
  assert.equal(mapRiskLevelToSeverity("critical"), "critical");
});

test("mapRiskLevelToSeverity returns critical for unknown input", () => {
  // @ts-expect-error - intentionally passing invalid input
  assert.equal(mapRiskLevelToSeverity("unknown"), "critical");
});

test("calculateNotificationPriority returns urgent for critical pending", () => {
  const item = makeQueueItem({ riskLevel: "critical", status: "pending" });
  assert.equal(calculateNotificationPriority(item), "urgent");
});

test("calculateNotificationPriority returns high for high pending", () => {
  const item = makeQueueItem({ riskLevel: "high", status: "pending" });
  assert.equal(calculateNotificationPriority(item), "high");
});

test("calculateNotificationPriority returns low for acknowledged", () => {
  const item = makeQueueItem({ riskLevel: "low", status: "acknowledged" });
  assert.equal(calculateNotificationPriority(item), "low");
});

test("calculateNotificationPriority returns normal for other cases", () => {
  const item = makeQueueItem({ riskLevel: "medium", status: "resolved" });
  assert.equal(calculateNotificationPriority(item), "normal");
});

test("calculateNotificationPriority critical with acknowledged is not urgent", () => {
  const item = makeQueueItem({ riskLevel: "critical", status: "acknowledged" });
  assert.equal(calculateNotificationPriority(item), "low");
});

test("buildAccessibleLabel for pending status", () => {
  const item = makeQueueItem({ title: "Approve deployment", status: "pending" });
  const label = buildAccessibleLabel(item);
  assert.ok(label.includes("Awaiting your decision"));
  assert.ok(label.includes("Approve deployment"));
  assert.ok(label.includes("Risk level: low"));
});

test("buildAccessibleLabel for non-pending status", () => {
  const item = makeQueueItem({ title: "Deploy approved", status: "resolved" });
  const label = buildAccessibleLabel(item);
  assert.ok(label.includes("Status: resolved"));
  assert.ok(label.includes("Deploy approved"));
});

test("getSeverityColorTokens returns info colors", () => {
  const tokens = getSeverityColorTokens("info");
  assert.equal(tokens.background, "#e8f4fd");
  assert.equal(tokens.foreground, "#0d4a6e");
  assert.equal(tokens.border, "#2196f3");
  assert.ok(tokens.contrastRatio >= 4.5); // WCAG AA for normal text
});

test("getSeverityColorTokens returns warning colors", () => {
  const tokens = getSeverityColorTokens("warning");
  assert.equal(tokens.background, "#fff8e1");
  assert.equal(tokens.foreground, "#6d4c00");
  assert.equal(tokens.border, "#ff9800");
  assert.ok(tokens.contrastRatio >= 4.5);
});

test("getSeverityColorTokens returns error colors", () => {
  const tokens = getSeverityColorTokens("error");
  assert.equal(tokens.background, "#ffebee");
  assert.equal(tokens.foreground, "#b71c1c");
  assert.equal(tokens.border, "#f44336");
  assert.ok(tokens.contrastRatio >= 4.5);
});

test("getSeverityColorTokens returns critical colors", () => {
  const tokens = getSeverityColorTokens("critical");
  assert.equal(tokens.background, "#ffcdd2");
  assert.equal(tokens.foreground, "#7f0000");
  assert.equal(tokens.border, "#d32f2f");
  assert.ok(tokens.contrastRatio >= 4.5);
});

test("getSeverityColorTokens default case returns critical colors", () => {
  // @ts-expect-error - intentionally passing invalid input
  const tokens = getSeverityColorTokens("invalid" as NotificationSeverity);
  assert.equal(tokens.background, "#ffcdd2");
  assert.equal(tokens.contrastRatio, 7.2);
});

test("sortByPriority sorts urgent first", () => {
  const items = [
    makeQueueItem({ riskLevel: "low", status: "pending", createdAt: "2024-01-01T00:00:00.000Z" }),
    makeQueueItem({ riskLevel: "critical", status: "pending", createdAt: "2024-01-01T00:01:00.000Z" }),
    makeQueueItem({ riskLevel: "high", status: "pending", createdAt: "2024-01-01T00:02:00.000Z" }),
  ];
  const sorted = sortByPriority(items);
  assert.equal(sorted[0].riskLevel, "critical");
  assert.equal(sorted[1].riskLevel, "high");
  assert.equal(sorted[2].riskLevel, "low");
});

test("sortByPriority secondary sort oldest first", () => {
  const items = [
    makeQueueItem({ riskLevel: "low", status: "pending", createdAt: "2024-01-02T00:00:00.000Z" }),
    makeQueueItem({ riskLevel: "low", status: "pending", createdAt: "2024-01-01T00:00:00.000Z" }),
  ];
  const sorted = sortByPriority(items);
  assert.ok(sorted[0].createdAt < sorted[1].createdAt);
});

test("sortByPriority does not mutate original array", () => {
  const original = [
    makeQueueItem({ riskLevel: "high", status: "pending", createdAt: "2024-01-01T00:00:00.000Z" }),
    makeQueueItem({ riskLevel: "critical", status: "pending", createdAt: "2024-01-01T00:01:00.000Z" }),
  ];
  const copy = [...original];
  sortByPriority(original);
  assert.equal(original[0].riskLevel, copy[0].riskLevel);
  assert.equal(original[1].riskLevel, copy[1].riskLevel);
});

test("filterByStatus returns all items when status is null", () => {
  const items = [
    makeQueueItem({ status: "pending" }),
    makeQueueItem({ status: "resolved" }),
  ];
  const filtered = filterByStatus(items, null);
  assert.equal(filtered.length, 2);
});

test("filterByStatus filters by pending status", () => {
  const items = [
    makeQueueItem({ status: "pending" }),
    makeQueueItem({ status: "acknowledged" }),
    makeQueueItem({ status: "resolved" }),
  ];
  const filtered = filterByStatus(items, "pending");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].status, "pending");
});

test("filterByStatus filters by acknowledged status", () => {
  const items = [
    makeQueueItem({ status: "pending" }),
    makeQueueItem({ status: "acknowledged" }),
  ];
  const filtered = filterByStatus(items, "acknowledged");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].status, "acknowledged");
});

test("filterByStatus filters by resolved status", () => {
  const items = [
    makeQueueItem({ status: "resolved" }),
    makeQueueItem({ status: "pending" }),
  ];
  const filtered = filterByStatus(items, "resolved");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].status, "resolved");
});

test("filterByStatus returns empty array when no matches", () => {
  const items = [makeQueueItem({ status: "pending" })];
  const filtered = filterByStatus(items, "resolved");
  assert.equal(filtered.length, 0);
});

test("groupByStage groups items by stageRef", () => {
  const items = [
    makeQueueItem({ stageRef: "stage_01" }),
    makeQueueItem({ stageRef: "stage_02" }),
    makeQueueItem({ stageRef: "stage_01" }),
  ];
  const groups = groupByStage(items);
  assert.equal(groups.size, 2);
  assert.equal(groups.get("stage_01")?.length, 2);
  assert.equal(groups.get("stage_02")?.length, 1);
});

test("groupByStage returns empty map for empty array", () => {
  const groups = groupByStage([]);
  assert.equal(groups.size, 0);
});

test("groupByStage handles single item", () => {
  const items = [makeQueueItem({ stageRef: "stage_x" })];
  const groups = groupByStage(items);
  assert.equal(groups.size, 1);
  assert.equal(groups.get("stage_x")?.length, 1);
});

test("groupByStage preserves item order within group", () => {
  const items = [
    makeQueueItem({ stageRef: "stage_01", title: "First" }),
    makeQueueItem({ stageRef: "stage_01", title: "Second" }),
  ];
  const groups = groupByStage(items);
  assert.equal(groups.get("stage_01")?.[0].title, "First");
  assert.equal(groups.get("stage_01")?.[1].title, "Second");
});

test("WCAG_COMPLIANCE_NOTES is a string constant", () => {
  // @ts-expect-error - intentionally accessing the notes
  const notes = require("../../../../../src/platform/five-plane-interface/console/hitl/notification.js").WCAG_COMPLIANCE_NOTES;
  assert.ok(typeof notes === "string");
  assert.ok(notes.includes("WCAG 2.1 AA"));
  assert.ok(notes.includes("contrast"));
});