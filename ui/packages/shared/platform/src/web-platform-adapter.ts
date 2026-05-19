import { DefaultPlatformAdapter } from "./base-platform-adapter";

const LOCAL_FILE_PREFIX = "aa.file.";
const MAX_FILE_STORAGE_BYTES = 256 * 1024;

export class WebPlatformAdapter extends DefaultPlatformAdapter {
  public constructor() {
    super("web", { screenSecurityDefault: true });
  }

  public override async readSecureValue(key: string): Promise<string | null> {
    return super.readSecureValue(key);
  }

  public override async writeSecureValue(key: string, value: string): Promise<void> {
    await super.writeSecureValue(key, value);
  }

  public override async deleteSecureValue(key: string): Promise<void> {
    await super.deleteSecureValue(key);
  }

  public override async copyToClipboard(text: string): Promise<void> {
    await globalThis.navigator?.clipboard?.writeText?.(text);
    await super.copyToClipboard(text);
  }

  public override async readFile(path: string): Promise<string> {
    const normalizedPath = normalizeLocalFilePath(path);
    if (normalizedPath == null) {
      return super.readFile(path);
    }
    return readLocalStorage(`${LOCAL_FILE_PREFIX}${normalizedPath}`) ?? super.readFile(path);
  }

  public override async writeFile(path: string, contents: string): Promise<void> {
    const normalizedPath = normalizeLocalFilePath(path);
    if (normalizedPath != null && new TextEncoder().encode(contents).byteLength <= MAX_FILE_STORAGE_BYTES) {
      writeLocalStorage(`${LOCAL_FILE_PREFIX}${normalizedPath}`, contents);
    }
    await super.writeFile(path, contents);
  }

  public override async openDeepLink(url: string): Promise<void> {
    const safeTarget = normalizeDeepLinkTarget(url);
    if (typeof window !== "undefined" && safeTarget != null) {
      window.location.hash = safeTarget.startsWith("#") ? safeTarget : `#${safeTarget.replace(/^\/+/, "/")}`;
    }
    this.setDebugValue("__deeplink__", safeTarget ?? url);
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
    const safeUrl = normalizeWindowTarget(path);
    if (safeUrl != null) {
      globalThis.open?.(safeUrl, "_blank", "noopener,noreferrer");
    }
    await super.openWindow(path);
  }

  public override async getAnalyticsConsent(): Promise<boolean> {
    const stored = readLocalStorage("aa.analytics.consent");
    return stored == null ? super.getAnalyticsConsent() : stored === "true";
  }

  public override async setAnalyticsConsent(enabled: boolean): Promise<void> {
    writeLocalStorage("aa.analytics.consent", String(enabled));
    this.setAnalyticsConsentState(enabled);
  }

  public override async enableScreenSecurity(enabled: boolean): Promise<void> {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.aaScreenSecurity = enabled ? "enabled" : "disabled";
    }
    this.setScreenSecurityState(enabled);
  }
}

function normalizeLocalFilePath(path: string): string | null {
  const trimmed = path.trim();
  if (
    trimmed.length === 0
    || trimmed.length > 240
    || trimmed.includes("..")
    || /[\r\n]/.test(trimmed)
    || !/^[/A-Za-z0-9._-]+$/.test(trimmed)
  ) {
    return null;
  }
  return trimmed.replace(/^\/+/, "");
}

function normalizeDeepLinkTarget(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed.length === 0 || /[\r\n]/.test(trimmed)) {
    return null;
  }
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  if (trimmed.startsWith("#")) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed, globalThis.location?.origin ?? "https://example.invalid");
    if (parsed.origin !== (globalThis.location?.origin ?? parsed.origin)) {
      return null;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

function normalizeWindowTarget(path: string): string | null {
  try {
    const parsed = new URL(path, globalThis.location?.origin ?? "https://example.invalid");
    if (!["http:", "https:", "mailto:"].includes(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function readLocalStorage(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Storage is best-effort in the browser adapter and should not crash the UI runtime.
  }
}
