import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { createMobilePlatformAdapter } from "@aa/shared-platform";
import { Button, Card, Header, ListItem, TabBar, mobileDesignTokens } from "@aa/ui-mobile";
import { mobileNavigation, resolveMobileScreen } from "./navigation";
function detectPlatform() {
    if (Platform.OS === "ios" || Platform.OS === "android") {
        return Platform.OS;
    }
    const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod|ios/.test(userAgent) ? "ios" : "android";
}
export function MobileApp() {
    const platform = useMemo(() => detectPlatform(), []);
    const adapter = useMemo(() => createMobilePlatformAdapter(platform), [platform]);
    const bridgeReady = typeof globalThis.__AA_MOBILE__ !== "undefined";
    const [activeTabId, setActiveTabId] = useState(mobileNavigation.rootTabNavigator.initialRouteId);
    const [activeSettingsRouteId, setActiveSettingsRouteId] = useState(mobileNavigation.settingsStack.initialRouteId);
    const [activeModalId, setActiveModalId] = useState(null);
    const defaultTab = mobileNavigation.tabs[0] ?? null;
    const defaultSettingsScreen = mobileNavigation.settingsSubRoutes[0] ?? null;
    const activeTab = resolveMobileScreen(activeTabId) ?? defaultTab;
    const activeSettingsScreen = resolveMobileScreen(activeSettingsRouteId) ?? defaultSettingsScreen;
    const activeModal = activeModalId == null ? null : resolveMobileScreen(activeModalId);
    const foregroundScreen = activeTabId === "settings" ? activeSettingsScreen : activeTab;
    if (defaultTab == null || defaultSettingsScreen == null || foregroundScreen == null) {
        return (_jsxs(View, { style: styles.container, children: [_jsx(Header, { title: "Mobile Mission Control", subtitle: "Navigation configuration unavailable" }), _jsx(Card, { title: "Navigation config missing", subtitle: "Root tabs or settings routes are not registered.", badge: "error" })] }));
    }
    return (_jsxs(View, { style: styles.container, children: [_jsx(Header, { title: "Mobile Mission Control", subtitle: `Platform: ${adapter.platform} · Native bridge ready: ${String(bridgeReady)}`, rightAction: {
                    label: activeModal == null ? "Open HITL" : "Close Modal",
                    onPress: () => setActiveModalId(activeModal == null ? "hitl" : null),
                } }), _jsxs(Text, { style: styles.caption, children: ["Root navigator: ", mobileNavigation.rootTabNavigator.navigatorId, " \u00B7 Settings stack: ", mobileNavigation.settingsStack.navigatorId] }), _jsx(TabBar, { tabs: mobileNavigation.tabs.map((tab) => ({
                    key: tab.id,
                    title: tab.title,
                })), activeTab: activeTabId, onTabChange: (nextTabId) => {
                    setActiveTabId(nextTabId);
                    setActiveModalId(null);
                } }), _jsx(Card, { title: foregroundScreen.title, subtitle: `${foregroundScreen.path} · ${foregroundScreen.requiresAuth ? "auth" : "public"}`, badge: activeTabId === "settings" ? "stack" : "tab" }), activeTabId === "settings" ? (_jsx(View, { style: styles.section, children: mobileNavigation.settingsSubRoutes.map((route) => (_jsx(ListItem, { title: route.title, subtitle: route.path, ...(route.id === activeSettingsRouteId ? { rightText: "Active" } : {}), onPress: () => setActiveSettingsRouteId(route.id) }, route.id))) })) : (_jsxs(View, { style: styles.section, children: [_jsx(ListItem, { title: "Mounted route", subtitle: foregroundScreen.path, rightText: mobileNavigation.rootTabNavigator.kind }), _jsx(ListItem, { title: "Modal flow", subtitle: "Open approval-detail to simulate stacked overlays", rightText: activeModal?.id ?? "idle" })] })), _jsx(View, { style: styles.actions, children: _jsx(Button, { variant: "secondary", onPress: () => setActiveModalId("approval-detail"), children: "Open Approval Modal" }) }), activeModal != null ? (_jsx(Card, { title: `Modal: ${activeModal.title}`, subtitle: `${activeModal.path} · ${mobileNavigation.modalNavigator.presentation}`, badge: mobileNavigation.modalNavigator.kind })) : null] }));
}
const styles = StyleSheet.create({
    container: {
        display: "flex",
        gap: 12,
        padding: 16,
        backgroundColor: mobileDesignTokens.color.widgetSurface,
    },
    caption: {
        color: mobileDesignTokens.color.widgetTitle,
    },
    section: {
        display: "flex",
        gap: 8,
    },
    actions: {
        display: "flex",
        gap: 8,
    },
});
