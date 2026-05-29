import { createMobilePlatformAdapter } from "@aa/shared-platform";
export const mobileShellManifest = {
    runtime: "react-native",
    platforms: ["android", "ios"],
    supportsPush: true,
    supportsBiometric: true,
    supportsOfflineSqlite: true,
    supportsGestures: true,
    supportsWidgets: true,
    supportsDeepLink: true,
    supportsScreenSecurity: true,
};
export function createMobileAdapter(base, platform) {
    return { ...base, platform };
}
export function createMobileDefaultAdapter(platform) {
    return createMobilePlatformAdapter(platform);
}
