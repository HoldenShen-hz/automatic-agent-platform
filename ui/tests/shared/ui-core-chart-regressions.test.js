import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.hoisted(() => {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
});
import { BarChart, EChartSurface, GaugeChart, HeatmapGrid, ScatterPlot } from "../../packages/ui-core/src/charts";
import { EChartSurfaceRuntime } from "../../packages/ui-core/src/charts/echart-surface-runtime";
import { MetricGrid, MiniTrendBars } from "../../packages/ui-core/src/charts";
import { PieChart } from "../../packages/ui-core/src/components/extended";
import { designTokens } from "../../packages/ui-core/src/design-tokens";
const chartApi = {
    setOption: vi.fn(),
    appendData: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
};
vi.mock("echarts/core", () => ({
    init: vi.fn(() => chartApi),
    use: vi.fn(),
}));
describe("ui-core chart regressions", () => {
    beforeEach(() => {
        chartApi.setOption.mockClear();
        chartApi.appendData.mockClear();
        chartApi.resize.mockClear();
        chartApi.dispose.mockClear();
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });
    it("renders the accessible table fallback for screen-reader friendly chart access", () => {
        render(_jsx(EChartSurface, { title: "Throughput", values: [2, 4, 6], showTableFallback: true }));
        expect(screen.queryByRole("table", { name: "Throughput data table" })).not.toBeNull();
        expect(screen.queryByText("Value")).not.toBeNull();
    });
    it("exposes semantic metric and trend summaries for assistive technology", async () => {
        render(_jsxs("div", { children: [_jsx(MetricGrid, { metrics: [{ label: "Open Tasks", value: 12 }] }), _jsx(MiniTrendBars, { values: [8, 12, 16] })] }));
        expect(screen.queryByRole("group", { name: "Metric summary grid" })).not.toBeNull();
        expect(screen.queryByRole("group", { name: "Open Tasks: 12" })).not.toBeNull();
        expect(screen.queryByRole("img", { name: "Trend values: 8, 12, 16" })).not.toBeNull();
    });
    it("configures data zoom, theme-aware colors, and ResizeObserver-based reflow in chart runtime", () => {
        const observe = vi.fn();
        const disconnect = vi.fn();
        const resizeObserver = vi.fn(function ResizeObserverMock() {
            return { observe, disconnect };
        });
        vi.stubGlobal("ResizeObserver", resizeObserver);
        const originalUserAgent = window.navigator.userAgent;
        Object.defineProperty(window.navigator, "userAgent", {
            configurable: true,
            value: "vitest-browser",
        });
        render(_jsx(EChartSurfaceRuntime, { title: "Latency", values: [1, 3, 2], theme: {
                ...designTokens,
                color: {
                    ...designTokens.color,
                    accent: "#123456",
                    border: "#345678",
                    subtle: "#56789a",
                    surfaceElevated: "#abcdef",
                },
            } }));
        expect(chartApi.setOption).toHaveBeenCalledTimes(1);
        const option = chartApi.setOption.mock.calls[0]?.[0];
        expect(option.aria.enabled).toBe(true);
        expect(option.aria.decal.show).toBe(true);
        expect(option.dataZoom).toHaveLength(2);
        expect(option.series[0]?.lineStyle.color).toBe("#123456");
        expect(option.series[0]?.areaStyle.color).toBe("rgba(18, 52, 86, 0.18)");
        expect(option.series[0]?.decal).not.toBeNull();
        expect(option.yAxis.splitLine.lineStyle.color).toBe("rgba(52, 86, 120, 0.3)");
        expect(observe).toHaveBeenCalledTimes(1);
        expect(resizeObserver).toHaveBeenCalledTimes(1);
        expect(chartApi.appendData).not.toHaveBeenCalled();
        Object.defineProperty(window.navigator, "userAgent", {
            configurable: true,
            value: originalUserAgent,
        });
    });
    it("reuses the same chart instance and appends series data for append-only updates", () => {
        const observe = vi.fn();
        const disconnect = vi.fn();
        const resizeObserver = vi.fn(function ResizeObserverMock() {
            return { observe, disconnect };
        });
        vi.stubGlobal("ResizeObserver", resizeObserver);
        const originalUserAgent = window.navigator.userAgent;
        Object.defineProperty(window.navigator, "userAgent", {
            configurable: true,
            value: "vitest-browser",
        });
        const { rerender } = render(_jsx(EChartSurfaceRuntime, { title: "Latency", values: [1, 2] }));
        rerender(_jsx(EChartSurfaceRuntime, { title: "Latency", values: [1, 2, 3, 4] }));
        expect(chartApi.setOption).toHaveBeenCalledTimes(2);
        expect(chartApi.appendData).toHaveBeenCalledWith({
            seriesIndex: 0,
            data: [3, 4],
        });
        Object.defineProperty(window.navigator, "userAgent", {
            configurable: true,
            value: originalUserAgent,
        });
    });
    it("re-renders the chart when theme colors change across rerenders", () => {
        const observe = vi.fn();
        const disconnect = vi.fn();
        const resizeObserver = vi.fn(function ResizeObserverMock() {
            return { observe, disconnect };
        });
        vi.stubGlobal("ResizeObserver", resizeObserver);
        const originalUserAgent = window.navigator.userAgent;
        Object.defineProperty(window.navigator, "userAgent", {
            configurable: true,
            value: "vitest-browser",
        });
        const { rerender } = render(_jsx(EChartSurfaceRuntime, { title: "Latency", values: [1, 2], theme: {
                ...designTokens,
                color: {
                    ...designTokens.color,
                    accent: "#123456",
                    border: "#345678",
                    surfaceElevated: "#abcdef",
                },
            } }));
        rerender(_jsx(EChartSurfaceRuntime, { title: "Latency", values: [1, 2], theme: {
                ...designTokens,
                color: {
                    ...designTokens.color,
                    accent: "#654321",
                    border: "#876543",
                    surfaceElevated: "#fedcba",
                },
            } }));
        expect(chartApi.setOption).toHaveBeenCalledTimes(2);
        const latestOption = chartApi.setOption.mock.calls.at(-1)?.[0];
        expect(latestOption.series[0]?.lineStyle.color).toBe("#654321");
        expect(latestOption.yAxis.axisLine.lineStyle.color).toBe("#876543");
        expect(latestOption.dataZoom[1]?.backgroundColor).toBe("rgba(254, 220, 186, 0.9)");
        Object.defineProperty(window.navigator, "userAgent", {
            configurable: true,
            value: originalUserAgent,
        });
    });
    it("recomputes aria metadata when the title changes across rerenders", () => {
        const observe = vi.fn();
        const disconnect = vi.fn();
        const resizeObserver = vi.fn(function ResizeObserverMock() {
            return { observe, disconnect };
        });
        vi.stubGlobal("ResizeObserver", resizeObserver);
        const originalUserAgent = window.navigator.userAgent;
        Object.defineProperty(window.navigator, "userAgent", {
            configurable: true,
            value: "vitest-browser",
        });
        const { rerender, unmount } = render(_jsx(EChartSurfaceRuntime, { title: "Latency", values: [1, 2] }));
        rerender(_jsx(EChartSurfaceRuntime, { title: "Throughput", values: [1, 2] }));
        unmount();
        render(_jsx(EChartSurfaceRuntime, { title: "Recovered", values: [3, 4] }));
        const latestOption = chartApi.setOption.mock.calls.at(-1)?.[0];
        expect(latestOption.aria.description).toContain("Recovered");
        Object.defineProperty(window.navigator, "userAgent", {
            configurable: true,
            value: originalUserAgent,
        });
    });
    it("renders accessible data tables for svg and div chart primitives", () => {
        render(_jsxs("div", { children: [_jsx(BarChart, { points: [{ label: "A", value: 3, tone: "javascript:alert(1)" }] }), _jsx(ScatterPlot, { points: [{ label: "Q1", x: -4, y: 6 }] }), _jsx(GaugeChart, { label: "Readiness", value: 42, max: 100 }), _jsx(HeatmapGrid, { rows: ["North"], columns: ["Open"], values: [[3]] })] }));
        expect(screen.getByText("Bar chart data")).toBeInTheDocument();
        expect(screen.getByText("Scatter plot data")).toBeInTheDocument();
        expect(screen.getByText("Readiness gauge data")).toBeInTheDocument();
        expect(screen.getByText("Heatmap data")).toBeInTheDocument();
        expect(screen.getByTitle("North / Open: 3")).toBeInTheDocument();
    });
    it("describes pie slices and keeps conic gradient stops numerically stable", () => {
        render(_jsx(PieChart, { slices: Array.from({ length: 128 }, (_, index) => ({ label: `Slice ${index + 1}`, value: 1 })) }));
        const chart = screen.getByRole("img", { name: "Pie chart" });
        expect(chart).toHaveAccessibleDescription(/Slice 1: 1/);
        expect(chart.style.background).toContain("100.0000%");
    });
});
