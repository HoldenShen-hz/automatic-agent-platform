import { jsx as _jsx } from "react/jsx-runtime";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useHealthVm } from "../hooks";
export function HealthWebView() {
    const vm = useHealthVm();
    return (_jsx(FeatureScaffold, { title: "Health", summary: "\u5065\u5EB7\u72B6\u6001\u4E0E\u57FA\u7840\u6307\u6807", status: "Implemented/Contracted", children: _jsx(FeatureWorkbenchPanel, { rows: vm.rows, actions: [
                { id: "health-refresh", label: "刷新健康检查", tone: "accent", disabled: vm.loading, onTrigger: () => vm.refresh(), activityDescription: "已从真实后端 /health 刷新健康报告。" },
                { id: "health-diagnose", label: "生成诊断摘要", tone: "neutral", onTrigger: buildWorkbenchActionHandler("health", "diagnose", { copySelection: true }), activityDescription: "已复制当前健康摘要。" },
                { id: "health-runbook", label: "打开恢复指引", tone: "neutral", onTrigger: buildWorkbenchActionHandler("health", "runbook", { deepLinkPath: "/operations/inspect" }), activityDescription: "已跳转到真实诊断观察页面。" },
            ] }) }));
}
