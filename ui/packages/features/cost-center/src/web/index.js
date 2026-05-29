import { jsx as _jsx } from "react/jsx-runtime";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useCostCenterVm } from "../hooks";
export function CostCenterWebView() {
    const vm = useCostCenterVm();
    return (_jsx(FeatureScaffold, { title: "Cost Center", summary: "\u6210\u672C\u4E2D\u5FC3\u4E0E\u9884\u7B97\u89C6\u56FE", status: "Planned", children: _jsx(FeatureWorkbenchPanel, { items: vm.items, actions: [
                { id: "cost-refresh", label: "刷新预算告警", tone: "accent", onTrigger: buildWorkbenchActionHandler("cost-center", "refresh", { deepLinkPath: "/operations/cost-center?mode=refresh" }) },
                { id: "cost-drill", label: "下钻成本项", tone: "neutral", onTrigger: buildWorkbenchActionHandler("cost-center", "drill", { deepLinkPath: "/operations/cost-center?view=drilldown" }) },
                { id: "cost-export", label: "导出成本报表", tone: "neutral", onTrigger: buildWorkbenchActionHandler("cost-center", "export", { copySelection: true }) },
            ] }) }));
}
