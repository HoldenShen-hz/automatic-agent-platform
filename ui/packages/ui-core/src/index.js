import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { createElement } from "react";
import { createRouteGuardChain } from "@aa/shared-domain";
import { FeatureScaffold } from "./components";
import { designTokens } from "./design-tokens";
export { createSystemHealthSummary, SystemStatusBar } from "./business";
export { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbench, FeatureWorkbenchPanel, KeyValueTable, ListCard, StatusPill, } from "./components";
export { BarChart, EChartSurface, GaugeChart, HeatmapGrid, MetricGrid, MiniTrendBars, PieChart, ScatterPlot, SparklineBars, TimelineChart, } from "./charts";
export { createPanelStyle, designTokens } from "./design-tokens";
export { CodeBlock, DAGVisualization, FileAttachment, Timeline } from "./components/extended";
export { Inline, LayoutFrame, Stack, ThreePaneLayout } from "./layouts";
export { applyResolvedTheme, darkTheme, highContrastTheme, lightTheme, resolveTheme } from "./themes";
class FeatureModuleErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
        return { error };
    }
    render() {
        if (this.state.error == null) {
            return this.props.children;
        }
        const message = this.state.error.message;
        return (_jsx(FeatureScaffold, { title: this.props.title, summary: this.props.summary, status: this.props.status, children: _jsxs("div", { role: "alert", children: [_jsx("strong", { children: "\u7EC4\u4EF6\u6E32\u67D3\u5931\u8D25" }), _jsx("p", { style: { marginBottom: 0 }, children: message })] }) }));
    }
}
export function createFeatureModule(config) {
    const platforms = config.platforms ?? ["web", "windows", "macos", "linux", "android", "ios"];
    const renderFeature = config.render ?? (() => (_jsx(FeatureScaffold, { title: config.title, summary: config.summary, status: config.status, children: _jsx("p", { style: { color: designTokens.color.text, margin: 0 }, children: config.kind === "planned" ? "This feature is wired through a contract seam and feature gate." : "This feature is connected to the shared UI baseline." }) })));
    const RenderFeature = () => renderFeature();
    const Component = () => createElement(FeatureModuleErrorBoundary, {
        title: config.title,
        summary: config.summary,
        status: config.status,
    }, createElement(RenderFeature));
    return {
        manifest: {
            id: config.id,
            title: config.title,
            group: config.group,
            path: config.path,
            status: config.status,
            kind: config.kind ?? (config.status === "Planned" ? "planned" : "implemented"),
            platforms,
            permission: config.permission,
            apiLayer: config.apiLayer ?? "C",
            summary: config.summary,
        },
        route: {
            path: config.path,
            featureId: config.id,
            group: config.group,
            title: config.title,
            permission: config.permission,
            platforms,
            codeSplit: true,
        },
        Component,
    };
}
export function createFeatureGuard(permission, flag) {
    return createRouteGuardChain(permission, flag);
}
