import { DefaultPlatformAdapter } from "./base-platform-adapter";
const LOCAL_FILE_PREFIX = "aa.file.";
const MAX_FILE_STORAGE_BYTES = 256 * 1024;
export class WebPlatformAdapter extends DefaultPlatformAdapter {
    constructor() {
        super("web", { screenSecurityDefault: true });
    }
    async readSecureValue(key) {
        return super.readSecureValue(key);
    }
    async writeSecureValue(key, value) {
        await super.writeSecureValue(key, value);
    }
    async deleteSecureValue(key) {
        await super.deleteSecureValue(key);
    }
    async copyToClipboard(text) {
        await globalThis.navigator?.clipboard?.writeText?.(text);
        await super.copyToClipboard(text);
    }
    async readFile(path) {
        const normalizedPath = normalizeLocalFilePath(path);
        if (normalizedPath == null) {
            return super.readFile(path);
        }
        return readLocalStorage(`${LOCAL_FILE_PREFIX}${normalizedPath}`) ?? super.readFile(path);
    }
    async writeFile(path, contents) {
        const normalizedPath = normalizeLocalFilePath(path);
        if (normalizedPath != null && new TextEncoder().encode(contents).byteLength <= MAX_FILE_STORAGE_BYTES) {
            writeLocalStorage(`${LOCAL_FILE_PREFIX}${normalizedPath}`, contents);
        }
        await super.writeFile(path, contents);
    }
    async openDeepLink(url) {
        const safeTarget = normalizeDeepLinkTarget(url);
        if (typeof window !== "undefined" && safeTarget != null) {
            window.location.hash = safeTarget.startsWith("#") ? safeTarget : `#${safeTarget.replace(/^\/+/, "/")}`;
        }
        this.setDebugValue("__deeplink__", safeTarget ?? url);
    }
    onForeground(listener) {
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
    onBackground(listener) {
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
    async vibrate(pattern) {
        globalThis.navigator?.vibrate?.(pattern);
        await super.vibrate(pattern);
    }
    async openWindow(path) {
        const safeUrl = normalizeWindowTarget(path);
        if (safeUrl != null) {
            globalThis.open?.(safeUrl, "_blank", "noopener,noreferrer");
        }
        await super.openWindow(path);
    }
    async getAnalyticsConsent() {
        const stored = readLocalStorage("aa.analytics.consent");
        return stored == null ? super.getAnalyticsConsent() : stored === "true";
    }
    async setAnalyticsConsent(enabled) {
        writeLocalStorage("aa.analytics.consent", String(enabled));
        this.setAnalyticsConsentState(enabled);
    }
    async enableScreenSecurity(enabled) {
        if (typeof document !== "undefined") {
            document.documentElement.dataset.aaScreenSecurity = enabled ? "enabled" : "disabled";
        }
        this.setScreenSecurityState(enabled);
    }
}
function normalizeLocalFilePath(path) {
    const trimmed = path.trim();
    if (trimmed.length === 0
        || trimmed.length > 240
        || trimmed.includes("..")
        || /[\r\n]/.test(trimmed)
        || !/^[/A-Za-z0-9._-]+$/.test(trimmed)) {
        return null;
    }
    return trimmed.replace(/^\/+/, "");
}
function normalizeDeepLinkTarget(url) {
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
    }
    catch {
        return null;
    }
}
function normalizeWindowTarget(path) {
    try {
        const parsed = new URL(path, globalThis.location?.origin ?? "https://example.invalid");
        if (!["http:", "https:", "mailto:"].includes(parsed.protocol)) {
            return null;
        }
        return parsed.toString();
    }
    catch {
        return null;
    }
}
function readLocalStorage(key) {
    try {
        return globalThis.localStorage?.getItem(key) ?? null;
    }
    catch {
        return null;
    }
}
function writeLocalStorage(key, value) {
    try {
        globalThis.localStorage?.setItem(key, value);
    }
    catch {
        // Storage is best-effort in the browser adapter and should not crash the UI runtime.
    }
}
