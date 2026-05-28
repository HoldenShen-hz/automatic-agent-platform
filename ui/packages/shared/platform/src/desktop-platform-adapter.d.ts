import type { PlatformId } from "@aa/shared-types";
import { DefaultPlatformAdapter } from "./base-platform-adapter.js";
import type { ElectronBridge, TauriBridge } from "./bridge-types.js";
export declare class DesktopPlatformAdapter extends DefaultPlatformAdapter {
    constructor(platform: Extract<PlatformId, "windows" | "macos" | "linux">);
}
export declare class ElectronPlatformAdapter extends DesktopPlatformAdapter {
    private readonly bridge;
    constructor(bridge?: ElectronBridge | undefined);
    readSecureValue(key: string): Promise<string | null>;
    writeSecureValue(key: string, value: string): Promise<void>;
    deleteSecureValue(key: string): Promise<void>;
    readFile(path: string): Promise<string>;
    writeFile(path: string, contents: string): Promise<void>;
    copyToClipboard(text: string): Promise<void>;
    openDeepLink(url: string): Promise<void>;
    onForeground(listener: () => void): () => void;
    onBackground(listener: () => void): () => void;
    openWindow(path: string): Promise<void>;
    runShell(command: string): Promise<{
        code: number;
        stdout: string;
        stderr: string;
    }>;
    spawnProcess(command: string, args: readonly string[]): Promise<{
        pid: number;
        kill(): Promise<void>;
    }>;
    getAnalyticsConsent(): Promise<boolean>;
    setAnalyticsConsent(enabled: boolean): Promise<void>;
    enableScreenSecurity(enabled: boolean): Promise<void>;
}
export declare class TauriPlatformAdapter extends DesktopPlatformAdapter {
    private readonly bridge;
    constructor(platform: Extract<PlatformId, "macos" | "linux">, bridge?: TauriBridge | undefined);
    readSecureValue(key: string): Promise<string | null>;
    writeSecureValue(key: string, value: string): Promise<void>;
    deleteSecureValue(key: string): Promise<void>;
    readFile(path: string): Promise<string>;
    writeFile(path: string, contents: string): Promise<void>;
    copyToClipboard(text: string): Promise<void>;
    openDeepLink(url: string): Promise<void>;
    onForeground(listener: () => void): () => void;
    onBackground(listener: () => void): () => void;
    openWindow(path: string): Promise<void>;
    runShell(command: string): Promise<{
        code: number;
        stdout: string;
        stderr: string;
    }>;
    spawnProcess(command: string, args: readonly string[]): Promise<{
        pid: number;
        kill(): Promise<void>;
    }>;
    getAnalyticsConsent(): Promise<boolean>;
    setAnalyticsConsent(enabled: boolean): Promise<void>;
    enableScreenSecurity(enabled: boolean): Promise<void>;
}
