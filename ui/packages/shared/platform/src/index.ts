import type { PlatformAdapter, PlatformId } from "@aa/shared-types";

interface StoredProcessHandle {
  readonly pid: number;
  readonly command: string;
  readonly args: readonly string[];
}

export interface PlatformAdapterFactoryOptions {
  readonly platform: PlatformId;
  readonly screenSecurityDefault?: boolean;
  readonly analyticsConsentDefault?: boolean;
}

class MemorySecureStore {
  private readonly values = new Map<string, string>();

  public read(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public write(key: string, value: string): void {
    this.values.set(key, value);
  }

  public delete(key: string): void {
    this.values.delete(key);
  }
}

export class DefaultPlatformAdapter implements PlatformAdapter {
  private readonly secureStore = new MemorySecureStore();
  private readonly files = new Map<string, string>();
  private readonly foregroundListeners = new Set<() => void>();
  private readonly backgroundListeners = new Set<() => void>();
  private readonly processes = new Map<number, StoredProcessHandle>();
  private nextPid = 1000;
  private analyticsConsent: boolean;
  private screenSecurityEnabled: boolean;

  public constructor(public readonly platform: PlatformId, options: Omit<PlatformAdapterFactoryOptions, "platform"> = {}) {
    this.analyticsConsent = options.analyticsConsentDefault ?? false;
    this.screenSecurityEnabled = options.screenSecurityDefault ?? false;
  }

  public async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    return globalThis.fetch(input, init);
  }

  public async readSecureValue(key: string): Promise<string | null> {
    return this.secureStore.read(key);
  }

  public async writeSecureValue(key: string, value: string): Promise<void> {
    this.secureStore.write(key, value);
  }

  public async deleteSecureValue(key: string): Promise<void> {
    this.secureStore.delete(key);
  }

  public async readFile(path: string): Promise<string> {
    return this.files.get(path) ?? "";
  }

  public async writeFile(path: string, contents: string): Promise<void> {
    this.files.set(path, contents);
  }

  public async copyToClipboard(text: string): Promise<void> {
    this.files.set("__clipboard__", text);
  }

  public async openDeepLink(url: string): Promise<void> {
    this.files.set("__deeplink__", url);
  }

  public onForeground(listener: () => void): () => void {
    this.foregroundListeners.add(listener);
    return () => this.foregroundListeners.delete(listener);
  }

  public onBackground(listener: () => void): () => void {
    this.backgroundListeners.add(listener);
    return () => this.backgroundListeners.delete(listener);
  }

  public async vibrate(pattern: readonly number[]): Promise<void> {
    this.files.set("__haptics__", pattern.join(","));
  }

  public async openWindow(path: string): Promise<void> {
    this.files.set("__window__", path);
  }

  public async runShell(command: string): Promise<{ code: number; stdout: string; stderr: string }> {
    return {
      code: 0,
      stdout: `${this.platform}:${command}`,
      stderr: "",
    };
  }

  public async spawnProcess(command: string, args: readonly string[]): Promise<{ pid: number; kill(): Promise<void> }> {
    const pid = this.nextPid++;
    this.processes.set(pid, { pid, command, args });
    return {
      pid,
      kill: async () => {
        this.processes.delete(pid);
      },
    };
  }

  public async getAnalyticsConsent(): Promise<boolean> {
    return this.analyticsConsent;
  }

  public async setAnalyticsConsent(enabled: boolean): Promise<void> {
    this.analyticsConsent = enabled;
  }

  public async enableScreenSecurity(enabled: boolean): Promise<void> {
    this.screenSecurityEnabled = enabled;
  }

  public emitForeground(): void {
    for (const listener of this.foregroundListeners) {
      listener();
    }
  }

  public emitBackground(): void {
    for (const listener of this.backgroundListeners) {
      listener();
    }
  }

  public getDebugState() {
    return {
      clipboard: this.files.get("__clipboard__") ?? null,
      deepLink: this.files.get("__deeplink__") ?? null,
      windowPath: this.files.get("__window__") ?? null,
      haptics: this.files.get("__haptics__") ?? null,
      processCount: this.processes.size,
      analyticsConsent: this.analyticsConsent,
      screenSecurityEnabled: this.screenSecurityEnabled,
    };
  }
}

export function createPlatformAdapter(options: PlatformAdapterFactoryOptions): DefaultPlatformAdapter {
  return new DefaultPlatformAdapter(options.platform, options);
}

export function createWebPlatformAdapter(): DefaultPlatformAdapter {
  return createPlatformAdapter({ platform: "web" });
}

export function createDesktopPlatformAdapter(platform: Extract<PlatformId, "windows" | "macos" | "linux">): DefaultPlatformAdapter {
  return createPlatformAdapter({ platform, screenSecurityDefault: true });
}

export function createMobilePlatformAdapter(platform: Extract<PlatformId, "android" | "ios">): DefaultPlatformAdapter {
  return createPlatformAdapter({ platform, analyticsConsentDefault: true });
}
