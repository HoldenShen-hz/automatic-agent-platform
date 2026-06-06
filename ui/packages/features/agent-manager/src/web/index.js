import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FeatureScaffold, KeyValueTable, ListCard, MetricGrid, Stack, ThreePaneLayout } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useAgentManagerVm } from "../hooks";
export function AgentManagerWebView() {
    const vm = useAgentManagerVm();
    const featureCopy = translateFeatureCopy("agent-manager");
    return (_jsxs(FeatureScaffold, { title: featureCopy.title, summary: featureCopy.summary, status: "Implemented/Partial", children: [_jsx(MetricGrid, { metrics: vm.metrics }), _jsx(ThreePaneLayout, { left: (_jsxs(Stack, { gap: 10, children: [_jsx("h3", { children: "Agents" }), vm.loading ? _jsx("p", { children: "Loading agents..." }) : null, vm.loading ? null : vm.listItems.length === 0 ? _jsx("p", { children: "No agents reported by the backend." }) : vm.listItems.map((item) => (_jsxs("button", { onClick: () => vm.selectAgent(item.id), style: { textAlign: "left" }, type: "button", children: [_jsx("strong", { children: item.title }), _jsx("div", { children: item.subtitle })] }, item.id)))] })), center: vm.loading ? _jsx("p", { children: "Loading agent detail..." }) : vm.selectedAgent == null ? _jsx("p", { children: "No agent selected" }) : (_jsxs(Stack, { gap: 16, children: [_jsx("h3", { children: "Agent detail" }), _jsx(KeyValueTable, { rows: vm.detailRows })] })), right: (_jsxs(Stack, { gap: 12, children: [_jsx("h3", { children: "Supervisor summary" }), _jsx(ListCard, { items: vm.summaryItems })] })) })] }));
}
