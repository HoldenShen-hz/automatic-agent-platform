import { jsx as _jsx } from "react/jsx-runtime";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useReleaseConsoleVm } from "../hooks";
export function ReleaseConsoleWebView() {
    const vm = useReleaseConsoleVm();
    return (_jsx(FeatureScaffold, { title: "Release Console", summary: "\u53D1\u5E03\u8349\u7A3F\u3001\u95E8\u7981\u3001\u56DE\u6EDA\u548C\u664B\u7EA7\u72B6\u6001", status: "Planned", children: _jsx(FeatureWorkbenchPanel, { items: vm.items, actions: [
                { id: "release-console-validate", label: "运行门禁", tone: "accent", onTrigger: buildWorkbenchActionHandler("release-console", "validate", { deepLinkPath: "/operations/release-console?mode=validate" }) },
                { id: "release-console-promote", label: "推进灰度", tone: "neutral", onTrigger: buildWorkbenchActionHandler("release-console", "promote", { deepLinkPath: "/operations/release-console?mode=promote" }) },
                { id: "release-console-rollback", label: "查看回滚计划", tone: "danger", onTrigger: buildWorkbenchActionHandler("release-console", "rollback", { copySelection: true, deepLinkPath: "/operations/release-console?view=rollback" }) },
            ] }) }));
}
