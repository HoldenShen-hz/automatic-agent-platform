import { createDesktopPlatformAdapter } from "@aa/shared-platform";
export const tauriMacosManifest = Object.freeze({
    platform: "macos",
    runtime: "tauri",
    supportsDeepLink: true,
    supportsNotifications: true,
    supportsSecureStorage: true,
    supportsSystemTray: true,
    updateChannel: "stable",
});
export function createTauriMacosAdapter(base) {
    return { ...base, platform: "macos" };
}
export function createTauriMacosDefaultAdapter() {
    return createDesktopPlatformAdapter("macos");
}
