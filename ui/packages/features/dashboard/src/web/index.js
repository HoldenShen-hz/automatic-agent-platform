import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { EChartSurface, FeatureScaffold, MetricGrid, createPanelStyle, designTokens, resolveTheme, } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useThemeState } from "@aa/shared-state";
import { useDashboardVm } from "../hooks";
export function DashboardWebView() {
    const vm = useDashboardVm();
    const featureCopy = translateFeatureCopy("dashboard");
    const resolvedColorScheme = useThemeState((state) => state.resolvedColorScheme);
    const theme = resolveTheme(resolvedColorScheme);
    return (_jsx(FeatureScaffold, { title: featureCopy.title, summary: featureCopy.summary, status: "Implemented/Internal", children: vm.loading ? (_jsx("p", { children: translateMessage("ui.dashboard.loading") })) : (_jsxs(_Fragment, { children: [_jsx(MetricGrid, { metrics: vm.metrics }), _jsxs("section", { style: {
                        ...createPanelStyle(designTokens.color.success),
                        marginTop: 16,
                    }, children: [_jsx("h3", { style: { color: designTokens.color.text, marginTop: 0 }, children: translateMessage("ui.dashboard.validationDrilldown") }), _jsx("p", { style: { color: designTokens.color.subtle }, children: vm.drilldownTrail.join(" -> ") }), _jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 }, children: vm.operatorWorkflowChecks.map((workflow) => (_jsx("span", { style: {
                                    border: `1px solid ${designTokens.color.border}`,
                                    borderRadius: 999,
                                    color: designTokens.color.text,
                                    padding: "4px 10px",
                                }, children: workflow }, workflow))) })] }), _jsx("div", { style: { display: "grid", gap: 16, marginTop: 16 }, children: vm.panelGroups.map((group) => (_jsxs("section", { style: createPanelStyle(designTokens.color.border), children: [_jsxs("header", { style: { marginBottom: 12 }, children: [_jsx("h3", { style: { color: designTokens.color.text, margin: 0 }, children: group.title }), _jsx("p", { style: {
                                            color: designTokens.color.subtle,
                                            marginBottom: 0,
                                        }, children: group.description })] }), _jsx("div", { style: {
                                    display: "grid",
                                    gap: 12,
                                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                                }, children: group.panels.map((panel) => (_jsxs("article", { style: createPanelStyle(designTokens.color.info), children: [_jsx("div", { style: {
                                                color: designTokens.color.subtle,
                                                fontSize: 12,
                                            }, children: panel.title }), _jsx("div", { style: {
                                                color: designTokens.color.text,
                                                fontSize: 24,
                                                fontWeight: 700,
                                                marginTop: 8,
                                            }, children: panel.value }), _jsx("p", { style: {
                                                color: designTokens.color.subtle,
                                                marginBottom: 0,
                                            }, children: panel.description })] }, panel.id))) })] }, group.id))) }), _jsx("div", { style: { marginTop: 16 }, children: _jsx(EChartSurface, { title: translateMessage("ui.dashboard.trendTitle"), values: vm.trendValues, theme: theme }) })] })) }));
}
