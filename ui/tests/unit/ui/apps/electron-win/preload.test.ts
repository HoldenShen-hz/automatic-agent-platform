import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ElectronBridge } from "@aa/shared-platform";

const electronMocks = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: electronMocks.exposeInMainWorld,
  },
  ipcRenderer: {
    invoke: electronMocks.invoke,
  },
}));

import {
  electronPreloadApi,
  installElectronBridge,
} from "../../../../../apps/electron-win/src/preload";

function createBridgeStub(): ElectronBridge {
  return {
    async readSecureValue() { return "token"; },
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
}

describe("electronPreloadApi", () => {
  it("only exposes the safe shell API mapping", () => {
    expect(electronPreloadApi.shell.openExternal).toBe("shell:openExternal");
    expect("run" in electronPreloadApi.shell).toBe(false);
    expect("spawn" in electronPreloadApi.shell).toBe(false);
  });

  it("does not advertise unrestricted file channels", () => {
    expect("files" in electronPreloadApi).toBe(false);
  });

  it("keeps the window and privacy channel mappings", () => {
    expect(electronPreloadApi.window.minimize).toBe("window:minimize");
    expect(electronPreloadApi.window.maximize).toBe("window:maximize");
    expect(electronPreloadApi.window.open).toBe("window:open");
    expect(electronPreloadApi.privacy.getAnalyticsConsent).toBe("privacy:getAnalyticsConsent");
  });
});

describe("installElectronBridge", () => {
  beforeEach(() => {
    electronMocks.exposeInMainWorld.mockClear();
    (
      globalThis as typeof globalThis & {
        __AA_ELECTRON_CONTEXT_BRIDGE__?: { exposeInMainWorld(name: string, api: unknown): void };
      }
    ).__AA_ELECTRON_CONTEXT_BRIDGE__ = {
      exposeInMainWorld: electronMocks.exposeInMainWorld,
    };
  });

  it("publishes the bridge through contextBridge instead of mutating window directly", () => {
    const bridge = createBridgeStub();
    const targetWindow = {} as Window;

    installElectronBridge(targetWindow, bridge);

    expect(electronMocks.exposeInMainWorld).toHaveBeenCalledWith("AA_ELECTRON", expect.objectContaining(bridge));
    expect(Object.prototype.hasOwnProperty.call(targetWindow, "__AA_ELECTRON__")).toBe(false);
  });
});
