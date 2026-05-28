import { DefaultPlatformAdapter } from "./base-platform-adapter";
export declare class WebPlatformAdapter extends DefaultPlatformAdapter {
    constructor();
    readSecureValue(key: string): Promise<string | null>;
    writeSecureValue(key: string, value: string): Promise<void>;
    deleteSecureValue(key: string): Promise<void>;
    copyToClipboard(text: string): Promise<void>;
    readFile(path: string): Promise<string>;
    writeFile(path: string, contents: string): Promise<void>;
    openDeepLink(url: string): Promise<void>;
    onForeground(listener: () => void): () => void;
    onBackground(listener: () => void): () => void;
    vibrate(pattern: readonly number[]): Promise<void>;
    openWindow(path: string): Promise<void>;
    getAnalyticsConsent(): Promise<boolean>;
    setAnalyticsConsent(enabled: boolean): Promise<void>;
    enableScreenSecurity(enabled: boolean): Promise<void>;
}
