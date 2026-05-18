import type { PlatformId } from "@aa/shared-types";
import { DefaultPlatformAdapter } from "./base-platform-adapter";
import type { MobileBridge } from "./bridge-types";

export class MobilePlatformAdapter extends DefaultPlatformAdapter {
  public constructor(
    platform: Extract<PlatformId, "android" | "ios">,
    private readonly bridge: MobileBridge | undefined = (globalThis as typeof globalThis & { __AA_MOBILE__?: MobileBridge }).__AA_MOBILE__,
  ) {
    super(platform, { analyticsConsentDefault: true });
  }

  public override async readSecureValue(key: string): Promise<string | null> {
    return this.bridge?.readSecureValue(key) ?? super.readSecureValue(key);
  }

  public override async writeSecureValue(key: string, value: string): Promise<void> {
    if (this.bridge != null) {
      await this.bridge.writeSecureValue(key, value);
      return;
    }
    await super.writeSecureValue(key, value);
  }

  public override async deleteSecureValue(key: string): Promise<void> {
    if (this.bridge != null) {
      await this.bridge.deleteSecureValue(key);
      return;
    }
    await super.deleteSecureValue(key);
  }

  public override async copyToClipboard(text: string): Promise<void> {
    if (this.bridge != null) {
      await this.bridge.copyToClipboard(text);
      this.setDebugValue("__clipboard__", text);
      return;
    }
    await super.copyToClipboard(text);
  }

  public override async openDeepLink(url: string): Promise<void> {
    if (this.bridge != null) {
      await this.bridge.openDeepLink(url);
      this.setDebugValue("__deeplink__", url);
      return;
    }
    await super.openDeepLink(url);
  }

  public override onForeground(listener: () => void): () => void {
    return this.bridge?.onForeground(listener) ?? super.onForeground(listener);
  }

  public override onBackground(listener: () => void): () => void {
    return this.bridge?.onBackground(listener) ?? super.onBackground(listener);
  }

  public override async vibrate(pattern: readonly number[]): Promise<void> {
    if (this.bridge != null) {
      await this.bridge.vibrate(pattern);
      this.setDebugValue("__haptics__", pattern.join(","));
      return;
    }
    await super.vibrate(pattern);
  }

  public override async getAnalyticsConsent(): Promise<boolean> {
    return this.bridge?.getAnalyticsConsent() ?? super.getAnalyticsConsent();
  }

  public override async setAnalyticsConsent(enabled: boolean): Promise<void> {
    if (this.bridge != null) {
      await this.bridge.setAnalyticsConsent(enabled);
      this.setAnalyticsConsentState(enabled);
      return;
    }
    await super.setAnalyticsConsent(enabled);
  }

  public override async enableScreenSecurity(enabled: boolean): Promise<void> {
    if (this.bridge != null) {
      await this.bridge.enableScreenSecurity(enabled);
      this.setScreenSecurityState(enabled);
      return;
    }
    await super.enableScreenSecurity(enabled);
  }
}
