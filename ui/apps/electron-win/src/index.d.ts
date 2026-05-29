import type { PlatformAdapter, PlatformId } from "@aa/shared-types";
export interface DesktopShellManifest {
    readonly platform: Extract<PlatformId, "windows">;
    readonly runtime: "electron";
    readonly secureScreen?: boolean;
    readonly supportsTray?: boolean;
    readonly supportsGlobalShortcuts?: boolean;
    readonly updateChannel: "stable" | "beta";
}
export declare const electronWinManifest: DesktopShellManifest;
export declare function createElectronWinAdapter(base: PlatformAdapter): PlatformAdapter;
export declare function createElectronWinDefaultAdapter(): PlatformAdapter;
