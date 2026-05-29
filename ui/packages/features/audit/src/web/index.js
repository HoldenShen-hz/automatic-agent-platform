import { jsx as _jsx } from "react/jsx-runtime";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useAuditVm } from "../hooks";
export function AuditWebView() {
    const vm = useAuditVm();
    return (_jsx(FeatureScaffold, { title: "Audit", summary: "\u5BA1\u8BA1\u4E0E\u8FFD\u8E2A\u4E2D\u5FC3", status: "Planned", children: _jsx(FeatureWorkbenchPanel, { items: vm.items, actions: [
                { id: "audit-export", label: "导出证据包", tone: "accent", onTrigger: buildWorkbenchActionHandler("audit", "export", { copySelection: true }) },
                { id: "audit-actor", label: "检索 Actor 轨迹", tone: "neutral", onTrigger: buildWorkbenchActionHandler("audit", "actor-trace", { deepLinkPath: "/governance/audit?view=actors" }) },
                { id: "audit-lock", label: "锁定时间窗", tone: "neutral", onTrigger: buildWorkbenchActionHandler("audit", "lock-window", { deepLinkPath: "/governance/audit?view=time-window" }) },
            ] }) }));
}
