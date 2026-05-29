import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { FeatureScaffold, Inline, KeyValueTable, ListCard, MetricGrid, Stack, ThreePaneLayout } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useSettingsVm } from "../hooks";
import SettingsApiKeys from "../sub-pages/api-keys";
import SettingsNotifications from "../sub-pages/notifications";
export function SettingsWebView() {
    const vm = useSettingsVm();
    const [activeSection, setActiveSection] = useState("general");
    const featureCopy = translateFeatureCopy("settings");
    return (_jsxs(FeatureScaffold, { title: featureCopy.title, summary: featureCopy.summary, status: "Implemented/Internal", children: [_jsx(MetricGrid, { metrics: vm.metrics }), _jsx(Inline, { gap: 8, children: vm.sectionItems.map((section) => (_jsx("button", { onClick: () => setActiveSection(section.id), type: "button", children: section.title }, section.id))) }), _jsx("div", { style: { marginTop: 16 }, children: _jsx(ThreePaneLayout, { left: _jsx(ListCard, { items: activeSection === "general" ? vm.leftItems : vm.sectionItems.map((item) => ({ title: item.title, description: item.description })) }), center: vm.loading ? _jsx("p", { children: translateMessage("ui.settings.loading") }) : (_jsxs(Stack, { gap: 16, children: [_jsx("form", { onSubmit: (event) => {
                                    event.preventDefault();
                                    vm.save();
                                }, children: _jsxs(Inline, { gap: 8, children: [_jsxs("select", { onChange: (event) => vm.setDraftTheme(event.target.value), value: vm.draftTheme, children: [_jsx("option", { value: "light", children: translateMessage("ui.settings.theme.light") }), _jsx("option", { value: "dark", children: translateMessage("ui.settings.theme.dark") }), _jsx("option", { value: "high-contrast", children: translateMessage("ui.settings.theme.highContrast") })] }), _jsx("select", { onChange: (event) => vm.setDraftLocale(event.target.value), value: vm.draftLocale, children: vm.localeOptions.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) }), _jsx("button", { type: "submit", children: translateMessage("ui.settings.save") })] }) }), activeSection === "general" ? _jsx(KeyValueTable, { rows: vm.centerRows }) : null, activeSection === "api-keys" ? _jsx(SettingsApiKeys, {}) : null, activeSection === "notifications" ? _jsx(SettingsNotifications, {}) : null] })), right: _jsx(ListCard, { items: vm.activityItems.length > 0 ? vm.activityItems : vm.rightItems }) }) }), _jsxs("p", { style: { marginTop: 16 }, children: [translateMessage("ui.settings.saveState"), ": ", vm.saveState] })] }));
}
