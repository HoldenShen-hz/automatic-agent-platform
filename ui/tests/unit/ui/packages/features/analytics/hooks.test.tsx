// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@aa/shared-state", () => ({
  useAnalyticsQuery: () => ({
    data: [
      { id: "tasks_total", label: "tasks_total", value: 12, trend: "up" },
      { id: "workflows_total", label: "workflows_total", value: 6, trend: "flat" },
    ],
  }),
}));

import {
  MAX_ANALYTICS_EXPORT_BYTES,
  buildAnalyticsExportPayload,
  useAnalyticsVm,
} from "../../../../../../packages/features/analytics/src/hooks";

describe("useAnalyticsVm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

  it("builds time-series data and exports JSON without relying on integer-only trend bars", () => {
    const createObjectUrlSpy = vi.spyOn(URL, "createObjectURL");
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL");
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    const { result } = renderHook(() => useAnalyticsVm());

    expect(result.current.timeSeriesData.length).toBeGreaterThan(0);
    expect(result.current.timeSeriesData[0]?.timestamp).toContain("T");
    expect(result.current.trendSummary).toEqual([12, 6]);

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
});
