import type { PlatformAdapter, PlatformId } from "@aa/shared-types";
import { createDesktopPlatformAdapter } from "@aa/shared-platform";

export interface DesktopShellManifest {
  readonly platform: Extract<PlatformId, "macos">;
  readonly runtime: "tauri";
  readonly supportsDeepLink: boolean;
  readonly supportsNotifications?: boolean;
  readonly supportsSecureStorage?: boolean;
  readonly supportsSystemTray?: boolean;
  readonly updateChannel: "stable" | "beta";
}

export const tauriMacosManifest: DesktopShellManifest = Object.freeze({
  platform: "macos",
  runtime: "tauri",
  supportsDeepLink: true,
  supportsNotifications: true,
  supportsSecureStorage: true,
  supportsSystemTray: true,
  updateChannel: "stable",
});

export function createTauriMacosAdapter(base: PlatformAdapter): PlatformAdapter {
  return { ...base, platform: "macos" };
}

export function createTauriMacosDefaultAdapter(): PlatformAdapter {
  return createDesktopPlatformAdapter("macos");
}
