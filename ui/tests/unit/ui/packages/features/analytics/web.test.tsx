import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const analyticsWebVmMock = vi.hoisted(() => ({
  exportData: vi.fn(),
  setLayer: vi.fn(),
  useAnalyticsVm: vi.fn(),
}));

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
  useAnalyticsVm: analyticsWebVmMock.useAnalyticsVm,
}));

import { AnalyticsWebView } from "../../../../../../packages/features/analytics/src/web";

function createAnalyticsVmOverride(overrides: Record<string, unknown> = {}) {
  return {
    metrics: [{ label: "tasks_total", value: 12 }],
    trendSummary: [1, 2, 3],
    timeSeriesData: [],
    historicalSeriesAvailable: false,
    dateRange: { startDate: "2026-05-01", endDate: "2026-05-08" },
    setDateRange: vi.fn(),
    exportData: analyticsWebVmMock.exportData,
    breakdowns: [{ dimension: "layer", groups: [{ label: "tasks", value: 7 }, { label: "agents", value: 5 }] }],
    availableLayers: ["overview", "tasks", "agents"],
    setLayer: analyticsWebVmMock.setLayer,
    getFilteredMetrics: () => [
      { id: "queue-depth", label: "Queue depth", value: 11, trend: "up", layer: "tasks" },
      { id: "uptime", label: "Uptime", value: 7.95, trend: "down", layer: "overview", description: "Platform uptime percentage." },
    ],
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  analyticsWebVmMock.exportData.mockReset();
  analyticsWebVmMock.setLayer.mockReset();
  analyticsWebVmMock.useAnalyticsVm.mockReset();
});

describe("AnalyticsWebView", () => {
  it("renders truthful snapshot-only analytics surfaces", () => {
    analyticsWebVmMock.useAnalyticsVm.mockReturnValue(createAnalyticsVmOverride());
    render(<AnalyticsWebView />);

    expect(screen.queryAllByText("当前后端发布的是 KPI 当前快照，不是历史 analytics 序列；在专门的历史分析 API 落地前，历史图表保持禁用。").length).toBeGreaterThan(0);
    expect(screen.queryByText("当前后端只发布快照指标，历史时间范围筛选暂不可用。")).not.toBeNull();
    expect(screen.queryAllByText("Queue depth:11").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Uptime:7.95").length).toBeGreaterThan(0);
    expect(screen.getByText("契约边界")).toBeInTheDocument();
    expect(screen.queryAllByText("tasks:7").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("agents:5").length).toBeGreaterThan(0);
  });

  it("wires layer selection and export actions", () => {
    analyticsWebVmMock.useAnalyticsVm.mockReturnValue(createAnalyticsVmOverride());
    render(<AnalyticsWebView />);

    fireEvent.click(screen.getByRole("button", { name: "任务" }));
    fireEvent.click(screen.getByRole("button", { name: "导出 CSV" }));
    fireEvent.click(screen.getByRole("button", { name: "导出 JSON" }));

    expect(analyticsWebVmMock.setLayer).toHaveBeenCalledWith("tasks");
    expect(analyticsWebVmMock.exportData).toHaveBeenCalledWith("csv");
    expect(analyticsWebVmMock.exportData).toHaveBeenCalledWith("json");
  });

  it("renders an explicit empty-layer notice when the selected layer has no live metrics", () => {
    analyticsWebVmMock.useAnalyticsVm.mockReturnValue(createAnalyticsVmOverride({
      getFilteredMetrics: () => [],
    }));

    render(<AnalyticsWebView />);

    expect(screen.getAllByText("No live metrics are available for the selected layer.").length).toBeGreaterThan(0);
  });
});
