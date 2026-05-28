import { contextBridge, ipcRenderer } from "electron";
import type { ElectronBridge } from "./bridge-contract.js";

export const electronPreloadApi = {
  shell: {
    openExternal: "shell:openExternal",
  },
  window: {
    minimize: "window:minimize",
    maximize: "window:maximize",
    open: "window:open",
  },
  deepLink: {
    open: "deep-link:open",
  },
  secureStore: {
    read: "secure-store:read",
    write: "secure-store:write",
    delete: "secure-store:delete",
  },
  privacy: {
    getAnalyticsConsent: "privacy:getAnalyticsConsent",
    setAnalyticsConsent: "privacy:setAnalyticsConsent",
    enableScreenSecurity: "privacy:enableScreenSecurity",
  },
} as const;

export function installElectronBridge(target: Window, bridge: ElectronBridge): void {
  const injectedContextBridge = (
    globalThis as typeof globalThis & {
      __AA_ELECTRON_CONTEXT_BRIDGE__?: { exposeInMainWorld(name: string, api: unknown): void };
    }
  ).__AA_ELECTRON_CONTEXT_BRIDGE__ ?? contextBridge;
  if (injectedContextBridge != null) {
    injectedContextBridge.exposeInMainWorld("AA_ELECTRON", Object.freeze({ ...bridge }));
    return;
  }
  Object.defineProperty(target, "AA_ELECTRON", {
    value: Object.freeze({ ...bridge }),
    configurable: false,
    enumerable: true,
    writable: false,
  });
}

function createElectronBridge(): ElectronBridge | null {
  const injectedIpcRenderer = (
    globalThis as typeof globalThis & {
      __AA_ELECTRON_IPC_RENDERER__?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
    }
  ).__AA_ELECTRON_IPC_RENDERER__ ?? ipcRenderer;
  if (injectedIpcRenderer == null) {
    return null;
  }

  return {
    __aaBridgeSignature: "aa-electron-bridge-v1",
    async readSecureValue(key: string) {
      return await injectedIpcRenderer.invoke(electronPreloadApi.secureStore.read, key) as string | null;
    },
    async writeSecureValue(key: string, value: string) {
      await injectedIpcRenderer.invoke(electronPreloadApi.secureStore.write, key, value);
    },
    async deleteSecureValue(key: string) {
      await injectedIpcRenderer.invoke(electronPreloadApi.secureStore.delete, key);
    },
    async readFile() {
      throw new Error("electron.bridge.file_read_not_supported");
    },
    async writeFile() {
      throw new Error("electron.bridge.file_write_not_supported");
    },
    async copyToClipboard(text: string) {
      await injectedIpcRenderer.invoke("clipboard:writeText", text);
    },
    async openDeepLink(url: string) {
      await injectedIpcRenderer.invoke(electronPreloadApi.deepLink.open, url);
    },
    async openWindow(path: string) {
      await injectedIpcRenderer.invoke(electronPreloadApi.window.open, path);
    },
    async runShell() {
      throw new Error("electron.bridge.shell_not_supported");
    },
    async spawnProcess() {
      throw new Error("electron.bridge.process_not_supported");
    },
    async getAnalyticsConsent() {
      return await injectedIpcRenderer.invoke(electronPreloadApi.privacy.getAnalyticsConsent) as boolean;
    },
    async setAnalyticsConsent(enabled: boolean) {
      await injectedIpcRenderer.invoke(electronPreloadApi.privacy.setAnalyticsConsent, enabled);
    },
    async enableScreenSecurity(enabled: boolean) {
      await injectedIpcRenderer.invoke(electronPreloadApi.privacy.enableScreenSecurity, enabled);
    },
    onForeground() {
      return () => undefined;
    },
    onBackground() {
      return () => undefined;
    },
  };
}

const preloadBridge = typeof window === "undefined" ? null : createElectronBridge();
if (preloadBridge != null) {
  installElectronBridge(window, preloadBridge);
}
