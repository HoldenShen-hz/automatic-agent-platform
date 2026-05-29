import { jsx as _jsx } from "react/jsx-runtime";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const mockSetDateRange = vi.fn();
const mockExportData = vi.fn();
vi.mock("@aa/shared-state", () => ({
    useThemeState: () => ({ resolvedThemeName: "dark" }),
}));
vi.mock("@aa/ui-core", () => ({
    EChartSurface: ({ title }) => _jsx("div", { children: title }),
    BarChart: ({ points }) => (_jsx("div", { children: points.map((point) => _jsx("div", { children: `${point.label}:${point.value}` }, point.label)) })),
    FeatureScaffold: ({ children }) => _jsx("div", { children: children }),
    GaugeChart: ({ label, value }) => _jsx("div", { children: `${label}:${value}` }),
    HeatmapGrid: ({ rows, columns }) => _jsx("div", { children: `${rows.length}:${columns.length}` }),
    ListCard: ({ items }) => (_jsx("div", { children: items.map((item) => _jsx("div", { children: item.title }, `${item.title}-${item.description}`)) })),
    MetricGrid: ({ metrics }) => (_jsx("div", { children: metrics.map((metric) => _jsx("div", { children: `${metric.label}: ${metric.value}` }, metric.label)) })),
    MiniTrendBars: ({ values }) => _jsx("div", { children: values.join(",") }),
    PieChart: ({ slices }) => (_jsx("div", { children: slices.map((slice) => _jsx("div", { children: `${slice.label}:${slice.value}` }, slice.label)) })),
    ScatterPlot: ({ points }) => (_jsx("div", { children: points.map((point) => _jsx("div", { children: `${point.label}:${point.x}:${point.y}` }, point.label)) })),
    TimelineChart: ({ points }) => (_jsx("div", { children: points.map((point) => _jsx("div", { children: `${point.label}:${point.value}` }, point.label)) })),
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
        render(_jsx(AnalyticsWebView, {}));
        expect(screen.queryByText("Analytics Trend")).not.toBeNull();
        expect(screen.queryAllByText("2026-05-08:12").length).toBeGreaterThan(0);
        fireEvent.click(screen.getByRole("button", { name: "domain" }));
        expect(screen.queryAllByText("marketing:7").length).toBeGreaterThan(0);
        expect(screen.queryAllByText("finance:5").length).toBeGreaterThan(0);
    });
    it("wires date-range and export actions", () => {
        render(_jsx(AnalyticsWebView, {}));
        fireEvent.change(screen.getByDisplayValue("2026-05-01"), { target: { value: "2026-05-02" } });
        fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
        fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
        expect(mockSetDateRange).toHaveBeenCalledWith("2026-05-02", "2026-05-08");
        expect(mockExportData).toHaveBeenCalledWith("csv");
        expect(mockExportData).toHaveBeenCalledWith("json");
    });
});
