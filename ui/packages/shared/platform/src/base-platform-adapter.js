class MemorySecureStore {
    values = new Map();
    read(key) {
        return this.values.get(key) ?? null;
    }
    write(key, value) {
        this.values.set(key, value);
    }
    delete(key) {
        this.values.delete(key);
    }
}
export class DefaultPlatformAdapter {
    platform;
    secureStore = new MemorySecureStore();
    files = new Map();
    foregroundListeners = new Set();
    backgroundListeners = new Set();
    processes = new Map();
    allowedShellCommands;
    nextPid = 1000;
    analyticsConsent;
    screenSecurityEnabled;
    constructor(platform, options = {}) {
        this.platform = platform;
        this.analyticsConsent = options.analyticsConsentDefault ?? false;
        this.screenSecurityEnabled = options.screenSecurityDefault ?? false;
        this.allowedShellCommands = new Set(options.allowedShellCommands ?? []);
    }
    async fetch(input, init) {
        return globalThis.fetch(input, init);
    }
    async readSecureValue(key) {
        return this.secureStore.read(key);
    }
    async writeSecureValue(key, value) {
        this.secureStore.write(key, value);
    }
    async deleteSecureValue(key) {
        this.secureStore.delete(key);
    }
    async readFile(path) {
        return this.files.get(path) ?? "";
    }
    async writeFile(path, contents) {
        this.files.set(path, contents);
    }
    async copyToClipboard(text) {
        this.files.set("__clipboard__", text);
    }
    async openDeepLink(url) {
        this.files.set("__deeplink__", url);
    }
    onForeground(listener) {
        this.foregroundListeners.add(listener);
        return () => this.foregroundListeners.delete(listener);
    }
    onBackground(listener) {
        this.backgroundListeners.add(listener);
        return () => this.backgroundListeners.delete(listener);
    }
    async vibrate(pattern) {
        this.files.set("__haptics__", pattern.join(","));
    }
    async openWindow(path) {
        this.files.set("__window__", path);
    }
    async runShell(command) {
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
    async spawnProcess(command, args) {
        const pid = this.nextPid++;
        this.processes.set(pid, { pid, command, args });
        return {
            pid,
            kill: async () => {
                this.processes.delete(pid);
            },
        };
    }
    async getAnalyticsConsent() {
        return this.analyticsConsent;
    }
    async setAnalyticsConsent(enabled) {
        this.analyticsConsent = enabled;
    }
    async enableScreenSecurity(enabled) {
        this.screenSecurityEnabled = enabled;
    }
    get capabilities() {
        return createPlatformAdapterCapabilityView(this);
    }
    emitForeground() {
        for (const listener of this.foregroundListeners) {
            listener();
        }
    }
    emitBackground() {
        for (const listener of this.backgroundListeners) {
            listener();
        }
    }
    setDebugValue(key, value) {
        if (value == null) {
            this.files.delete(key);
            return;
        }
        this.files.set(key, value);
    }
    setAnalyticsConsentState(enabled) {
        this.analyticsConsent = enabled;
    }
    setScreenSecurityState(enabled) {
        this.screenSecurityEnabled = enabled;
    }
    getDebugState() {
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
export function createPlatformAdapterCapabilityView(adapter) {
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
