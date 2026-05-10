import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createElectronWinDefaultAdapter, electronWinManifest } from "../../apps/electron-win/src";
import { tauriMacosManifest } from "../../apps/tauri-macos/src";
import { tauriLinuxManifest } from "../../apps/tauri-linux/src";
import { createMobileDefaultAdapter, mobileShellManifest } from "../../apps/mobile/src";
import { mobileNavigation } from "../../apps/mobile/src/navigation";

describe("platform shells", () => {
  it("exposes desktop and mobile shell manifests", () => {
    expect(electronWinManifest.runtime).toBe("electron");
    expect(electronWinManifest.supportsTray).toBe(true);
    expect(tauriMacosManifest.platform).toBe("macos");
    expect(tauriMacosManifest.supportsDeepLink).toBe(true);
    expect(tauriLinuxManifest.platform).toBe("linux");
    expect(tauriLinuxManifest.supportsBackgroundAgent).toBe(false);
    expect(mobileShellManifest.platforms).toEqual(["android", "ios"]);
    expect(mobileShellManifest.supportsScreenSecurity).toBe(true);
  });

  it("creates phase-aligned desktop and mobile default adapters", async () => {
    const desktop = createElectronWinDefaultAdapter();
    const mobile = createMobileDefaultAdapter("ios");

    expect(desktop.platform).toBe("windows");
    expect((await desktop.getAnalyticsConsent())).toBe(false);
    expect(mobile.platform).toBe("ios");
    expect((await mobile.getAnalyticsConsent())).toBe(true);
  });

  it("declares mobile tab and modal navigation for phase 3 flows", () => {
    expect(mobileNavigation.tabs.map((screen) => screen.id)).toEqual([
      "dashboard",
      "tasks",
      "workflow-cockpit",
      "approvals",
      "conversation",
      "settings",
    ]);
    expect(mobileNavigation.modalFlows.some((screen) => screen.id === "hitl")).toBe(true);
  });

  it("ships real project baseline files for desktop and mobile shells", () => {
    const root = process.cwd();
    expect(existsSync(join(root, "ui/apps/electron-win/src/main.ts"))).toBe(true);
    expect(existsSync(join(root, "ui/apps/electron-win/src/preload.ts"))).toBe(true);
    expect(existsSync(join(root, "ui/apps/tauri-macos/src-tauri/Cargo.toml"))).toBe(true);
    expect(existsSync(join(root, "ui/apps/tauri-linux/src-tauri/Cargo.toml"))).toBe(true);
    expect(existsSync(join(root, "ui/apps/mobile/app.json"))).toBe(true);
    expect(existsSync(join(root, "ui/apps/mobile/metro.config.js"))).toBe(true);
  });
});
