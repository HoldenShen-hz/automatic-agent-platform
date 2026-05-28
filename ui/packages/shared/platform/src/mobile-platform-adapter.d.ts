import type { PlatformId } from "@aa/shared-types";
import { DefaultPlatformAdapter } from "./base-platform-adapter";
import type { MobileBridge } from "./bridge-types";
export declare class MobilePlatformAdapter extends DefaultPlatformAdapter {
    private readonly bridge;
    constructor(platform: Extract<PlatformId, "android" | "ios">, bridge?: MobileBridge | undefined);
    readSecureValue(key: string): Promise<string | null>;
    writeSecureValue(key: string, value: string): Promise<void>;
    deleteSecureValue(key: string): Promise<void>;
    copyToClipboard(text: string): Promise<void>;
    openDeepLink(url: string): Promise<void>;
    onForeground(listener: () => void): () => void;
    onBackground(listener: () => void): () => void;
    vibrate(pattern: readonly number[]): Promise<void>;
    getAnalyticsConsent(): Promise<boolean>;
    setAnalyticsConsent(enabled: boolean): Promise<void>;
    enableScreenSecurity(enabled: boolean): Promise<void>;
}
