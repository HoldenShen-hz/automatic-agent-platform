import type { PlatformAdapter, PlatformAdapterCapabilityView, PlatformId } from "@aa/shared-types";

interface StoredProcessHandle {
  readonly pid: number;
  readonly command: string;
  readonly args: readonly string[];
}

export interface PlatformAdapterFactoryOptions {
  readonly platform: PlatformId;
  readonly screenSecurityDefault?: boolean;
  readonly analyticsConsentDefault?: boolean;
  readonly allowedShellCommands?: readonly string[];
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
  private readonly allowedShellCommands: ReadonlySet<string>;
  private nextPid = 1000;
  private analyticsConsent: boolean;
  private screenSecurityEnabled: boolean;

  public constructor(public readonly platform: PlatformId, options: Omit<PlatformAdapterFactoryOptions, "platform"> = {}) {
    this.analyticsConsent = options.analyticsConsentDefault ?? false;
    this.screenSecurityEnabled = options.screenSecurityDefault ?? false;
    this.allowedShellCommands = new Set(options.allowedShellCommands ?? []);
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
    if (this.allowedShellCommands.size > 0 && !this.allowedShellCommands.has(command)) {
      return {
        code: 1,
        stdout: "",
        stderr: `Command "${command}" is not in whitelist: ${Array.from(this.allowedShellCommands).join(", ")}`,
      };
    }
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

  public get capabilities(): PlatformAdapterCapabilityView {
    return createPlatformAdapterCapabilityView(this);
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

  protected setDebugValue(key: string, value: string | null): void {
    if (value == null) {
      this.files.delete(key);
      return;
    }
    this.files.set(key, value);
  }

  protected setAnalyticsConsentState(enabled: boolean): void {
    this.analyticsConsent = enabled;
  }

  protected setScreenSecurityState(enabled: boolean): void {
    this.screenSecurityEnabled = enabled;
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
      allowedShellCommands: [...this.allowedShellCommands],
    };
  }
}

export function createPlatformAdapterCapabilityView(adapter: PlatformAdapter): PlatformAdapterCapabilityView {
  return {
    secureStorage: {
      get: (key) => adapter.readSecureValue(key),
      set: (key, value) => adapter.writeSecureValue(key, value),
      delete: (key) => adapter.deleteSecureValue(key),
    },
    offlineStore: {
      get: (path) => adapter.readFile(path),
      set: (path, contents) => adapter.writeFile(path, contents),
    },
    clipboard: {
      write: (text) => adapter.copyToClipboard(text),
    },
    deeplink: {
      open: (url) => adapter.openDeepLink(url),
    },
    lifecycle: {
      onForeground: (listener) => adapter.onForeground(listener),
      onBackground: (listener) => adapter.onBackground(listener),
    },
    haptics: {
      vibrate: (pattern) => adapter.vibrate(pattern),
    },
    windowing: {
      open: (path) => adapter.openWindow(path),
    },
    shell: {
      run: (command) => adapter.runShell(command),
    },
    process: {
      spawn: (command, args) => adapter.spawnProcess(command, args),
    },
    analyticsConsent: {
      get: () => adapter.getAnalyticsConsent(),
      set: (enabled) => adapter.setAnalyticsConsent(enabled),
    },
    screenSecurity: {
      setEnabled: (enabled) => adapter.enableScreenSecurity(enabled),
    },
  };
}
