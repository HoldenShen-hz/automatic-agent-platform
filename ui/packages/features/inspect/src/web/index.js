import { jsx as _jsx } from "react/jsx-runtime";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useInspectVm } from "../hooks";
export function InspectWebView() {
    const vm = useInspectVm();
    return (_jsx(FeatureScaffold, { title: "Inspect", summary: "Inspect \u548C operator snapshot \u89C6\u56FE\u3002", status: "Planned", children: _jsx(FeatureWorkbenchPanel, { items: vm.items, actions: [
                { id: "inspect-snapshot", label: "抓取快照", tone: "accent", onTrigger: buildWorkbenchActionHandler("inspect", "snapshot", { deepLinkPath: "/operations/inspect?mode=snapshot" }) },
                { id: "inspect-compare", label: "对比上次执行", tone: "neutral", onTrigger: buildWorkbenchActionHandler("inspect", "compare", { deepLinkPath: "/operations/inspect?view=compare" }) },
                { id: "inspect-export", label: "导出证据链", tone: "neutral", onTrigger: buildWorkbenchActionHandler("inspect", "export", { copySelection: true }) },
            ] }) }));
}
