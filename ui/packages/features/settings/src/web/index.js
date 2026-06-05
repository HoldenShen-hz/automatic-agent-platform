import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { FeatureScaffold, Inline, KeyValueTable, ListCard, MetricGrid, Stack, ThreePaneLayout } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useSettingsVm } from "../hooks";
import SettingsApiKeys from "../sub-pages/api-keys";
import SettingsNotifications from "../sub-pages/notifications";
function SettingsWebView() {
  const vm = useSettingsVm();
  const [activeSection, setActiveSection] = useState("general");
  const featureCopy = translateFeatureCopy("settings");
  const isGeneralSection = activeSection === "general";
  const rightPaneItems = isGeneralSection ? vm.activityItems.length > 0 ? vm.activityItems : vm.rightItems : [
    activeSection === "api-keys" ? {
      title: translateMessage("ui.settings.apiKeys.boundary.title"),
      description: translateMessage("ui.settings.apiKeys.boundary.description")
    } : {
      title: translateMessage("ui.settings.notifications.boundary.title"),
      description: translateMessage("ui.settings.notifications.boundary.description")
    }
  ];
  return /* @__PURE__ */ jsxs(FeatureScaffold, { title: featureCopy.title, summary: featureCopy.summary, status: "Implemented/Internal", children: [
    /* @__PURE__ */ jsx(MetricGrid, { metrics: vm.metrics }),
    /* @__PURE__ */ jsx(Inline, { gap: 8, children: vm.sectionItems.map((section) => /* @__PURE__ */ jsx("button", { onClick: () => setActiveSection(section.id), type: "button", children: section.title }, section.id)) }),
    /* @__PURE__ */ jsx("div", { style: { marginTop: 16 }, children: /* @__PURE__ */ jsx(
      ThreePaneLayout,
      {
        left: /* @__PURE__ */ jsx(ListCard, { items: activeSection === "general" ? vm.leftItems : vm.sectionItems.map((item) => ({ title: item.title, description: item.description })) }),
        center: vm.loading ? /* @__PURE__ */ jsx("p", { children: translateMessage("ui.settings.loading") }) : /* @__PURE__ */ jsxs(Stack, { gap: 16, children: [
          isGeneralSection ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(
              "form",
              {
                onSubmit: (event) => {
                  event.preventDefault();
                  vm.save();
                },
                children: /* @__PURE__ */ jsxs(Inline, { gap: 8, children: [
                  /* @__PURE__ */ jsxs("select", { onChange: (event) => vm.setDraftTheme(event.target.value), value: vm.draftTheme, children: [
                    /* @__PURE__ */ jsx("option", { value: "light", children: translateMessage("ui.settings.theme.light") }),
                    /* @__PURE__ */ jsx("option", { value: "dark", children: translateMessage("ui.settings.theme.dark") }),
                    /* @__PURE__ */ jsx("option", { value: "high-contrast", children: translateMessage("ui.settings.theme.highContrast") })
                  ] }),
                  /* @__PURE__ */ jsx("select", { onChange: (event) => vm.setDraftLocale(event.target.value), value: vm.draftLocale, children: vm.localeOptions.map((option) => /* @__PURE__ */ jsx("option", { value: option.value, children: option.label }, option.value)) }),
                  /* @__PURE__ */ jsx("button", { type: "submit", children: translateMessage("ui.settings.save") })
                ] })
              }
            ),
            /* @__PURE__ */ jsx(KeyValueTable, { rows: vm.centerRows })
          ] }) : null,
          activeSection === "api-keys" ? /* @__PURE__ */ jsx(SettingsApiKeys, {}) : null,
          activeSection === "notifications" ? /* @__PURE__ */ jsx(SettingsNotifications, {}) : null
        ] }),
        right: /* @__PURE__ */ jsx(ListCard, { items: rightPaneItems })
      }
    ) }),
    isGeneralSection ? /* @__PURE__ */ jsxs("p", { style: { marginTop: 16 }, children: [
      translateMessage("ui.settings.saveState"),
      ": ",
      vm.saveState
    ] }) : null
  ] });
}
export {
  SettingsWebView
};
