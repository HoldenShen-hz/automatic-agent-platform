import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { designTokens } from "../design-tokens";
import { PieChart, TimelineChart } from "../components/extended";
export { EChartSurface } from "./echart-surface";
function resolveChartTone(tone) {
    switch (tone) {
        case "accent":
            return designTokens.color.accent;
        case "danger":
            return designTokens.color.danger;
        case "warning":
            return designTokens.color.warning;
        case "info":
            return designTokens.color.info;
        case "success":
            return designTokens.semantic.color.success;
        case "planned":
            return designTokens.color.planned;
        case "neutral":
        case undefined:
            return designTokens.color.accent;
        default:
            return designTokens.color.accent;
    }
}
function withAlpha(hexColor, alpha) {
    const normalized = hexColor.replace("#", "");
    if (normalized.length !== 6) {
        return hexColor;
    }
    const red = Number.parseInt(normalized.slice(0, 2), 16);
    const green = Number.parseInt(normalized.slice(2, 4), 16);
    const blue = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
function ChartDataTable({ caption, headers, rows }) {
    return (_jsxs("details", { style: { marginTop: 12 }, children: [_jsx("summary", { children: caption }), _jsxs("table", { style: { width: "100%", borderCollapse: "collapse", marginTop: 8 }, children: [_jsx("thead", { children: _jsx("tr", { children: headers.map((header) => _jsx("th", { align: "left", children: header }, header)) }) }), _jsx("tbody", { children: rows.map((row, index) => (_jsx("tr", { children: row.map((cell, cellIndex) => _jsx("td", { children: cell }, `${caption}-${index}-${cellIndex}`)) }, `${caption}-${index}`))) })] })] }));
}
export function MetricGrid({ metrics }) {
    return (_jsx("div", { role: "group", "aria-label": "Metric summary grid", style: { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }, children: metrics.map((metric) => (_jsxs("div", { role: "group", "aria-label": `${metric.label}: ${metric.value}`, style: { border: `1px solid ${designTokens.color.border}`, borderRadius: designTokens.radius.md, padding: 14 }, children: [_jsx("div", { style: { color: designTokens.color.subtle, fontSize: 12 }, children: metric.label }), _jsx("div", { style: { color: designTokens.color.text, fontSize: 24, fontWeight: 700 }, children: metric.value })] }, metric.label))) }));
}
export function MiniTrendBars({ values }) {
    const maxValue = Math.max(...values, 1);
    return (_jsx("div", { role: "img", "aria-label": `Trend values: ${values.join(", ")}`, style: { display: "flex", gap: 6, alignItems: "flex-end", minHeight: 44 }, children: values.map((value, index) => (_jsx("span", { style: {
                width: 10,
                height: `${Math.max(8, (value / maxValue) * 44)}px`,
                borderRadius: 999,
                background: designTokens.color.accent,
                opacity: 0.65 + index / Math.max(values.length, 1) * 0.35,
            } }, `${index}-${value}`))) }));
}
export function SparklineBars({ values }) {
    return _jsx(MiniTrendBars, { values: values });
}
export function BarChart({ points, }) {
    const max = Math.max(...points.map((point) => point.value), 1);
    return (_jsxs("div", { style: { display: "grid", gap: 10 }, children: [_jsx("div", { role: "img", "aria-label": `Bar chart: ${points.map((point) => `${point.label} ${point.value}`).join(", ")}`, children: _jsx("div", { style: { display: "flex", alignItems: "flex-end", gap: 10, minHeight: 160 }, children: points.map((point, index) => (_jsxs("div", { style: { flex: 1, display: "grid", gap: 8 }, children: [_jsx("div", { style: {
                                    height: `${Math.max(16, (point.value / max) * 150)}px`,
                                    borderRadius: `${designTokens.radius.md} ${designTokens.radius.md} 0 0`,
                                    background: resolveChartTone(point.tone),
                                    opacity: 0.72 + index / Math.max(points.length, 1) * 0.2,
                                } }), _jsx("div", { style: { color: designTokens.color.subtle, fontSize: 12, textAlign: "center" }, children: point.label })] }, `${point.label}-${index}`))) }) }), _jsx(ChartDataTable, { caption: "Bar chart data", headers: ["Label", "Value"], rows: points.map((point) => [point.label, point.value]) })] }));
}
export function ScatterPlot({ points, }) {
    const minX = Math.min(...points.map((point) => point.x), 0);
    const maxX = Math.max(...points.map((point) => point.x), 1);
    const minY = Math.min(...points.map((point) => point.y), 0);
    const maxY = Math.max(...points.map((point) => point.y), 1);
    const xRange = Math.max(maxX - minX, 1);
    const yRange = Math.max(maxY - minY, 1);
    return (_jsxs("div", { children: [_jsxs("svg", { viewBox: "0 0 220 160", role: "img", "aria-label": `Scatter plot: ${points.map((point) => `${point.label} ${point.x},${point.y}`).join("; ")}`, style: { width: "100%", minHeight: 160 }, children: [_jsx("rect", { x: "0", y: "0", width: "220", height: "160", rx: "16", fill: designTokens.color.surfaceElevated, stroke: designTokens.color.border }), points.map((point, index) => (_jsxs("g", { children: [_jsx("circle", { cx: 24 + ((point.x - minX) / xRange) * 172, cy: 132 - ((point.y - minY) / yRange) * 100, r: "6", fill: index % 2 === 0 ? designTokens.color.accent : designTokens.color.info }), _jsx("title", { children: `${point.label}: ${point.x}, ${point.y}` })] }, `${point.label}-${index}`)))] }), _jsx(ChartDataTable, { caption: "Scatter plot data", headers: ["Label", "X", "Y"], rows: points.map((point) => [point.label, point.x, point.y]) })] }));
}
export function GaugeChart({ label, value, max = 100, }) {
    const ratio = Math.max(0, Math.min(1, value / Math.max(max, 1)));
    return (_jsxs("div", { style: { display: "grid", gap: 12, justifyItems: "center" }, children: [_jsxs("div", { role: "img", "aria-label": `${label}: ${Math.round(ratio * 100)}%`, children: [_jsx("div", { style: {
                            width: 144,
                            height: 144,
                            borderRadius: "50%",
                            border: `1px solid ${designTokens.color.border}`,
                            background: `conic-gradient(${designTokens.color.accent} 0 ${ratio * 360}deg, ${designTokens.color.surfaceElevated} ${ratio * 360}deg 360deg)`,
                        } }), _jsxs("div", { style: { textAlign: "center" }, children: [_jsx("div", { style: { color: designTokens.color.subtle, fontSize: 12 }, children: label }), _jsxs("div", { style: { color: designTokens.color.text, fontSize: 24, fontWeight: 700 }, children: [Math.round(ratio * 100), "%"] })] })] }), _jsx(ChartDataTable, { caption: `${label} gauge data`, headers: ["Label", "Value", "Max"], rows: [[label, value, max]] })] }));
}
export function HeatmapGrid({ rows, columns, values, }) {
    const maxValue = Math.max(...values.flat(), 1);
    return (_jsxs("div", { style: { display: "grid", gap: 8 }, children: [_jsx("div", { role: "img", "aria-label": `Heatmap grid: ${rows.length} rows by ${columns.length} columns`, children: _jsxs("div", { style: { display: "grid", gridTemplateColumns: `96px repeat(${columns.length}, minmax(0, 1fr))`, gap: 6 }, children: [_jsx("span", { "aria-hidden": "true" }), columns.map((column) => (_jsx("span", { style: { color: designTokens.color.subtle, fontSize: 12, textAlign: "center" }, children: column }, column))), rows.map((row, rowIndex) => (_jsxs("div", { style: { display: "contents" }, children: [_jsx("span", { style: { color: designTokens.color.subtle, fontSize: 12 }, children: row }), columns.map((column, columnIndex) => {
                                    const value = values[rowIndex]?.[columnIndex] ?? 0;
                                    const alpha = 0.12 + (value / maxValue) * 0.72;
                                    return (_jsx("span", { title: `${row} / ${column}: ${value}`, style: {
                                            minHeight: 32,
                                            borderRadius: designTokens.radius.sm,
                                            border: `1px solid ${designTokens.color.border}`,
                                            background: withAlpha(designTokens.color.accent, Number(alpha.toFixed(2))),
                                        } }, `${row}-${column}`));
                                })] }, row)))] }) }), _jsx(ChartDataTable, { caption: "Heatmap data", headers: ["Row", ...columns], rows: rows.map((row, rowIndex) => [row, ...columns.map((_column, columnIndex) => values[rowIndex]?.[columnIndex] ?? 0)]) })] }));
}
export { PieChart, TimelineChart };
