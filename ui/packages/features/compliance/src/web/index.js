import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useComplianceVm } from "../hooks";
export function ComplianceWebView() {
    const vm = useComplianceVm();
    return (_jsxs(FeatureScaffold, { title: "Compliance", summary: "\u5408\u89C4\u4E2D\u5FC3\u4E0E\u62A5\u544A\u51FA\u53E3", status: "Implemented/Partial", children: [vm.loading ? _jsx("p", { children: "Loading compliance overview..." }) : null, vm.loadError != null ? _jsx("p", { children: vm.loadError }) : null, _jsx(FeatureWorkbenchPanel, { metrics: vm.metrics, rows: vm.rows, items: vm.items, actions: [] })] }));
}
