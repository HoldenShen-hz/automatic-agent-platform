import { DefaultPlatformAdapter } from "./base-platform-adapter";

export class WebPlatformAdapter extends DefaultPlatformAdapter {
  public constructor() {
    super("web");
  }

  public override async readSecureValue(key: string): Promise<string | null> {
    return globalThis.localStorage?.getItem(`aa.secure.${key}`) ?? super.readSecureValue(key);
  }

  public override async writeSecureValue(key: string, value: string): Promise<void> {
    globalThis.localStorage?.setItem(`aa.secure.${key}`, value);
    await super.writeSecureValue(key, value);
  }

  public override async deleteSecureValue(key: string): Promise<void> {
    globalThis.localStorage?.removeItem(`aa.secure.${key}`);
    await super.deleteSecureValue(key);
  }

  public override async copyToClipboard(text: string): Promise<void> {
    await globalThis.navigator?.clipboard?.writeText?.(text);
    await super.copyToClipboard(text);
  }

  public override async openDeepLink(url: string): Promise<void> {
    this.setDebugValue("__deeplink__", url);
  }

  public override onForeground(listener: () => void): () => void {
    if (typeof document === "undefined") {
      return super.onForeground(listener);
    }
    const handler = () => {
      if (document.visibilityState === "visible") {
        listener();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }

  public override onBackground(listener: () => void): () => void {
    if (typeof document === "undefined") {
      return super.onBackground(listener);
    }
    const handler = () => {
      if (document.visibilityState === "hidden") {
        listener();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }

  public override async vibrate(pattern: readonly number[]): Promise<void> {
    globalThis.navigator?.vibrate?.(pattern as number[]);
    await super.vibrate(pattern);
  }

  public override async openWindow(path: string): Promise<void> {
    globalThis.open?.(path, "_blank", "noopener,noreferrer");
    await super.openWindow(path);
  }

  public override async getAnalyticsConsent(): Promise<boolean> {
    const stored = globalThis.localStorage?.getItem("aa.analytics.consent");
    return stored == null ? super.getAnalyticsConsent() : stored === "true";
  }

  public override async setAnalyticsConsent(enabled: boolean): Promise<void> {
    globalThis.localStorage?.setItem("aa.analytics.consent", String(enabled));
    this.setAnalyticsConsentState(enabled);
  }

  public override async enableScreenSecurity(enabled: boolean): Promise<void> {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.aaScreenSecurity = enabled ? "enabled" : "disabled";
    }
    this.setScreenSecurityState(enabled);
  }
}
