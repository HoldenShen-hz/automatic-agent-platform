import { jsx as _jsx } from "react/jsx-runtime";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useTakeoverVm } from "../hooks";
export function TakeoverWebView() {
    const vm = useTakeoverVm();
    return (_jsx(FeatureScaffold, { title: "Admin Takeover Console", summary: "\u7BA1\u7406\u5458\u63A5\u7BA1\u3001\u91CD\u8BD5\u548C\u4EBA\u5DE5\u8986\u76D6\u5165\u53E3\u3002", status: "Implemented/Internal", children: _jsx(FeatureWorkbenchPanel, { items: vm.items, actions: [
                { id: "takeover-start", label: "接管当前任务", tone: "danger", onTrigger: () => vm.takeoverCurrentTask("web-operator") },
                { id: "takeover-annotate", label: "添加人工批注", tone: "neutral", onTrigger: () => vm.annotateCurrentSnapshot("manual-note", "web-operator") },
                { id: "takeover-resume", label: "恢复自动执行", tone: "accent", onTrigger: () => vm.resumeAutomaticExecution("web-operator") },
            ] }) }));
}
