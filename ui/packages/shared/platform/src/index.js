import { DefaultPlatformAdapter } from "./base-platform-adapter.js";
import { ElectronPlatformAdapter, TauriPlatformAdapter } from "./desktop-platform-adapter.js";
import { MobilePlatformAdapter } from "./mobile-platform-adapter.js";
import { WebPlatformAdapter } from "./web-platform-adapter.js";
export { DefaultPlatformAdapter, createPlatformAdapterCapabilityView } from "./base-platform-adapter.js";
export { ElectronPlatformAdapter, DesktopPlatformAdapter, TauriPlatformAdapter } from "./desktop-platform-adapter.js";
export { MobilePlatformAdapter } from "./mobile-platform-adapter.js";
export { PlatformAdapterProvider, usePlatformAdapter } from "./provider.js";
export { WebPlatformAdapter } from "./web-platform-adapter.js";
export function createPlatformAdapter(options) {
    switch (options.platform) {
        case "web":
            return new WebPlatformAdapter();
        case "windows":
            return new ElectronPlatformAdapter();
        case "macos":
            return new TauriPlatformAdapter("macos");
        case "linux":
            return new TauriPlatformAdapter("linux");
        case "android":
            return new MobilePlatformAdapter("android");
        case "ios":
            return new MobilePlatformAdapter("ios");
        default:
            return new DefaultPlatformAdapter(options.platform, options);
    }
}
export function createWebPlatformAdapter() {
    return new WebPlatformAdapter();
}
export function createDesktopPlatformAdapter(platform) {
    if (platform === "windows") {
        return new ElectronPlatformAdapter();
    }
    return new TauriPlatformAdapter(platform);
}
export function createMobilePlatformAdapter(platform) {
    return new MobilePlatformAdapter(platform);
}
