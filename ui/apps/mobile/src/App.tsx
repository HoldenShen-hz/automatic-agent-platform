import type { ReactElement } from "react";
import { createMobilePlatformAdapter } from "@aa/shared-platform";
import { StyleSheet, Text, View } from "react-native";

function detectMobilePlatform(): "android" | "ios" {
  // §210-2499: Root cause - previous implementation hardcoded "android" as fallback,
  // causing iOS devices to receive wrong platform identifier when native bridge unavailable.
  // Fix: Properly detect iOS from User-Agent before falling back to android.
  if (typeof navigator !== "undefined" && navigator.userAgent) {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) return "ios";
    if (ua.includes("android")) return "android";
  }
  // Fallback to android if detection fails
  return "android";
}

export function MobileApp(): ReactElement {
  const platform = detectMobilePlatform();
  const adapter = createMobilePlatformAdapter(platform);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Automatic Agent Platform Mobile Baseline</Text>
      <Text>Platform: {adapter.platform}</Text>
      <Text>Native bridge ready: {String(typeof globalThis.__AA_MOBILE__ !== "undefined")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    padding: 16,
  },
  title: {
    fontWeight: "700",
  },
});
