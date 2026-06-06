import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FeatureScaffold, KeyValueTable, ListCard, MetricGrid, Stack, ThreePaneLayout } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useExplainabilityVm } from "../hooks";
export function ExplainabilityWebView() {
    const vm = useExplainabilityVm();
    const featureCopy = translateFeatureCopy("explainability");
    return (_jsxs(FeatureScaffold, { title: featureCopy.title, summary: featureCopy.summary, status: "Implemented/Partial", children: [_jsx(MetricGrid, { metrics: vm.metrics }), _jsx(ThreePaneLayout, { left: (_jsxs(Stack, { gap: 10, children: [_jsx("h3", { children: "Explanations" }), vm.loading ? _jsx("p", { children: "Loading explanations..." }) : null, vm.loading ? null : vm.listItems.length === 0 ? _jsx("p", { children: "No explanation summaries available." }) : vm.listItems.map((item) => (_jsxs("button", { onClick: () => vm.selectExplanation(item.id), style: { textAlign: "left" }, type: "button", children: [_jsx("strong", { children: item.title }), _jsx("div", { children: item.subtitle })] }, item.id)))] })), center: vm.loading ? _jsx("p", { children: "Loading explanation detail..." }) : vm.listItems.length === 0 ? _jsx("p", { children: "No explanation summaries available." }) : vm.selectedExplanation == null ? _jsx("p", { children: "No explanation selected" }) : (_jsxs(Stack, { gap: 16, children: [_jsx("h3", { children: "Explanation detail" }), _jsx(KeyValueTable, { rows: vm.detailRows })] })), right: (_jsxs(Stack, { gap: 12, children: [_jsx("h3", { children: "Explainability summary" }), _jsx(ListCard, { items: vm.summaryItems })] })) })] }));
}
