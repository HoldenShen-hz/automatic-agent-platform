import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { electronPreloadApi, installElectronBridge } from "./preload";
import type { ElectronBridge } from "@aa/shared-platform";

// Issue #2163: Bridge directly assigns window property, bypasses contextBridge isolation

describe("electronPreloadApi", () => {
  it("defines shell API mapping", () => {
    expect(electronPreloadApi.shell.openExternal).toBe("shell:openExternal");
    expect(electronPreloadApi.shell.run).toBe("shell:run");
    expect(electronPreloadApi.shell.spawn).toBe("shell:spawn");
  });

  it("defines window API mapping", () => {
    expect(electronPreloadApi.window.minimize).toBe("window:minimize");
    expect(electronPreloadApi.window.maximize).toBe("window:maximize");
    expect(electronPreloadApi.window.open).toBe("window:open");
  });

  it("defines deepLink API mapping", () => {
    expect(electronPreloadApi.deepLink.open).toBe("deep-link:open");
  });

  it("defines secureStore API mapping", () => {
    expect(electronPreloadApi.secureStore.read).toBe("secure-store:read");
    expect(electronPreloadApi.secureStore.write).toBe("secure-store:write");
    expect(electronPreloadApi.secureStore.delete).toBe("secure-store:delete");
  });

  it("defines files API mapping", () => {
    expect(electronPreloadApi.files.read).toBe("files:read");
    expect(electronPreloadApi.files.write).toBe("files:write");
  });

  it("defines privacy API mapping", () => {
    expect(electronPreloadApi.privacy.getAnalyticsConsent).toBe("privacy:getAnalyticsConsent");
    expect(electronPreloadApi.privacy.setAnalyticsConsent).toBe("privacy:setAnalyticsConsent");
    expect(electronPreloadApi.privacy.enableScreenSecurity).toBe("privacy:enableScreenSecurity");
  });
});

describe("installElectronBridge", () => {
  beforeEach(() => {
    // Clean up any existing global
    delete (global as Record<string, unknown>).__AA_ELECTRON__;
  });

  afterEach(() => {
    delete (global as Record<string, unknown>).__AA_ELECTRON__;
  });

  it("installs bridge onto target window", () => {
    const mockBridge: ElectronBridge = {
      async readSecureValue() { return "test-value"; },
      async writeSecureValue() { return; },
      async deleteSecureValue() { return; },
      async readFile() { return "file-content"; },
      async writeFile() { return; },
      async copyToClipboard() { return; },
      async openDeepLink() { return; },
      async openWindow() { return; },
      async runShell() { return { code: 0, stdout: "", stderr: "" }; },
      async spawnProcess() { return { pid: 1, kill: async () => undefined }; },
      async getAnalyticsConsent() { return true; },
      async setAnalyticsConsent() { return; },
      async enableScreenSecurity() { return; },
      onForeground() { return () => undefined; },
      onBackground() { return () => undefined; },
    };

    const targetWindow = {} as Window;
    installElectronBridge(targetWindow, mockBridge);

    expect((targetWindow as Record<string, unknown>).__AA_ELECTRON__).toBe(mockBridge);
  });

  it("allows bridge access via window.__AA_ELECTRON__", () => {
    const mockBridge: ElectronBridge = {
      async readSecureValue() { return "token"; },
      async writeSecureValue() { return; },
      async deleteSecureValue() { return; },
      async readFile() { return "data"; },
      async writeFile() { return; },
      async copyToClipboard() { return; },
      async openDeepLink() { return; },
      async openWindow() { return; },
      async runShell() { return { code: 0, stdout: "ok", stderr: "" }; },
      async spawnProcess() { return { pid: 42, kill: async () => undefined }; },
      async getAnalyticsConsent() { return false; },
      async setAnalyticsConsent() { return; },
      async enableScreenSecurity() { return; },
      onForeground() { return () => undefined; },
      onBackground() { return () => undefined; },
    };

    const targetWindow = {} as Window;
    installElectronBridge(targetWindow, mockBridge);

    const installed = (targetWindow as Record<string, unknown>).__AA_ELECTRON__ as ElectronBridge;
    expect(installed).toBeDefined();
    expect(typeof installed.readSecureValue).toBe("function");
  });

  it("preserves all bridge methods", () => {
    const mockBridge: ElectronBridge = {
      async readSecureValue() { return "val"; },
      async writeSecureValue() { return; },
      async deleteSecureValue() { return; },
      async readFile() { return "content"; },
      async writeFile() { return; },
      async copyToClipboard() { return; },
      async openDeepLink() { return; },
      async openWindow() { return; },
      async runShell() { return { code: 0, stdout: "", stderr: "" }; },
      async spawnProcess() { return { pid: 1, kill: async () => undefined }; },
      async getAnalyticsConsent() { return true; },
      async setAnalyticsConsent() { return; },
      async enableScreenSecurity() { return; },
      onForeground() { return () => undefined; },
      onBackground() { return () => undefined; },
    };

    const targetWindow = {} as Window;
    installElectronBridge(targetWindow, mockBridge);

    const installed = (targetWindow as Record<string, unknown>).__AA_ELECTRON__ as ElectronBridge;

    // Verify all methods exist
    expect(typeof installed.readSecureValue).toBe("function");
    expect(typeof installed.writeSecureValue).toBe("function");
    expect(typeof installed.deleteSecureValue).toBe("function");
    expect(typeof installed.readFile).toBe("function");
    expect(typeof installed.writeFile).toBe("function");
    expect(typeof installed.copyToClipboard).toBe("function");
    expect(typeof installed.openDeepLink).toBe("function");
    expect(typeof installed.openWindow).toBe("function");
    expect(typeof installed.runShell).toBe("function");
    expect(typeof installed.spawnProcess).toBe("function");
    expect(typeof installed.getAnalyticsConsent).toBe("function");
    expect(typeof installed.setAnalyticsConsent).toBe("function");
    expect(typeof installed.enableScreenSecurity).toBe("function");
    expect(typeof installed.onForeground).toBe("function");
    expect(typeof installed.onBackground).toBe("function");
  });
});

