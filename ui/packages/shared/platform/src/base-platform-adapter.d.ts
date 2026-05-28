import type { PlatformAdapter, PlatformAdapterCapabilityView, PlatformId } from "@aa/shared-types";
export interface PlatformAdapterFactoryOptions {
    readonly platform: PlatformId;
    readonly screenSecurityDefault?: boolean;
    readonly analyticsConsentDefault?: boolean;
    readonly allowedShellCommands?: readonly string[];
}
export declare class DefaultPlatformAdapter implements PlatformAdapter {
    readonly platform: PlatformId;
    private readonly secureStore;
    private readonly files;
    private readonly foregroundListeners;
    private readonly backgroundListeners;
    private readonly processes;
    private readonly allowedShellCommands;
    private nextPid;
    private analyticsConsent;
    private screenSecurityEnabled;
    constructor(platform: PlatformId, options?: Omit<PlatformAdapterFactoryOptions, "platform">);
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
    readSecureValue(key: string): Promise<string | null>;
    writeSecureValue(key: string, value: string): Promise<void>;
    deleteSecureValue(key: string): Promise<void>;
    readFile(path: string): Promise<string>;
    writeFile(path: string, contents: string): Promise<void>;
    copyToClipboard(text: string): Promise<void>;
    openDeepLink(url: string): Promise<void>;
    onForeground(listener: () => void): () => void;
    onBackground(listener: () => void): () => void;
    vibrate(pattern: readonly number[]): Promise<void>;
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
    get capabilities(): PlatformAdapterCapabilityView;
    emitForeground(): void;
    emitBackground(): void;
    protected setDebugValue(key: string, value: string | null): void;
    protected setAnalyticsConsentState(enabled: boolean): void;
    protected setScreenSecurityState(enabled: boolean): void;
    getDebugState(): {
        clipboard: string | null;
        deepLink: string | null;
        windowPath: string | null;
        haptics: string | null;
        processCount: number;
        analyticsConsent: boolean;
        screenSecurityEnabled: boolean;
        allowedShellCommands: string[];
    };
}
export declare function createPlatformAdapterCapabilityView(adapter: PlatformAdapter): PlatformAdapterCapabilityView;
