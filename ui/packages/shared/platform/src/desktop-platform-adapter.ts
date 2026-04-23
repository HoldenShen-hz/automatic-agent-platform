import type { PlatformId } from "@aa/shared-types";
import { DefaultPlatformAdapter } from "./base-platform-adapter";
import type { ElectronBridge, TauriBridge } from "./bridge-types";

export class DesktopPlatformAdapter extends DefaultPlatformAdapter {
  public constructor(platform: Extract<PlatformId, "windows" | "macos" | "linux">) {
    super(platform, { screenSecurityDefault: true });
  }
}

export class ElectronPlatformAdapter extends DesktopPlatformAdapter {
  public constructor(private readonly bridge: ElectronBridge | undefined = globalThis.window?.__AA_ELECTRON__) {
    super("windows");
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

  public override async readFile(path: string): Promise<string> {
    return this.bridge?.readFile(path) ?? super.readFile(path);
  }

  public override async writeFile(path: string, contents: string): Promise<void> {
    if (this.bridge != null) {
      await this.bridge.writeFile(path, contents);
      return;
    }
    await super.writeFile(path, contents);
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

  public override async openWindow(path: string): Promise<void> {
    if (this.bridge != null) {
      await this.bridge.openWindow(path);
      this.setDebugValue("__window__", path);
      return;
    }
    await super.openWindow(path);
  }

  public override async runShell(command: string): Promise<{ code: number; stdout: string; stderr: string }> {
    return this.bridge?.runShell(command) ?? super.runShell(command);
  }

  public override async spawnProcess(command: string, args: readonly string[]): Promise<{ pid: number; kill(): Promise<void> }> {
    return this.bridge?.spawnProcess(command, args) ?? super.spawnProcess(command, args);
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

export class TauriPlatformAdapter extends DesktopPlatformAdapter {
  public constructor(
    platform: Extract<PlatformId, "macos" | "linux">,
    private readonly bridge: TauriBridge | undefined = globalThis.window?.__TAURI__,
  ) {
    super(platform);
  }

  public override async readSecureValue(key: string): Promise<string | null> {
    return this.bridge?.invoke<string | null>("read_secure_value", { key }) ?? super.readSecureValue(key);
  }

  public override async writeSecureValue(key: string, value: string): Promise<void> {
    if (this.bridge != null) {
      await this.bridge.invoke("write_secure_value", { key, value });
      return;
    }
    await super.writeSecureValue(key, value);
  }

  public override async deleteSecureValue(key: string): Promise<void> {
    if (this.bridge != null) {
      await this.bridge.invoke("delete_secure_value", { key });
      return;
    }
    await super.deleteSecureValue(key);
  }

  public override async openDeepLink(url: string): Promise<void> {
    if (this.bridge != null) {
      await this.bridge.invoke("open_deep_link", { url });
      this.setDebugValue("__deeplink__", url);
      return;
    }
    await super.openDeepLink(url);
  }

  public override onForeground(listener: () => void): () => void {
    return this.bridge?.onForeground?.(listener) ?? super.onForeground(listener);
  }

  public override onBackground(listener: () => void): () => void {
    return this.bridge?.onBackground?.(listener) ?? super.onBackground(listener);
  }

  public override async openWindow(path: string): Promise<void> {
    if (this.bridge != null) {
      await this.bridge.invoke("open_window", { path });
      this.setDebugValue("__window__", path);
      return;
    }
    await super.openWindow(path);
  }

  public override async runShell(command: string): Promise<{ code: number; stdout: string; stderr: string }> {
    if (this.bridge != null) {
      return this.bridge.invoke("run_shell", { command });
    }
    return super.runShell(command);
  }

  public override async getAnalyticsConsent(): Promise<boolean> {
    return this.bridge?.invoke<boolean>("get_analytics_consent") ?? super.getAnalyticsConsent();
  }

  public override async setAnalyticsConsent(enabled: boolean): Promise<void> {
    if (this.bridge != null) {
      await this.bridge.invoke("set_analytics_consent", { enabled });
      this.setAnalyticsConsentState(enabled);
      return;
    }
    await super.setAnalyticsConsent(enabled);
  }

  public override async enableScreenSecurity(enabled: boolean): Promise<void> {
    if (this.bridge != null) {
      await this.bridge.invoke("enable_screen_security", { enabled });
      this.setScreenSecurityState(enabled);
      return;
    }
    await super.enableScreenSecurity(enabled);
  }
}
