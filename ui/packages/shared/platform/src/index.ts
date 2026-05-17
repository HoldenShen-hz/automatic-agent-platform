import type { PlatformId } from "@aa/shared-types";
import { DefaultPlatformAdapter, type PlatformAdapterFactoryOptions } from "./base-platform-adapter";
import { ElectronPlatformAdapter, TauriPlatformAdapter } from "./desktop-platform-adapter";
import { MobilePlatformAdapter } from "./mobile-platform-adapter";
import { WebPlatformAdapter } from "./web-platform-adapter";

export type { PlatformAdapterFactoryOptions } from "./base-platform-adapter";
export { DefaultPlatformAdapter, createPlatformAdapterCapabilityView } from "./base-platform-adapter";
export type { ElectronBridge, MobileBridge, ShellResult, SpawnedProcessHandle, TauriBridge } from "./bridge-types";
export { ElectronPlatformAdapter, DesktopPlatformAdapter, TauriPlatformAdapter } from "./desktop-platform-adapter";
export { MobilePlatformAdapter } from "./mobile-platform-adapter";
export { PlatformAdapterProvider, usePlatformAdapter } from "./provider";
export { WebPlatformAdapter } from "./web-platform-adapter";

export function createPlatformAdapter(options: PlatformAdapterFactoryOptions): DefaultPlatformAdapter {
  switch (options.platform) {
    case "web":
      return new WebPlatformAdapter();
    case "windows":
      return new ElectronPlatformAdapter();
    case "macos":
      return new TauriPlatformAdapter("macos");
    case "linux":
      return new TauriPlatformAdapter("linux");
    case "android":
      return new MobilePlatformAdapter("android");
    case "ios":
      return new MobilePlatformAdapter("ios");
    default:
      return new DefaultPlatformAdapter(options.platform as PlatformId, options);
  }
}

export function createWebPlatformAdapter(): WebPlatformAdapter {
  return new WebPlatformAdapter();
}

export function createDesktopPlatformAdapter(platform: Extract<PlatformId, "windows" | "macos" | "linux">): DefaultPlatformAdapter {
  if (platform === "windows") {
    return new ElectronPlatformAdapter();
  }
  return new TauriPlatformAdapter(platform);
}

export function createMobilePlatformAdapter(platform: Extract<PlatformId, "android" | "ios">): MobilePlatformAdapter {
  return new MobilePlatformAdapter(platform);
}
