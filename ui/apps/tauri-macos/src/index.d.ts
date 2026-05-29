import type { PlatformAdapter, PlatformId } from "@aa/shared-types";
export interface DesktopShellManifest {
    readonly platform: Extract<PlatformId, "macos">;
    readonly runtime: "tauri";
    readonly supportsDeepLink: boolean;
    readonly supportsNotifications?: boolean;
    readonly supportsSecureStorage?: boolean;
    readonly supportsSystemTray?: boolean;
    readonly updateChannel: "stable" | "beta";
}
export declare const tauriMacosManifest: DesktopShellManifest;
export declare function createTauriMacosAdapter(base: PlatformAdapter): PlatformAdapter;
export declare function createTauriMacosDefaultAdapter(): PlatformAdapter;
