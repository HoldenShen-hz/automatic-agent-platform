import type { PlatformAdapter, PlatformId } from "@aa/shared-types";
import { createDesktopPlatformAdapter } from "@aa/shared-platform";

export interface DesktopShellManifest {
  readonly platform: Extract<PlatformId, "linux">;
  readonly runtime: "tauri";
  readonly supportsBackgroundAgent: boolean;
  readonly updateChannel: "stable" | "beta";
}

export const tauriLinuxManifest: DesktopShellManifest = Object.freeze({
  platform: "linux",
  runtime: "tauri",
  supportsBackgroundAgent: false,
  updateChannel: "stable",
});

export function createTauriLinuxAdapter(base: PlatformAdapter): PlatformAdapter {
  return { ...base, platform: "linux" };
}

export function createTauriLinuxDefaultAdapter(): PlatformAdapter {
  return createDesktopPlatformAdapter("linux");
}
