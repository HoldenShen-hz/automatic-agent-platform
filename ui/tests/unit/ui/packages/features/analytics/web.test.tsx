import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockSetDateRange = vi.fn();
const mockExportData = vi.fn();

vi.mock("@aa/shared-state", () => ({
  useThemeState: () => ({ resolvedThemeName: "dark" }),
}));

vi.mock("@aa/ui-core", () => ({
  EChartSurface: ({ title }: { title: string }) => <div>{title}</div>,
  BarChart: ({ points }: { points: Array<{ label: string; value: number }> }) => (
    <div>{points.map((point) => <div key={point.label}>{`${point.label}:${point.value}`}</div>)}</div>
  ),
  FeatureScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  GaugeChart: ({ label, value }: { label: string; value: number }) => <div>{`${label}:${value}`}</div>,
  HeatmapGrid: ({ rows, columns }: { rows: string[]; columns: string[] }) => <div>{`${rows.length}:${columns.length}`}</div>,
  ListCard: ({ items }: { items: Array<{ title: string; description: string }> }) => (
    <div>{items.map((item) => <div key={`${item.title}-${item.description}`}>{item.title}</div>)}</div>
  ),
  MetricGrid: ({ metrics }: { metrics: Array<{ label: string; value: string | number }> }) => (
    <div>{metrics.map((metric) => <div key={metric.label}>{`${metric.label}: ${metric.value}`}</div>)}</div>
  ),
  MiniTrendBars: ({ values }: { values: number[] }) => <div>{values.join(",")}</div>,
  PieChart: ({ slices }: { slices: Array<{ label: string; value: number }> }) => (
    <div>{slices.map((slice) => <div key={slice.label}>{`${slice.label}:${slice.value}`}</div>)}</div>
  ),
  ScatterPlot: ({ points }: { points: Array<{ label: string; x: number; y: number }> }) => (
    <div>{points.map((point) => <div key={point.label}>{`${point.label}:${point.x}:${point.y}`}</div>)}</div>
  ),
  TimelineChart: ({ points }: { points: Array<{ label: string; value: number }> }) => (
    <div>{points.map((point) => <div key={point.label}>{`${point.label}:${point.value}`}</div>)}</div>
  ),
  createPanelStyle: () => ({}),
  designTokens: {
    color: {
      border: "#ddd",
      subtle: "#999",
      text: "#111",
      info: "#4f46e5",
    },
  },
  resolveTheme: () => ({ name: "dark" }),
}));

vi.mock("../../../../../../packages/features/analytics/src/hooks", () => ({
  useAnalyticsVm: () => ({
    metrics: [{ label: "tasks_total", value: 12 }],
    trendSummary: [1, 2, 3],
    timeSeriesData: [{ timestamp: "2026-05-08T00:00:00Z", value: 12 }],
    dateRange: { startDate: "2026-05-01", endDate: "2026-05-08" },
    setDateRange: mockSetDateRange,
    exportData: mockExportData,
    breakdowns: [
      { dimension: "time", groups: [{ label: "2026-05-08", value: 12 }] },
      { dimension: "domain", groups: [{ label: "marketing", value: 7 }, { label: "finance", value: 5 }] },
    ],
  }),
}));

import { AnalyticsWebView } from "../../../../../../packages/features/analytics/src/web";

afterEach(() => {
  cleanup();
});

describe("AnalyticsWebView", () => {
  it("renders export controls and drill-down charts", () => {
    render(<AnalyticsWebView />);

    expect(screen.queryByText("Analytics Trend")).not.toBeNull();
    expect(screen.queryAllByText("2026-05-08:12").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "domain" }));
    expect(screen.queryAllByText("marketing:7").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("finance:5").length).toBeGreaterThan(0);
  });

  it("wires date-range and export actions", () => {
    render(<AnalyticsWebView />);

    fireEvent.change(screen.getByDisplayValue("2026-05-01"), { target: { value: "2026-05-02" } });
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));

    expect(mockSetDateRange).toHaveBeenCalledWith("2026-05-02", "2026-05-08");
    expect(mockExportData).toHaveBeenCalledWith("csv");
    expect(mockExportData).toHaveBeenCalledWith("json");
  });
});
