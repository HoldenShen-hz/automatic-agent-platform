import { jsx as _jsx } from "react/jsx-runtime";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useExplainabilityVm } from "../hooks";
export function ExplainabilityWebView() {
    const vm = useExplainabilityVm();
    return (_jsx(FeatureScaffold, { title: "Explainability", summary: "Explainability viewer \u4E0E\u56E0\u679C\u94FE\u8DEF\u5C55\u793A", status: "Planned", children: _jsx(FeatureWorkbenchPanel, { items: vm.items, actions: [
                { id: "explain-chain", label: "展开因果链", tone: "accent", onTrigger: buildWorkbenchActionHandler("explainability", "chain", { deepLinkPath: "/observability/explainability?view=causal-chain" }) },
                { id: "explain-pin", label: "固定证据包", tone: "neutral", onTrigger: buildWorkbenchActionHandler("explainability", "pin", { copySelection: true }) },
                { id: "explain-export", label: "导出解释摘要", tone: "neutral", onTrigger: buildWorkbenchActionHandler("explainability", "export", { copySelection: true }) },
            ] }) }));
}
