// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  analyticsData: [
    { id: "tasks_total", label: "tasks_total", value: 12, trend: "up" },
    { id: "workflows_total", label: "workflows_total", value: 6, trend: "flat" },
  ] as Array<{ id: string; label: string; value: string | number; trend: "up" | "flat" | "down"; description?: string }>,
}));

vi.mock("@aa/shared-state", () => ({
  useAnalyticsQuery: () => ({
    data: mocks.analyticsData,
  }),
}));

import {
  MAX_ANALYTICS_EXPORT_BYTES,
  buildAnalyticsExportPayload,
  mapAnalyticsToVm,
  useAnalyticsVm,
} from "../../../../../../packages/features/analytics/src/hooks";

describe("useAnalyticsVm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.analyticsData = [
      { id: "tasks_total", label: "tasks_total", value: 12, trend: "up" },
      { id: "workflows_total", label: "workflows_total", value: 6, trend: "flat" },
    ];
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob://analytics"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  it("keeps analytics in snapshot-only mode and exports JSON without fabricating historical series", () => {
    const createObjectUrlSpy = vi.spyOn(URL, "createObjectURL");
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL");
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    const { result } = renderHook(() => useAnalyticsVm());

    expect(result.current.historicalSeriesAvailable).toBe(false);
    expect(result.current.timeSeriesData).toEqual([]);
    expect(result.current.trendSummary).toEqual([12, 6]);
    expect(result.current.breakdowns.map((item) => item.dimension)).toEqual(["layer"]);

    act(() => {
      result.current.exportData("json");
    });

    expect(createObjectUrlSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalledWith("blob://analytics");
  });

  it("rejects oversized analytics exports before creating blobs", () => {
    expect(() => buildAnalyticsExportPayload(
      "json",
      [{ id: "oversized", label: "x".repeat(MAX_ANALYTICS_EXPORT_BYTES), value: 12, trend: "up" }],
      [{ timestamp: "2026-05-08T00:00:00.000Z", value: 12 }],
      [{
        dimension: "time",
        groups: [{ label: "2026-05-08", value: 1 }],
      }],
      {
        startDate: "2026-05-01",
        endDate: "2026-05-08",
      },
    )).toThrow(/analytics\.export_too_large/);
  });

  it("formats percentage-style metrics consistently in the summary grid", () => {
    const vm = mapAnalyticsToVm([
      { id: "uptime", label: "Uptime", value: 2.13, trend: "up", description: "Platform uptime percentage." },
      { id: "error-rate", label: "Error rate", value: 8.33, trend: "down", description: "Current workflow error rate." },
      { id: "queue-depth", label: "Queue depth", value: 11, trend: "flat", description: "Current queued task count." },
    ]);

    expect(vm.metrics).toEqual([
      { label: "Uptime", value: "2.13%" },
      { label: "Error rate", value: "8.33%" },
      { label: "Queue depth", value: 11 },
    ]);
    expect(vm.trendSummary).toEqual([2.13, 8.33, 11]);
  });

  it("normalizes ratio-style percentage metrics from the live analytics feed", () => {
    mocks.analyticsData = [
      { id: "error-rate", label: "Error rate", value: 0.0833, trend: "up", description: "Current workflow error rate." },
      { id: "uptime", label: "Uptime", value: 14.34, trend: "flat", description: "Platform uptime percentage." },
    ];

    const { result } = renderHook(() => useAnalyticsVm());

    expect(result.current.metrics).toEqual([
      { label: "Error rate", value: "8.33%" },
      { label: "Uptime", value: "14.34%" },
    ]);
    expect(result.current.trendSummary).toEqual([8.33, 14.34]);
  });
});
