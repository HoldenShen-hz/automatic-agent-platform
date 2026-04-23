import type { PlatformAdapter, PlatformId } from "@aa/shared-types";
import { createDesktopPlatformAdapter } from "@aa/shared-platform";

export interface DesktopShellManifest {
  readonly platform: Extract<PlatformId, "linux">;
  readonly runtime: "tauri";
}

export const tauriLinuxManifest: DesktopShellManifest = {
  platform: "linux",
  runtime: "tauri",
};

export function createTauriLinuxAdapter(base: PlatformAdapter): PlatformAdapter {
  return { ...base, platform: "linux" };
}

export function createTauriLinuxDefaultAdapter(): PlatformAdapter {
  return createDesktopPlatformAdapter("linux");
}
