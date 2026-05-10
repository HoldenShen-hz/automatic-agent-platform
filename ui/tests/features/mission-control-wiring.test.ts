import { describe, expect, it } from "vitest";
import { defaultMockApiShape } from "../../packages/shared/api-client/src/mock-data";
import { mapAnalyticsToVm } from "../../packages/features/analytics/src/hooks";
import { mapDashboardSnapshotToVm } from "../../packages/features/dashboard/src/hooks";
import { mapStabilityToVm } from "../../packages/features/stability/src/hooks";

describe("mission control panel wiring", () => {
  it("maps dashboard inputs into four panel layers with 28 panels", () => {
    const vm = mapDashboardSnapshotToVm(
      defaultMockApiShape.dashboard,
      defaultMockApiShape.analytics,
      defaultMockApiShape.incidents,
      defaultMockApiShape.workers,
      defaultMockApiShape.queues,
      defaultMockApiShape.agents,
    );

    expect(vm.loading).toBe(false);
    expect(vm.panelGroups).toHaveLength(4);
    expect(vm.panelGroups.flatMap((group) => group.panels)).toHaveLength(28);
    expect(vm.trendValues.length).toBeGreaterThanOrEqual(6);
    expect(vm.panelGroups[0]?.panels[0]?.value).toBe("healthy");
  });

  it("maps stability data into structured health rows", () => {
    const vm = mapStabilityToVm(
      defaultMockApiShape.dashboard,
      defaultMockApiShape.incidents,
      defaultMockApiShape.workers,
      defaultMockApiShape.queues,
      defaultMockApiShape.agents,
    );

    expect(vm.rows).toHaveLength(9);
    expect(vm.rows.find((row) => row.key === "P99 Latency")?.value).toContain("ms");
    expect(vm.items.length).toBeGreaterThanOrEqual(defaultMockApiShape.incidents.length);
  });

  it("maps analytics into layer summaries and breakdown-ready metrics", () => {
    const vm = mapAnalyticsToVm(defaultMockApiShape.analytics);

    expect(vm.layerSummaries).toHaveLength(6);
    expect(vm.layerSummaries.find((item) => item.layer === "workflows")?.metricCount).toBeGreaterThan(0);
    expect(vm.metrics).toHaveLength(defaultMockApiShape.analytics.length);
  });
});