describe("security issue #2163: context isolation bypass", () => {
  it("installElectronBridge assigns directly to window property - bypasses contextBridge", () => {
    // Issue #2163: Direct window property assignment bypasses Electron's context isolation
    // Proper pattern would use contextBridge.exposeInMainWorld()
    // This test documents the vulnerability

    const mockBridge = {} as ElectronBridge;
    const targetWindow = {} as Window;

    // The current implementation uses direct assignment
    installElectronBridge(targetWindow, mockBridge);

    // This is the vulnerability - direct property access without contextBridge
    const hasDirectProperty = "__AA_ELECTRON__" in targetWindow;
    expect(hasDirectProperty).toBe(true);
  });

  it("documents that contextBridge should be used for isolation", () => {
    // This test serves as documentation that the correct pattern is:
    // contextBridge.exposeInMainWorld('electron', { ... })
    // instead of direct window property assignment
    const mockBridge = {} as ElectronBridge;
    const targetWindow = {} as Window;

    installElectronBridge(targetWindow, mockBridge);

    // The property exists but via direct assignment, not contextBridge
    const prop = (targetWindow as Record<string, unknown>).__AA_ELECTRON__;
    expect(prop).toBe(mockBridge);
  });
});

describe("preload API channel mapping consistency", () => {
  it("shell channels match main baseline", () => {
    expect(electronPreloadApi.shell.run).toBe("shell:run");
    expect(electronPreloadApi.shell.spawn).toBe("shell:spawn");
  });

  it("files channels match main baseline", () => {
    expect(electronPreloadApi.files.read).toBe("files:read");
    expect(electronPreloadApi.files.write).toBe("files:write");
  });

  it("all channels are string constants", () => {
    const allChannels = [
      ...Object.values(electronPreloadApi.shell),
      ...Object.values(electronPreloadApi.window),
      ...Object.values(electronPreloadApi.deepLink),
      ...Object.values(electronPreloadApi.secureStore),
      ...Object.values(electronPreloadApi.files),
      ...Object.values(electronPreloadApi.privacy),
    ];

    allChannels.forEach((channel) => {
      expect(typeof channel).toBe("string");
      expect(channel).toContain(":");
    });
  });
});