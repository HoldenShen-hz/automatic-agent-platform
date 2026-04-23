import { describe, expect, it } from "vitest";
import { createElectronWinDefaultAdapter, electronWinManifest } from "../../apps/electron-win/src";
import { tauriMacosManifest } from "../../apps/tauri-macos/src";
import { tauriLinuxManifest } from "../../apps/tauri-linux/src";
import { createMobileDefaultAdapter, mobileShellManifest } from "../../apps/mobile/src";

describe("platform shells", () => {
  it("exposes desktop and mobile shell manifests", () => {
    expect(electronWinManifest.runtime).toBe("electron");
    expect(tauriMacosManifest.platform).toBe("macos");
    expect(tauriLinuxManifest.platform).toBe("linux");
    expect(mobileShellManifest.platforms).toEqual(["android", "ios"]);
  });

  it("creates phase-aligned desktop and mobile default adapters", async () => {
    const desktop = createElectronWinDefaultAdapter();
    const mobile = createMobileDefaultAdapter("ios");

    expect(desktop.platform).toBe("windows");
    expect((await desktop.getAnalyticsConsent())).toBe(false);
    expect(mobile.platform).toBe("ios");
    expect((await mobile.getAnalyticsConsent())).toBe(true);
  });
});
