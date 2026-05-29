import { jsx as _jsx } from "react/jsx-runtime";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useMarketplaceVm } from "../hooks";
export function MarketplaceWebView() {
    const vm = useMarketplaceVm();
    return (_jsx(FeatureScaffold, { title: "Marketplace", summary: "Marketplace \u5217\u8868\u3001\u8BE6\u60C5\u548C\u5B89\u88C5\u6D41\u7A0B", status: "Planned", children: _jsx(FeatureWorkbenchPanel, { items: vm.items, actions: [
                { id: "marketplace-preview", label: "预览安装影响", tone: "accent", onTrigger: buildWorkbenchActionHandler("marketplace", "preview", { deepLinkPath: "/extended/marketplace?mode=preview" }) },
                { id: "marketplace-shortlist", label: "加入候选清单", tone: "neutral", onTrigger: buildWorkbenchActionHandler("marketplace", "shortlist", { copySelection: true }) },
                { id: "marketplace-approval", label: "发起安装审批", tone: "danger", onTrigger: buildWorkbenchActionHandler("marketplace", "approval", { deepLinkPath: "/extended/marketplace?mode=approval" }) },
            ] }) }));
}
