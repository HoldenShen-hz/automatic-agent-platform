import type { ElectronBridge } from "@aa/shared-platform";

export const electronPreloadApi = {
  shell: {
    openExternal: "shell:openExternal",
    run: "shell:run",
    spawn: "shell:spawn",
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
  target.__AA_ELECTRON__ = bridge;
}
