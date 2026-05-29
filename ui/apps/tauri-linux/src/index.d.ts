import type { PlatformAdapter, PlatformId } from "@aa/shared-types";
export interface DesktopShellManifest {
    readonly platform: Extract<PlatformId, "linux">;
    readonly runtime: "tauri";
    readonly supportsBackgroundAgent?: boolean;
    readonly supportsNotifications?: boolean;
    readonly supportsSystemTray?: boolean;
    readonly supportsWaylandXdg?: boolean;
    readonly supportsThemeDetection?: boolean;
    readonly updateChannel: "stable" | "beta";
}
export declare const tauriLinuxManifest: DesktopShellManifest;
export declare function createTauriLinuxAdapter(base: PlatformAdapter): PlatformAdapter;
export declare function createTauriLinuxDefaultAdapter(): PlatformAdapter;
