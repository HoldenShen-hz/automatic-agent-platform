import { jsx as _jsx } from "react/jsx-runtime";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useWorkersVm } from "../hooks";
export function WorkersWebView() {
    const vm = useWorkersVm();
    return (_jsx(FeatureScaffold, { title: "Workers", summary: "\u6267\u884C Worker \u8FD0\u884C\u9762\u677F", status: "Implemented/Internal", children: _jsx(FeatureWorkbenchPanel, { metrics: vm.metrics, actions: [
                { id: "workers-drain", label: "排空忙碌 Worker", tone: "accent" },
                { id: "workers-copy", label: "复制 Worker 概览", tone: "neutral" },
                { id: "workers-note", label: "创建排障批注", tone: "neutral" },
            ] }) }));
}
