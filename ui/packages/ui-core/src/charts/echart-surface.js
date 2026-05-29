import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { Suspense, lazy } from "react";
import { designTokens } from "../design-tokens";
const LazyEChartSurfaceRuntime = lazy(async () => import("./echart-surface-runtime").then((module) => ({ default: module.EChartSurfaceRuntime })));
class ChartRuntimeErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { failed: false };
    }
    static getDerivedStateFromError() {
        return { failed: true };
    }
    render() {
        if (this.state.failed) {
            return this.props.fallback;
        }
        return this.props.children;
    }
}
function ChartTableFallback({ title, values }) {
    return (_jsxs("table", { "aria-label": `${title} data table`, style: { width: "100%", borderCollapse: "collapse", marginTop: 12 }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { align: "left", children: "Point" }), _jsx("th", { align: "left", children: "Value" })] }) }), _jsx("tbody", { children: values.map((value, index) => (_jsxs("tr", { children: [_jsx("td", { children: index + 1 }), _jsx("td", { children: value })] }, `${title}-${index + 1}`))) })] }));
}
export function EChartSurface({ title, values, showTableFallback = false, theme = designTokens }) {
    const chartFallback = (_jsxs("div", { children: [_jsx("div", { style: { color: theme.color.subtle, marginBottom: 8 }, children: title }), _jsx("div", { "aria-label": `${title}: ${values.join(", ")}`, style: {
                    height: 220,
                    border: `1px solid ${theme.color.border}`,
                    borderRadius: theme.radius.md,
                    background: theme.color.surfaceElevated,
                } })] }));
    return (_jsxs("div", { children: [_jsx(ChartRuntimeErrorBoundary, { fallback: chartFallback, children: _jsx(Suspense, { fallback: chartFallback, children: _jsx(LazyEChartSurfaceRuntime, { title: title, values: values, theme: theme }) }) }), showTableFallback ? _jsx(ChartTableFallback, { title: title, values: values }) : null] }));
}
