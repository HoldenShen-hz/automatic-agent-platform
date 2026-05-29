import { jsx as _jsx } from "react/jsx-runtime";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useMemoryReviewVm } from "../hooks";
export function MemoryReviewWebView() {
    const vm = useMemoryReviewVm();
    return (_jsx(FeatureScaffold, { title: "Memory Review Console", summary: "\u9AD8\u5C42\u8BB0\u5FC6\u5BA1\u6838\u3001\u64A4\u9500\u548C\u8BC1\u636E\u8FFD\u6EAF", status: "Planned", children: _jsx(FeatureWorkbenchPanel, { items: vm.items, actions: [
                { id: "memory-review-approve", label: "批准提案", tone: "accent", onTrigger: buildWorkbenchActionHandler("memory-review", "approve", { deepLinkPath: "/governance/memory-review?mode=approve" }) },
                { id: "memory-review-revoke", label: "撤销记忆", tone: "danger", onTrigger: buildWorkbenchActionHandler("memory-review", "revoke", { deepLinkPath: "/governance/memory-review?mode=revoke" }) },
                { id: "memory-review-export", label: "导出审计包", tone: "neutral", onTrigger: buildWorkbenchActionHandler("memory-review", "export", { copySelection: true }) },
            ] }) }));
}
