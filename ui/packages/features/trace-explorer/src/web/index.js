import { jsx as _jsx } from "react/jsx-runtime";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useTraceExplorerVm } from "../hooks";
export function TraceExplorerWebView() {
    const vm = useTraceExplorerVm();
    return (_jsx(FeatureScaffold, { title: "Trace Explorer", summary: "\u6309 trace / receipt / artifact \u8FFD\u8E2A\u8FD0\u884C\u4E8B\u5B9E", status: "Planned", children: _jsx(FeatureWorkbenchPanel, { items: vm.items, actions: [
                { id: "trace-explorer-open", label: "打开 Trace", tone: "accent", onTrigger: buildWorkbenchActionHandler("trace-explorer", "open", { deepLinkPath: "/observability/trace-explorer?view=trace" }) },
                { id: "trace-explorer-filter", label: "过滤受限事件", tone: "neutral", onTrigger: buildWorkbenchActionHandler("trace-explorer", "filter", { deepLinkPath: "/observability/trace-explorer?view=restricted" }) },
                { id: "trace-explorer-export", label: "导出追踪包", tone: "neutral", onTrigger: buildWorkbenchActionHandler("trace-explorer", "export", { copySelection: true }) },
            ] }) }));
}
