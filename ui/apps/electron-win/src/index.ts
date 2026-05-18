import type { PlatformAdapter, PlatformId } from "@aa/shared-types";
import { createDesktopPlatformAdapter } from "@aa/shared-platform";

export interface DesktopShellManifest {
  readonly platform: Extract<PlatformId, "windows">;
  readonly runtime: "electron";
  readonly secureScreen?: boolean;
  readonly supportsTray?: boolean;
  readonly supportsGlobalShortcuts?: boolean;
  readonly updateChannel: "stable" | "beta";
}

export const electronWinManifest: DesktopShellManifest = Object.freeze({
  platform: "windows",
  runtime: "electron",
  secureScreen: true,
  supportsTray: true,
  supportsGlobalShortcuts: true,
  updateChannel: "stable",
});

export function createElectronWinAdapter(base: PlatformAdapter): PlatformAdapter {
  return { ...base, platform: "windows" };
}

export function createElectronWinDefaultAdapter(): PlatformAdapter {
  return createDesktopPlatformAdapter("windows");
}
