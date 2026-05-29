import { jsx as _jsx } from "react/jsx-runtime";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useStabilityVm } from "../hooks";
export function StabilityWebView() {
    const vm = useStabilityVm();
    const featureCopy = translateFeatureCopy("stability");
    return (_jsx(FeatureScaffold, { title: featureCopy.title, summary: featureCopy.summary, status: "Implemented/Internal", children: _jsx(FeatureWorkbenchPanel, { metrics: vm.metrics, rows: vm.rows, items: vm.items, actions: [
                { id: "stability-runbook", label: "生成修复 Runbook", tone: "accent" },
                { id: "stability-escalate", label: "升级高优先级事件", tone: "danger" },
                { id: "stability-export", label: "导出恢复摘要", tone: "neutral" },
            ] }) }));
}
