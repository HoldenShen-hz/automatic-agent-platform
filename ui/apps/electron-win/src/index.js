import { createDesktopPlatformAdapter } from "@aa/shared-platform";
export const electronWinManifest = Object.freeze({
    platform: "windows",
    runtime: "electron",
    secureScreen: true,
    supportsTray: true,
    supportsGlobalShortcuts: true,
    updateChannel: "stable",
});
export function createElectronWinAdapter(base) {
    return { ...base, platform: "windows" };
}
export function createElectronWinDefaultAdapter() {
    return createDesktopPlatformAdapter("windows");
}
