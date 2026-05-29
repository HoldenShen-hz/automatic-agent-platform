import { jsx as _jsx } from "react/jsx-runtime";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useQueuesVm } from "../hooks";
export function QueuesWebView() {
    const vm = useQueuesVm();
    return (_jsx(FeatureScaffold, { title: "Queues", summary: "\u961F\u5217\u4E0E DLQ \u76D1\u63A7\u9762\u677F", status: "Implemented/Internal", children: _jsx(FeatureWorkbenchPanel, { metrics: vm.metrics, actions: [
                { id: "queues-refresh", label: "刷新积压", tone: "accent" },
                { id: "queues-retry", label: "清理重试队列", tone: "neutral" },
                { id: "queues-export", label: "导出 DLQ 摘要", tone: "neutral" },
            ] }) }));
}
