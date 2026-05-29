import { createDesktopPlatformAdapter } from "@aa/shared-platform";
export const tauriLinuxManifest = Object.freeze({
    platform: "linux",
    runtime: "tauri",
    supportsBackgroundAgent: false,
    supportsNotifications: true,
    supportsSystemTray: true,
    supportsWaylandXdg: true,
    supportsThemeDetection: true,
    updateChannel: "stable",
});
export function createTauriLinuxAdapter(base) {
    return { ...base, platform: "linux" };
}
export function createTauriLinuxDefaultAdapter() {
    return createDesktopPlatformAdapter("linux");
}
