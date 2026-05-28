import { useMemo, useState, type ReactElement } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { createMobilePlatformAdapter } from "@aa/shared-platform";
import { Button, Card, Header, ListItem, TabBar, mobileDesignTokens } from "@aa/ui-mobile";
import { mobileNavigation, resolveMobileScreen } from "./navigation";

function detectPlatform(): "android" | "ios" {
  if (Platform.OS === "ios" || Platform.OS === "android") {
    return Platform.OS;
  }
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod|ios/.test(userAgent) ? "ios" : "android";
}

export function MobileApp(): ReactElement {
  const platform = useMemo(() => detectPlatform(), []);
  const adapter = useMemo(() => createMobilePlatformAdapter(platform), [platform]);
  const bridgeReady = typeof (globalThis as typeof globalThis & { __AA_MOBILE__?: unknown }).__AA_MOBILE__ !== "undefined";
  const [activeTabId, setActiveTabId] = useState(mobileNavigation.rootTabNavigator.initialRouteId);
  const [activeSettingsRouteId, setActiveSettingsRouteId] = useState(mobileNavigation.settingsStack.initialRouteId);
  const [activeModalId, setActiveModalId] = useState<string | null>(null);

  const defaultTab = mobileNavigation.tabs[0] ?? null;
  const defaultSettingsScreen = mobileNavigation.settingsSubRoutes[0] ?? null;
  const activeTab = resolveMobileScreen(activeTabId) ?? defaultTab;
  const activeSettingsScreen = resolveMobileScreen(activeSettingsRouteId) ?? defaultSettingsScreen;
  const activeModal = activeModalId == null ? null : resolveMobileScreen(activeModalId);
  const foregroundScreen = activeTabId === "settings" ? activeSettingsScreen : activeTab;

  if (defaultTab == null || defaultSettingsScreen == null || foregroundScreen == null) {
    return (
      <View style={styles.container}>
        <Header
          title="Mobile Mission Control"
          subtitle="Navigation configuration unavailable"
        />
        <Card
          title="Navigation config missing"
          subtitle="Root tabs or settings routes are not registered."
          badge="error"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Mobile Mission Control"
        subtitle={`Platform: ${adapter.platform} · Native bridge ready: ${String(bridgeReady)}`}
        rightAction={{
          label: activeModal == null ? "Open HITL" : "Close Modal",
          onPress: () => setActiveModalId(activeModal == null ? "hitl" : null),
        }}
      />
      <Text style={styles.caption}>
        Root navigator: {mobileNavigation.rootTabNavigator.navigatorId} · Settings stack: {mobileNavigation.settingsStack.navigatorId}
      </Text>
      <TabBar
        tabs={mobileNavigation.tabs.map((tab) => ({
          key: tab.id,
          title: tab.title,
        }))}
        activeTab={activeTabId}
        onTabChange={(nextTabId) => {
          setActiveTabId(nextTabId);
          setActiveModalId(null);
        }}
      />
      <Card
        title={foregroundScreen.title}
        subtitle={`${foregroundScreen.path} · ${foregroundScreen.requiresAuth ? "auth" : "public"}`}
        badge={activeTabId === "settings" ? "stack" : "tab"}
      />
      {activeTabId === "settings" ? (
        <View style={styles.section}>
          {mobileNavigation.settingsSubRoutes.map((route) => (
            <ListItem
              key={route.id}
              title={route.title}
              subtitle={route.path}
              {...(route.id === activeSettingsRouteId ? { rightText: "Active" } : {})}
              onPress={() => setActiveSettingsRouteId(route.id)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.section}>
          <ListItem
            title="Mounted route"
            subtitle={foregroundScreen.path}
            rightText={mobileNavigation.rootTabNavigator.kind}
          />
          <ListItem
            title="Modal flow"
            subtitle="Open approval-detail to simulate stacked overlays"
            rightText={activeModal?.id ?? "idle"}
          />
        </View>
      )}
      <View style={styles.actions}>
        <Button variant="secondary" onPress={() => setActiveModalId("approval-detail")}>
          Open Approval Modal
        </Button>
      </View>
      {activeModal != null ? (
        <Card
          title={`Modal: ${activeModal.title}`}
          subtitle={`${activeModal.path} · ${mobileNavigation.modalNavigator.presentation}`}
          badge={mobileNavigation.modalNavigator.kind}
        />
      ) : null}
    </View>
  );
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
