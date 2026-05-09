import type { ReactElement } from "react";
import { StyleSheet, Text, View } from "react-native";
import { createMobilePlatformAdapter } from "@aa/shared-platform";

function detectPlatform(): "android" | "ios" {
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod|ios/.test(userAgent) ? "ios" : "android";
}

export function MobileApp(): ReactElement {
  const adapter = createMobilePlatformAdapter(detectPlatform());
  const bridgeReady = typeof globalThis.__AA_MOBILE__ !== "undefined";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Automatic Agent Platform Mobile Baseline</Text>
      <Text>Platform: {adapter.platform}</Text>
      <Text>Native bridge ready: {String(bridgeReady)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    display: "flex",
    gap: 12,
  },
  title: {
    fontWeight: "700",
  },
});
