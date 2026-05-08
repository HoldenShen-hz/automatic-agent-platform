import { describe, expect, it } from "vitest";

import { describeNativeModules } from "../../packages/ui-mobile/src/native-modules";

describe("ui-mobile native modules", () => {
  it("marks bridge-backed modules unavailable when no mobile bridge is present", () => {
    delete globalThis.__AA_MOBILE__;

    const modules = describeNativeModules();
    const secureStorage = modules.find((item) => item.name === "secureStorage");
    const biometric = modules.find((item) => item.name === "biometric");

    expect(secureStorage).toMatchObject({
      enabled: false,
      requiresBridge: true,
      permission: "unavailable",
      source: "bridge",
    });
    expect(biometric).toMatchObject({
      enabled: true,
      requiresBridge: false,
      source: "adapter",
    });
  });

  it("detects bridge-backed capabilities from the mobile bridge", () => {
    globalThis.__AA_MOBILE__ = {
      readSecureValue: async () => "token",
      writeSecureValue: async () => undefined,
      deleteSecureValue: async () => undefined,
      openDeepLink: async () => undefined,
      vibrate: async () => undefined,
      enableScreenSecurity: async () => undefined,
    };

    const modules = describeNativeModules();
    expect(modules.find((item) => item.name === "secureStorage")?.enabled).toBe(true);
    expect(modules.find((item) => item.name === "deepLink")?.enabled).toBe(true);
    expect(modules.find((item) => item.name === "haptics")?.enabled).toBe(true);

    delete globalThis.__AA_MOBILE__;
  });
});
