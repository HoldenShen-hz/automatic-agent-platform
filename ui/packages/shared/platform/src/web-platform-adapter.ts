import { DefaultPlatformAdapter, type PlatformAdapterFactoryOptions } from "./base-platform-adapter";

export class WebPlatformAdapter extends DefaultPlatformAdapter {
  public constructor(options: Omit<PlatformAdapterFactoryOptions, "platform"> = {}) {
    const screenSecurityDefault = options.screenSecurityDefault ?? true;
    super("web", {
      ...options,
      screenSecurityDefault,
    });

    if (typeof document !== "undefined") {
      document.documentElement.dataset.aaScreenSecurity = screenSecurityDefault ? "enabled" : "disabled";
    }
  }

  // NOTE: Secure storage delegates to DefaultPlatformAdapter's in-memory store.
  // localStorage is NOT used for sensitive data as it is XSS-vulnerable (UP-6).
  // In production, sensitive data should be stored in platform-native secure storage
  // (e.g., Keychain on iOS, Keystore on Android) via the bridge.

  public override async copyToClipboard(text: string): Promise<void> {
    await globalThis.navigator?.clipboard?.writeText?.(text);
    await super.copyToClipboard(text);
  }

  public override async readFile(path: string): Promise<string> {
    // P0 FIX: Do not use localStorage for file reads per UP-6.
    // localStorage is XSS-accessible and not safe for any data.
    // Delegate to in-memory store only, which is the secure default.
    return super.readFile(path);
  }

  public override async writeFile(path: string, contents: string): Promise<void> {
    // P0 FIX: Do not use localStorage for file writes per UP-6.
    // localStorage is XSS-accessible and not safe for any data.
    // Delegate to in-memory store only, which is the secure default.
    await super.writeFile(path, contents);
  }

  public override async openDeepLink(url: string): Promise<void> {
    if (typeof window !== "undefined") {
      window.location.hash = url;
    }
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
