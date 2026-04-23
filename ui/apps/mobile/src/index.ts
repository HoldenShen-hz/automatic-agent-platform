import type { PlatformAdapter } from "@aa/shared-types";
import { createMobilePlatformAdapter } from "@aa/shared-platform";

export interface MobileShellManifest {
  readonly runtime: "react-native";
  readonly platforms: readonly ["android", "ios"];
  readonly supportsPush: boolean;
}

export const mobileShellManifest: MobileShellManifest = {
  runtime: "react-native",
  platforms: ["android", "ios"],
  supportsPush: true,
};

export function createMobileAdapter(base: PlatformAdapter, platform: "android" | "ios"): PlatformAdapter {
  return { ...base, platform };
}

export function createMobileDefaultAdapter(platform: "android" | "ios"): PlatformAdapter {
  return createMobilePlatformAdapter(platform);
}
