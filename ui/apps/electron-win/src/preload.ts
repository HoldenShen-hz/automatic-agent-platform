import type { ElectronBridge } from "@aa/shared-platform";

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
  void target;
  const contextBridge = (
    globalThis as typeof globalThis & {
      __AA_ELECTRON_CONTEXT_BRIDGE__?: { exposeInMainWorld(name: string, api: unknown): void };
    }
  ).__AA_ELECTRON_CONTEXT_BRIDGE__;
  contextBridge?.exposeInMainWorld("AA_ELECTRON", bridge);
}
