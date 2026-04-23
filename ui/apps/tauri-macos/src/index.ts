import type { PlatformAdapter, PlatformId } from "@aa/shared-types";
import { createDesktopPlatformAdapter } from "@aa/shared-platform";

export interface DesktopShellManifest {
  readonly platform: Extract<PlatformId, "macos">;
  readonly runtime: "tauri";
}

export const tauriMacosManifest: DesktopShellManifest = {
  platform: "macos",
  runtime: "tauri",
};

export function createTauriMacosAdapter(base: PlatformAdapter): PlatformAdapter {
  return { ...base, platform: "macos" };
}

export function createTauriMacosDefaultAdapter(): PlatformAdapter {
  return createDesktopPlatformAdapter("macos");
}
