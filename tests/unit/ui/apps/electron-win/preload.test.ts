import assert from "node:assert/strict";
import test from "node:test";

function getChannelNames(
  channels: ReadonlyArray<{ name: string; tier: string; permission: string }>,
): string[] {
  return channels.map((channel) => channel.name);
}

test.describe("electron preload module structure", () => {
  test("preload module exports electronPreloadApi and installElectronBridge", async () => {
    const preload = await import("../../../../../ui/apps/electron-win/src/preload.js");
    assert.ok(preload.electronPreloadApi !== undefined);
    assert.equal(typeof preload.installElectronBridge, "function");
  });
});

test.describe("electronPreloadApi security surface", () => {
  test("shell namespace only exposes openExternal", async () => {
    const preload = await import("../../../../../ui/apps/electron-win/src/preload.js");
    assert.deepEqual(preload.electronPreloadApi.shell, {
      openExternal: "shell:openExternal",
    });
    assert.equal("run" in preload.electronPreloadApi.shell, false);
    assert.equal("spawn" in preload.electronPreloadApi.shell, false);
  });

  test("preload API no longer advertises unrestricted file channels", async () => {
    const preload = await import("../../../../../ui/apps/electron-win/src/preload.js");
    assert.equal("files" in preload.electronPreloadApi, false);
  });

  test("window, deepLink, secureStore, and privacy namespaces remain available", async () => {
    const preload = await import("../../../../../ui/apps/electron-win/src/preload.js");
    assert.equal(preload.electronPreloadApi.window.minimize, "window:minimize");
    assert.equal(preload.electronPreloadApi.window.maximize, "window:maximize");
    assert.equal(preload.electronPreloadApi.window.open, "window:open");
    assert.equal(preload.electronPreloadApi.deepLink.open, "deep-link:open");
    assert.equal(preload.electronPreloadApi.secureStore.read, "secure-store:read");
    assert.equal(preload.electronPreloadApi.secureStore.write, "secure-store:write");
    assert.equal(preload.electronPreloadApi.secureStore.delete, "secure-store:delete");
    assert.equal(preload.electronPreloadApi.privacy.getAnalyticsConsent, "privacy:getAnalyticsConsent");
    assert.equal(preload.electronPreloadApi.privacy.setAnalyticsConsent, "privacy:setAnalyticsConsent");
    assert.equal(preload.electronPreloadApi.privacy.enableScreenSecurity, "privacy:enableScreenSecurity");
  });
});

test.describe("installElectronBridge", () => {
  test("exposes the bridge via contextBridge instead of mutating window", async () => {
    const preload = await import("../../../../../ui/apps/electron-win/src/preload.js");
    const calls: Array<{ name: string; api: unknown }> = [];
    const originalBridge = (globalThis as typeof globalThis & {
      __AA_ELECTRON_CONTEXT_BRIDGE__?: { exposeInMainWorld(name: string, api: unknown): void };
    }).__AA_ELECTRON_CONTEXT_BRIDGE__;
    (globalThis as typeof globalThis & {
      __AA_ELECTRON_CONTEXT_BRIDGE__?: { exposeInMainWorld(name: string, api: unknown): void };
    }).__AA_ELECTRON_CONTEXT_BRIDGE__ = {
      exposeInMainWorld(name: string, api: unknown): void {
        calls.push({ name, api });
      },
    };

    const mockTarget = {} as Window;
    const mockBridge = {
      readSecureValue: async () => null,
      writeSecureValue: async () => undefined,
      deleteSecureValue: async () => undefined,
      readFile: async () => "",
      writeFile: async () => undefined,
      copyToClipboard: async () => undefined,
      openDeepLink: async () => undefined,
      openWindow: async () => undefined,
      runShell: async () => ({ code: 0, stdout: "", stderr: "" }),
      spawnProcess: async () => ({ pid: 1, kill: async () => undefined }),
      getAnalyticsConsent: async () => true,
      setAnalyticsConsent: async () => undefined,
      enableScreenSecurity: async () => undefined,
      onForeground: () => () => undefined,
      onBackground: () => () => undefined,
    };

    try {
      preload.installElectronBridge(mockTarget, mockBridge);
      assert.deepEqual(calls, [{ name: "AA_ELECTRON", api: mockBridge }]);
      assert.equal("__AA_ELECTRON__" in (mockTarget as Record<string, unknown>), false);
    } finally {
      (globalThis as typeof globalThis & {
        __AA_ELECTRON_CONTEXT_BRIDGE__?: { exposeInMainWorld(name: string, api: unknown): void };
      }).__AA_ELECTRON_CONTEXT_BRIDGE__ = originalBridge;
    }
  });
});

test.describe("main/preload channel consistency", () => {
  test("all channels exposed by main are represented in preload API", async () => {
    const preload = await import("../../../../../ui/apps/electron-win/src/preload.js");
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");

    const channelToApiPath: Record<string, string[]> = {
      "shell:openExternal": ["shell", "openExternal"],
      "window:minimize": ["window", "minimize"],
      "window:maximize": ["window", "maximize"],
      "window:open": ["window", "open"],
      "deep-link:open": ["deepLink", "open"],
      "secure-store:read": ["secureStore", "read"],
      "secure-store:write": ["secureStore", "write"],
      "secure-store:delete": ["secureStore", "delete"],
      "privacy:getAnalyticsConsent": ["privacy", "getAnalyticsConsent"],
      "privacy:setAnalyticsConsent": ["privacy", "setAnalyticsConsent"],
      "privacy:enableScreenSecurity": ["privacy", "enableScreenSecurity"],
    };

    for (const channel of main.electronMainBaseline.channels) {
      const apiPath = channelToApiPath[channel.name];
      assert.ok(apiPath, `Missing API path mapping for ${channel.name}`);
      const value = apiPath.reduce((obj: any, key) => obj?.[key], preload.electronPreloadApi);
      assert.equal(value, channel.name, `Channel ${channel.name} should map to preload API`);
    }
  });

  test("removed high-risk channels stay absent from both main and preload", async () => {
    const preload = await import("../../../../../ui/apps/electron-win/src/preload.js");
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    const channelNames = getChannelNames(main.electronMainBaseline.channels);

    assert.equal(channelNames.includes("shell:run"), false);
    assert.equal(channelNames.includes("shell:spawn"), false);
    assert.equal(channelNames.includes("files:read"), false);
    assert.equal(channelNames.includes("files:write"), false);
    assert.equal("run" in preload.electronPreloadApi.shell, false);
    assert.equal("spawn" in preload.electronPreloadApi.shell, false);
    assert.equal("files" in preload.electronPreloadApi, false);
  });
});
