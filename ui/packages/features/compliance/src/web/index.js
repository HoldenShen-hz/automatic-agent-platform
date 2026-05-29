import { jsx as _jsx } from "react/jsx-runtime";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useComplianceVm } from "../hooks";
export function ComplianceWebView() {
    const vm = useComplianceVm();
    return (_jsx(FeatureScaffold, { title: "Compliance", summary: "\u5408\u89C4\u4E2D\u5FC3\u4E0E\u62A5\u544A\u51FA\u53E3", status: "Planned", children: _jsx(FeatureWorkbenchPanel, { metrics: vm.metrics, rows: vm.rows, items: vm.items, actions: [
                { id: "compliance-run", label: "运行检查", tone: "accent" },
                { id: "compliance-export", label: "导出报告", tone: "neutral" },
                { id: "compliance-escalate", label: "升级治理", tone: "danger" },
            ] }) }));
}
