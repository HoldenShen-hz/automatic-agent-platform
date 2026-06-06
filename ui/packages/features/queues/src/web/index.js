import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useQueuesVm } from "../hooks";
export function QueuesWebView() {
    const vm = useQueuesVm();
    const featureCopy = translateFeatureCopy("queues");
    return (_jsxs(FeatureScaffold, { title: featureCopy.title, summary: featureCopy.summary, status: "Implemented/Internal", children: [vm.loading ? _jsx("p", { children: "Loading queues..." }) : null, _jsx(FeatureWorkbenchPanel, { metrics: vm.metrics, actions: [
                    { id: "queues-refresh", label: "刷新积压", tone: "accent", disabled: vm.loading, onTrigger: () => vm.refresh(), activityDescription: "已从真实后端刷新队列状态。" },
                    { id: "queues-export", label: "导出 DLQ 摘要", tone: "neutral", disabled: vm.loading, onTrigger: buildWorkbenchActionHandler("queues", "export", { copySelection: true }), activityDescription: "已复制当前队列摘要。" },
                    { id: "queues-retry", label: "清理重试队列", tone: "neutral", disabled: vm.loading || vm.retryQueueDepth === 0, onTrigger: () => vm.cleanupRetryQueue(), activityDescription: "已清理重试队列中的待重试任务。" },
                ] })] }));
}
