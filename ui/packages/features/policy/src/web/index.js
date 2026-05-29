import { jsx as _jsx } from "react/jsx-runtime";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { usePolicyVm } from "../hooks";
export function PolicyWebView() {
    const vm = usePolicyVm();
    return (_jsx(FeatureScaffold, { title: "Policy", summary: "\u6CBB\u7406\u7B56\u7565\u4E0E\u98CE\u9669\u95E8\u7981", status: "Planned", children: _jsx(FeatureWorkbenchPanel, { items: vm.items, actions: [
                { id: "policy-simulate", label: "模拟策略命中", tone: "accent", onTrigger: buildWorkbenchActionHandler("policy", "simulate", { deepLinkPath: "/governance/policy?mode=simulate" }) },
                { id: "policy-publish", label: "发布变更", tone: "neutral", onTrigger: buildWorkbenchActionHandler("policy", "publish", { deepLinkPath: "/governance/policy?mode=publish" }) },
                { id: "policy-rollback", label: "回滚到上版", tone: "danger", onTrigger: buildWorkbenchActionHandler("policy", "rollback", { copySelection: true, deepLinkPath: "/governance/policy?mode=rollback" }) },
            ] }) }));
}
