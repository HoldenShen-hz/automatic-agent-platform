import type { PlatformAdapter, PlatformId } from "@aa/shared-types";
import { createDesktopPlatformAdapter } from "@aa/shared-platform";

export interface DesktopShellManifest {
  readonly platform: Extract<PlatformId, "windows">;
  readonly runtime: "electron";
  readonly secureScreen: boolean;
}

export const electronWinManifest: DesktopShellManifest = {
  platform: "windows",
  runtime: "electron",
  secureScreen: true,
};

export function createElectronWinAdapter(base: PlatformAdapter): PlatformAdapter {
  return { ...base, platform: "windows" };
}

export function createElectronWinDefaultAdapter(): PlatformAdapter {
  return createDesktopPlatformAdapter("windows");
}
