import { createRequire } from "node:module";
import type { ElectronBridge } from "@aa/shared-platform";

const require = createRequire(import.meta.url);

interface ContextBridgeLike {
  exposeInMainWorld(name: string, api: unknown): void;
}

function resolveContextBridge(): ContextBridgeLike | null {
  const globals = globalThis as typeof globalThis & {
    __AA_ELECTRON_CONTEXT_BRIDGE__?: ContextBridgeLike;
  };
  if (globals.__AA_ELECTRON_CONTEXT_BRIDGE__ != null) {
    return globals.__AA_ELECTRON_CONTEXT_BRIDGE__;
  }
  try {
    return (require("electron") as { contextBridge?: ContextBridgeLike }).contextBridge ?? null;
  } catch {
    return null;
  }
}

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
  void target;
  // §210-2487: Electron bridge must be exposed through contextBridge instead of
  // direct window mutation, otherwise renderer isolation is bypassed.
  resolveContextBridge()?.exposeInMainWorld("__AA_ELECTRON__", bridge);
}
