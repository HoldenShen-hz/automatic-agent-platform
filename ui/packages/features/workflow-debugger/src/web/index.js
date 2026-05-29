import { jsx as _jsx } from "react/jsx-runtime";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useWorkflowDebuggerVm } from "../hooks";
export function WorkflowDebuggerWebView() {
    const vm = useWorkflowDebuggerVm();
    return (_jsx(FeatureScaffold, { title: "Workflow Debugger", summary: "\u8C03\u8BD5\u5668\u3001\u65F6\u95F4\u7EBF\u548C\u6570\u636E\u6D41\u56DE\u653E", status: "Planned", children: _jsx(FeatureWorkbenchPanel, { items: vm.items, actions: [
                { id: "debugger-replay", label: "回放时间线", tone: "accent", onTrigger: buildWorkbenchActionHandler("workflow-debugger", "replay", { deepLinkPath: "/extended/workflow-debugger?mode=replay" }) },
                { id: "debugger-failure", label: "定位失败阶段", tone: "neutral", onTrigger: buildWorkbenchActionHandler("workflow-debugger", "failure", { deepLinkPath: "/extended/workflow-debugger?view=failure" }) },
                { id: "debugger-export", label: "导出调试快照", tone: "neutral", onTrigger: buildWorkbenchActionHandler("workflow-debugger", "export", { copySelection: true }) },
            ] }) }));
}
