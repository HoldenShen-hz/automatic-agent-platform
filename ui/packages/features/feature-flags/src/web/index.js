import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useFeatureFlagsVm } from "../hooks";
function FeatureFlagsWebView() {
  const copy = translateFeatureCopy("feature-flags");
  const vm = useFeatureFlagsVm();
  return /* @__PURE__ */ jsx(FeatureScaffold, { title: copy.title, summary: copy.summary, status: "Implemented/Internal", children: vm.isLoading ? /* @__PURE__ */ jsx("p", { children: translateMessage("ui.featureFlags.loading") }) : /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      FeatureWorkbenchPanel,
      {
        emptyState: translateMessage("ui.featureFlags.empty"),
        items: vm.items,
        metrics: vm.metrics,
        actions: []
      }
    ),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("h3", { children: translateMessage("ui.featureFlags.contractBoundary.title") }),
      /* @__PURE__ */ jsx("p", { children: translateMessage("ui.featureFlags.contractBoundary.description") })
    ] })
  ] }) });
}
export {
  FeatureFlagsWebView
};
