import type { PlatformAdapter } from "@aa/shared-types";
export interface MobileShellManifest {
    readonly runtime: "react-native";
    readonly platforms: readonly ["android", "ios"];
    readonly supportsPush: boolean;
    readonly supportsBiometric: boolean;
    readonly supportsOfflineSqlite: boolean;
    readonly supportsGestures: boolean;
    readonly supportsWidgets: boolean;
    readonly supportsDeepLink: boolean;
    readonly supportsScreenSecurity: boolean;
}
export declare const mobileShellManifest: MobileShellManifest;
export declare function createMobileAdapter(base: PlatformAdapter, platform: "android" | "ios"): PlatformAdapter;
export declare function createMobileDefaultAdapter(platform: "android" | "ios"): PlatformAdapter;
