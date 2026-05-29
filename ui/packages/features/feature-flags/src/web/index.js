import { jsx as _jsx } from "react/jsx-runtime";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useFeatureFlagsVm } from "../hooks";
export function FeatureFlagsWebView() {
    const copy = translateFeatureCopy("feature-flags");
    const vm = useFeatureFlagsVm();
    return (_jsx(FeatureScaffold, { title: copy.title, summary: copy.summary, status: "Implemented/Internal", children: vm.isLoading ? (_jsx("p", { children: translateMessage("ui.featureFlags.loading") })) : (_jsx(FeatureWorkbenchPanel, { emptyState: translateMessage("ui.featureFlags.empty"), items: vm.items, metrics: vm.metrics, actions: [] })) }));
}
