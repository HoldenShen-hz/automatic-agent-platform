import assert from "node:assert/strict";
import test from "node:test";
import { loadRepoModule } from "../../../../helpers/repo-module.js";

async function loadPlatformModule() {
  return loadRepoModule<{
    DefaultPlatformAdapter: new (
      platform: string,
      options?: { allowedShellCommands?: string[] },
    ) => { runShell(command: string): Promise<{ code: number; stderr: string }> };
    MobilePlatformAdapter: new (platform: string, bridge?: unknown) => {
      getAnalyticsConsent(): Promise<boolean>;
      setAnalyticsConsent(enabled: boolean): Promise<void>;
    };
    WebPlatformAdapter: new () => {
      writeSecureValue(key: string, value: string): Promise<void>;
      readSecureValue(key: string): Promise<string | null>;
      deleteSecureValue(key: string): Promise<void>;
      setAnalyticsConsent(enabled: boolean): Promise<void>;
      getAnalyticsConsent(): Promise<boolean>;
      getDebugState(): { screenSecurityEnabled: boolean };
    };
  }>("ui", "packages", "shared", "platform", "src", "index.ts");
}

test("WebPlatformAdapter keeps secure values out of localStorage", async () => {
  const { WebPlatformAdapter } = await loadPlatformModule();
  const originalLocalStorage = globalThis.localStorage;
  const touchedKeys: string[] = [];

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem(key: string) {
        touchedKeys.push(`get:${key}`);
        return null;
      },
      setItem(key: string, value: string) {
        touchedKeys.push(`set:${key}=${value}`);
      },
    },
  });

  try {
    const adapter = new WebPlatformAdapter();

    await adapter.writeSecureValue("token", "secret-value");
    assert.equal(await adapter.readSecureValue("token"), "secret-value");
    await adapter.deleteSecureValue("token");
    assert.equal(await adapter.readSecureValue("token"), null);

    assert.deepEqual(touchedKeys, []);
  } finally {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
  }
});

test("WebPlatformAdapter uses localStorage only for analytics consent persistence", async () => {
  const { WebPlatformAdapter } = await loadPlatformModule();
  const originalLocalStorage = globalThis.localStorage;
  const stored = new Map<string, string>();

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem(key: string) {
        return stored.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        stored.set(key, value);
      },
    },
  });

  try {
    const adapter = new WebPlatformAdapter();
    await adapter.setAnalyticsConsent(true);
    assert.equal(stored.get("aa.analytics.consent"), "true");
    assert.equal(await adapter.getAnalyticsConsent(), true);
  } finally {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
  }
});

test("WebPlatformAdapter enables screen security by default to match desktop shells", async () => {
  const { WebPlatformAdapter } = await loadPlatformModule();
  const adapter = new WebPlatformAdapter();

  assert.equal(adapter.getDebugState().screenSecurityEnabled, true);
});

test("MobilePlatformAdapter defaults analytics consent to opt-in true", async () => {
  const { MobilePlatformAdapter } = await loadPlatformModule();
  const adapter = new MobilePlatformAdapter("ios");

  assert.equal(await adapter.getAnalyticsConsent(), true);
});

test("MobilePlatformAdapter persists explicit analytics consent through the mobile bridge", async () => {
  const { MobilePlatformAdapter } = await loadPlatformModule();
  let consent = false;
  let setCalls = 0;
  const bridge = {
    readSecureValue: async () => null,
    writeSecureValue: async () => undefined,
    deleteSecureValue: async () => undefined,
    copyToClipboard: async () => undefined,
    openDeepLink: async () => undefined,
    onForeground: () => () => undefined,
    onBackground: () => () => undefined,
    vibrate: async () => undefined,
    getAnalyticsConsent: async () => consent,
    setAnalyticsConsent: async (enabled: boolean) => {
      consent = enabled;
      setCalls += 1;
    },
    enableScreenSecurity: async () => undefined,
  };

  const adapter = new MobilePlatformAdapter("android", bridge as never);

  assert.equal(await adapter.getAnalyticsConsent(), false);
  await adapter.setAnalyticsConsent(true);
  assert.equal(setCalls, 1);
  assert.equal(await adapter.getAnalyticsConsent(), true);
});

test("DefaultPlatformAdapter.runShell denies commands outside the whitelist", async () => {
  const { DefaultPlatformAdapter } = await loadPlatformModule();
  const adapter = new DefaultPlatformAdapter("linux", {
    allowedShellCommands: ["health-check", "sync-status"],
  });

  const allowed = await adapter.runShell("health-check");
  const blocked = await adapter.runShell("rm -rf /");

  assert.equal(allowed.code, 0);
  assert.equal(blocked.code, 1);
  assert.match(blocked.stderr, /not in whitelist/);
  assert.match(blocked.stderr, /health-check, sync-status/);
});
