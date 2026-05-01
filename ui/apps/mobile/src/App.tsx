import type { ReactElement } from "react";
import { createMobilePlatformAdapter } from "@aa/shared-platform";

function detectMobilePlatform(): "android" | "ios" {
  // Detect platform from User-Agent when native bridge is not available
  if (typeof navigator !== "undefined" && navigator.userAgent) {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("android")) return "android";
    if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) return "ios";
  }
  // Fallback to android if detection fails
  return "android";
}

export function MobileApp(): ReactElement {
  const platform = detectMobilePlatform();
  const adapter = createMobilePlatformAdapter(platform);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <strong>Automatic Agent Platform Mobile Baseline</strong>
      <span>Platform: {adapter.platform}</span>
      <span>Native bridge ready: {String(typeof globalThis.__AA_MOBILE__ !== "undefined")}</span>
    </div>
  );
}
