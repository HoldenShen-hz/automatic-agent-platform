import { jsx as _jsx } from "react/jsx-runtime";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useDispatchVm } from "../hooks";
export function DispatchWebView() {
    const vm = useDispatchVm();
    return (_jsx(FeatureScaffold, { title: "Dispatch", summary: "\u8C03\u5EA6\u3001\u6267\u884C\u548C\u64CD\u4F5C\u5165\u53E3\u3002", status: "Planned", children: _jsx(FeatureWorkbenchPanel, { items: vm.items, actions: [
                { id: "dispatch-now", label: "立即派发", tone: "accent", onTrigger: buildWorkbenchActionHandler("dispatch", "dispatch-now", { deepLinkPath: "/operations/dispatch?mode=dispatch-now" }) },
                { id: "dispatch-priority", label: "重排优先级", tone: "neutral", onTrigger: buildWorkbenchActionHandler("dispatch", "priority", { deepLinkPath: "/operations/dispatch?view=priority" }) },
                { id: "dispatch-approval", label: "转人工审批", tone: "danger", onTrigger: buildWorkbenchActionHandler("dispatch", "approval", { deepLinkPath: "/operations/dispatch?mode=approval" }) },
            ] }) }));
}
