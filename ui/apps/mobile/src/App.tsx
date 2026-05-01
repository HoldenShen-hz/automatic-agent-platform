import type { ReactElement } from "react";
import { createMobilePlatformAdapter } from "@aa/shared-platform";

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
    <div style={{ display: "grid", gap: 12 }}>
      <strong>Automatic Agent Platform Mobile Baseline</strong>
      <span>Platform: {adapter.platform}</span>
      <span>Native bridge ready: {String(typeof globalThis.__AA_MOBILE__ !== "undefined")}</span>
    </div>
  );
}
