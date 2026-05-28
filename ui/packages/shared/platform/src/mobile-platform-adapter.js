import { DefaultPlatformAdapter } from "./base-platform-adapter";
export class MobilePlatformAdapter extends DefaultPlatformAdapter {
    bridge;
    constructor(platform, bridge = globalThis.__AA_MOBILE__) {
        super(platform, { analyticsConsentDefault: true });
        this.bridge = bridge;
    }
    async readSecureValue(key) {
        return this.bridge?.readSecureValue(key) ?? super.readSecureValue(key);
    }
    async writeSecureValue(key, value) {
        if (this.bridge != null) {
            await this.bridge.writeSecureValue(key, value);
            return;
        }
        await super.writeSecureValue(key, value);
    }
    async deleteSecureValue(key) {
        if (this.bridge != null) {
            await this.bridge.deleteSecureValue(key);
            return;
        }
        await super.deleteSecureValue(key);
    }
    async copyToClipboard(text) {
        if (this.bridge != null) {
            await this.bridge.copyToClipboard(text);
            this.setDebugValue("__clipboard__", text);
            return;
        }
        await super.copyToClipboard(text);
    }
    async openDeepLink(url) {
        if (this.bridge != null) {
            await this.bridge.openDeepLink(url);
            this.setDebugValue("__deeplink__", url);
            return;
        }
        await super.openDeepLink(url);
    }
    onForeground(listener) {
        return this.bridge?.onForeground(listener) ?? super.onForeground(listener);
    }
    onBackground(listener) {
        return this.bridge?.onBackground(listener) ?? super.onBackground(listener);
    }
    async vibrate(pattern) {
        if (this.bridge != null) {
            await this.bridge.vibrate(pattern);
            this.setDebugValue("__haptics__", pattern.join(","));
            return;
        }
        await super.vibrate(pattern);
    }
    async getAnalyticsConsent() {
        return this.bridge?.getAnalyticsConsent() ?? super.getAnalyticsConsent();
    }
    async setAnalyticsConsent(enabled) {
        if (this.bridge != null) {
            await this.bridge.setAnalyticsConsent(enabled);
            this.setAnalyticsConsentState(enabled);
            return;
        }
        await super.setAnalyticsConsent(enabled);
    }
    async enableScreenSecurity(enabled) {
        if (this.bridge != null) {
            await this.bridge.enableScreenSecurity(enabled);
            this.setScreenSecurityState(enabled);
            return;
        }
        await super.enableScreenSecurity(enabled);
    }
}
