import type { ElectronBridge } from "@aa/shared-platform";

export const electronPreloadApi = {
  shell: {
    openExternal: "shell:openExternal",
    // §185-2162: shell:run and shell:spawn removed - these expose arbitrary shell execution
    // risk to renderer process. Only predefined safe commands via shell:openExternal are allowed.
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
  files: {
    read: "files:read",
    write: "files:write",
  },
  privacy: {
    getAnalyticsConsent: "privacy:getAnalyticsConsent",
    setAnalyticsConsent: "privacy:setAnalyticsConsent",
    enableScreenSecurity: "privacy:enableScreenSecurity",
  },
} as const;

export function installElectronBridge(target: Window, bridge: ElectronBridge): void {
  // §210-2487: Root cause - direct Object.defineProperty bypasses contextBridge security model
// when contextIsolation is enabled, exposing the full bridge object to renderer.
// Fix: Use contextBridge.exposeInMainWorld for proper IPC channel isolation.
  contextBridge.exposeInMainWorld("__AA_ELECTRON__", bridge);
}
