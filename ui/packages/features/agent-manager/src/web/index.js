import { jsx as _jsx } from "react/jsx-runtime";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useAgentManagerVm } from "../hooks";
export function AgentManagerWebView() {
    const vm = useAgentManagerVm();
    return (_jsx(FeatureScaffold, { title: "Agent Manager", summary: "Agent \u5B9E\u65F6\u76D1\u63A7\u4E2D\u5FC3\u4E0E\u8BE6\u60C5\u9875", status: "Planned", children: _jsx(FeatureWorkbenchPanel, { metrics: vm.metrics, items: vm.items, actions: [
                { id: "agent-isolate", label: "隔离异常 Agent", tone: "danger", onTrigger: buildWorkbenchActionHandler("agent-manager", "isolate", { deepLinkPath: "/operations/agents?mode=isolate" }) },
                { id: "agent-trend", label: "查看负载趋势", tone: "neutral", onTrigger: buildWorkbenchActionHandler("agent-manager", "trend", { deepLinkPath: (item) => item == null ? "/operations/agents" : `/operations/agents?focus=${encodeURIComponent(item.id)}` }) },
                { id: "agent-summary", label: "复制治理摘要", tone: "neutral", onTrigger: buildWorkbenchActionHandler("agent-manager", "summary", { copySelection: true }) },
            ] }) }));
}
