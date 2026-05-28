import { DefaultPlatformAdapter } from "./base-platform-adapter.js";
export class DesktopPlatformAdapter extends DefaultPlatformAdapter {
    constructor(platform, options = {}) {
        super(platform, {
            screenSecurityDefault: true,
            allowedShellCommands: options.allowedShellCommands ?? ["health", "doctor", "version"],
            analyticsConsentDefault: options.analyticsConsentDefault,
        });
    }
}
export class ElectronPlatformAdapter extends DesktopPlatformAdapter {
    bridge;
    constructor(bridge = resolveTrustedElectronBridge(globalThis.window?.AA_ELECTRON)) {
        super("windows");
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
    async readFile(path) {
        return this.bridge?.readFile(path) ?? super.readFile(path);
    }
    async writeFile(path, contents) {
        if (this.bridge != null) {
            await this.bridge.writeFile(path, contents);
            return;
        }
        await super.writeFile(path, contents);
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
    async openWindow(path) {
        if (this.bridge != null) {
            await this.bridge.openWindow(path);
            this.setDebugValue("__window__", path);
            return;
        }
        await super.openWindow(path);
    }
    async runShell(command) {
        const normalizedCommand = command.trim();
        const fallback = await super.runShell(normalizedCommand);
        if (fallback.code !== 0 || this.bridge == null) {
            return fallback;
        }
        return this.bridge.runShell(normalizedCommand);
    }
    async spawnProcess(command, args) {
        return this.bridge?.spawnProcess(command, args) ?? super.spawnProcess(command, args);
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
function resolveTrustedElectronBridge(candidate) {
    if (candidate == null || typeof candidate !== "object") {
        return undefined;
    }
    if (!Object.isFrozen(candidate)) {
        return undefined;
    }
    const bridge = candidate;
    const requiredMethods = [
        "readSecureValue",
        "writeSecureValue",
        "deleteSecureValue",
        "readFile",
        "writeFile",
        "copyToClipboard",
        "openDeepLink",
        "openWindow",
        "runShell",
        "spawnProcess",
        "getAnalyticsConsent",
        "setAnalyticsConsent",
        "enableScreenSecurity",
        "onForeground",
        "onBackground",
    ];
    if (bridge.__aaBridgeSignature !== "aa-electron-bridge-v1") {
        return undefined;
    }
    if (requiredMethods.some((key) => typeof bridge[key] !== "function")) {
        return undefined;
    }
    return bridge;
}
export class TauriPlatformAdapter extends DesktopPlatformAdapter {
    bridge;
    constructor(platform, bridge = globalThis.window?.__TAURI__) {
        super(platform);
        this.bridge = bridge;
    }
    async readSecureValue(key) {
        return this.bridge?.invoke("read_secure_value", { key }) ?? super.readSecureValue(key);
    }
    async writeSecureValue(key, value) {
        if (this.bridge != null) {
            await this.bridge.invoke("write_secure_value", { key, value });
            return;
        }
        await super.writeSecureValue(key, value);
    }
    async deleteSecureValue(key) {
        if (this.bridge != null) {
            await this.bridge.invoke("delete_secure_value", { key });
            return;
        }
        await super.deleteSecureValue(key);
    }
    async readFile(path) {
        if (this.bridge != null) {
            return this.bridge.invoke("read_file", { path });
        }
        return super.readFile(path);
    }
    async writeFile(path, contents) {
        if (this.bridge != null) {
            await this.bridge.invoke("write_file", { path, contents });
            return;
        }
        await super.writeFile(path, contents);
    }
    async copyToClipboard(text) {
        if (this.bridge != null) {
            await this.bridge.invoke("copy_to_clipboard", { text });
            this.setDebugValue("__clipboard__", text);
            return;
        }
        await super.copyToClipboard(text);
    }
    async openDeepLink(url) {
        if (this.bridge != null) {
            await this.bridge.invoke("open_deep_link", { url });
            this.setDebugValue("__deeplink__", url);
            return;
        }
        await super.openDeepLink(url);
    }
    onForeground(listener) {
        return this.bridge?.onForeground?.(listener) ?? super.onForeground(listener);
    }
    onBackground(listener) {
        return this.bridge?.onBackground?.(listener) ?? super.onBackground(listener);
    }
    async openWindow(path) {
        if (this.bridge != null) {
            await this.bridge.invoke("open_window", { path });
            this.setDebugValue("__window__", path);
            return;
        }
        await super.openWindow(path);
    }
    async runShell(command) {
        if (this.bridge != null) {
            return this.bridge.invoke("run_shell", { command });
        }
        return super.runShell(command);
    }
    async spawnProcess(command, args) {
        if (this.bridge != null) {
            const pid = await this.bridge.invoke("spawn_process", { command, args });
            return {
                pid,
                kill: async () => {
                    await this.bridge?.invoke("kill_process", { pid });
                },
            };
        }
        return super.spawnProcess(command, args);
    }
    async getAnalyticsConsent() {
        return this.bridge?.invoke("get_analytics_consent") ?? super.getAnalyticsConsent();
    }
    async setAnalyticsConsent(enabled) {
        if (this.bridge != null) {
            await this.bridge.invoke("set_analytics_consent", { enabled });
            this.setAnalyticsConsentState(enabled);
            return;
        }
        await super.setAnalyticsConsent(enabled);
    }
    async enableScreenSecurity(enabled) {
        if (this.bridge != null) {
            await this.bridge.invoke("enable_screen_security", { enabled });
            this.setScreenSecurityState(enabled);
            return;
        }
        await super.enableScreenSecurity(enabled);
    }
}
