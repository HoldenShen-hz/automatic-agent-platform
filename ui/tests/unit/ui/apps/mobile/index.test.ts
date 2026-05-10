import { describe, expect, it } from "vitest";

import { createMobileDefaultAdapter, mobileShellManifest } from "../../../../../apps/mobile/src";

describe("mobile shell manifest", () => {
  it("declares productized native capabilities required by the mobile shell", () => {
    expect(mobileShellManifest.runtime).toBe("react-native");
    expect(mobileShellManifest.platforms).toEqual(["android", "ios"]);
    expect(mobileShellManifest.supportsPush).toBe(true);
    expect(mobileShellManifest.supportsBiometric).toBe(true);
    expect(mobileShellManifest.supportsOfflineSqlite).toBe(true);
    expect(mobileShellManifest.supportsGestures).toBe(true);
    expect(mobileShellManifest.supportsWidgets).toBe(true);
  });

  it("creates platform-specific adapters without hard-coding android for all users", () => {
    expect(createMobileDefaultAdapter("android").platform).toBe("android");
    expect(createMobileDefaultAdapter("ios").platform).toBe("ios");
  });
});
