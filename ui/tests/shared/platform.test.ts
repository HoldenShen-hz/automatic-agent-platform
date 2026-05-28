import { describe, expect, it } from "vitest";
import {
  DefaultPlatformAdapter,
  createPlatformAdapterCapabilityView,
  createDesktopPlatformAdapter,
  createMobilePlatformAdapter,
  createWebPlatformAdapter,
} from "@aa/shared-platform";
import { mobileGlobals } from "../helpers/mobile-bridge";

describe("shared platform adapter", () => {
  it("creates web adapter with clipboard and deeplink support", async () => {
    const adapter = createWebPlatformAdapter();
    await adapter.copyToClipboard("copied");
    await adapter.openDeepLink("aa://tasks/123");

    expect(adapter.getDebugState().clipboard).toBe("copied");
    expect(adapter.getDebugState().deepLink).toBe("aa://tasks/123");
  });

  it("creates desktop adapter with screen security enabled by default", async () => {
    const adapter = createDesktopPlatformAdapter("windows");
    expect(adapter.platform).toBe("windows");
    expect(adapter.getDebugState().screenSecurityEnabled).toBe(true);
    expect((await adapter.runShell("echo desktop")).code).toBe(1);
    expect((await adapter.runShell("health")).stdout).toContain("health");
    expect((await adapter.spawnProcess("worker", ["--once"])).pid).toBeGreaterThan(0);
  });

  it("uses the electron bridge when present", async () => {
    const calls: string[] = [];
    window.AA_ELECTRON = Object.freeze({
      __aaBridgeSignature: "aa-electron-bridge-v1",
      async readSecureValue() { return "token"; },
      async writeSecureValue() { calls.push("write"); },
      async deleteSecureValue() { calls.push("delete"); },
      async readFile() { return "file"; },
      async writeFile() { calls.push("write-file"); },
      async copyToClipboard(text) { calls.push(`clipboard:${text}`); },
      async openDeepLink(url) { calls.push(`deeplink:${url}`); },
      async openWindow(path) { calls.push(`window:${path}`); },
      async runShell(command) { return { code: 0, stdout: `shell:${command}`, stderr: "" }; },
      async spawnProcess() { return { pid: 42, kill: async () => undefined }; },
      async getAnalyticsConsent() { return true; },
      async setAnalyticsConsent(enabled) { calls.push(`consent:${String(enabled)}`); },
      async enableScreenSecurity(enabled) { calls.push(`screen:${String(enabled)}`); },
      onForeground() { return () => undefined; },
      onBackground() { return () => undefined; },
    });

    const adapter = createDesktopPlatformAdapter("windows");
    await adapter.copyToClipboard("hello");
    await adapter.openDeepLink("aa://deep");
    expect((await adapter.runShell("health")).stdout).toBe("shell:health");
    expect(calls).toContain("clipboard:hello");
    expect(calls).toContain("deeplink:aa://deep");
    delete window.AA_ELECTRON;
  });

  it("uses the tauri bridge when present", async () => {
    window.__TAURI__ = {
      async invoke<T>(command: string): Promise<T> {
        if (command === "run_shell") {
          return { code: 0, stdout: "tauri:ok", stderr: "" } as T;
        }
        if (command === "get_analytics_consent") {
          return true as T;
        }
        return null as T;
      },
    };

    const adapter = createDesktopPlatformAdapter("macos");
    expect((await adapter.runShell("health")).stdout).toBe("tauri:ok");
    expect(await adapter.getAnalyticsConsent()).toBe(true);
    delete window.__TAURI__;
  });

  it("creates mobile adapter with analytics consent enabled baseline", async () => {
    const adapter = createMobilePlatformAdapter("android");
    expect(await adapter.getAnalyticsConsent()).toBe(true);
    await adapter.enableScreenSecurity(true);
    await adapter.vibrate([10, 20, 10]);
    expect(adapter.getDebugState().screenSecurityEnabled).toBe(true);
  });

  it("uses the mobile native bridge when present", async () => {
    const calls: string[] = [];
    mobileGlobals().__AA_MOBILE__ = {
      async readSecureValue() { return "secret"; },
      async writeSecureValue() { calls.push("write"); },
      async deleteSecureValue() { calls.push("delete"); },
      async copyToClipboard(text: string) { calls.push(`clipboard:${text}`); },
      async openDeepLink(url: string) { calls.push(`deeplink:${url}`); },
      async vibrate(pattern: readonly number[]) { calls.push(`vibrate:${pattern.join("-")}`); },
      async getAnalyticsConsent() { return true; },
      async setAnalyticsConsent(enabled: boolean) { calls.push(`consent:${String(enabled)}`); },
      async enableScreenSecurity(enabled: boolean) { calls.push(`screen:${String(enabled)}`); },
      onForeground() { return () => undefined; },
      onBackground() { return () => undefined; },
    };

    const adapter = createMobilePlatformAdapter("ios");
    await adapter.openDeepLink("aa://mobile");
    await adapter.vibrate([1, 2, 3]);
    expect(calls).toContain("deeplink:aa://mobile");
    expect(calls).toContain("vibrate:1-2-3");
    delete mobileGlobals().__AA_MOBILE__;
  });

  it("tracks background and foreground listeners", () => {
    const adapter = new DefaultPlatformAdapter("web");
    const events: string[] = [];
    adapter.onForeground(() => events.push("foreground"));
    adapter.onBackground(() => events.push("background"));

    adapter.emitBackground();
    adapter.emitForeground();

    expect(events).toEqual(["background", "foreground"]);
  });

  it("provides a documented capability-view adapter facade", async () => {
    const adapter = new DefaultPlatformAdapter("web");
    const capabilities = createPlatformAdapterCapabilityView(adapter);

    await capabilities.secureStorage.set("token", "abc");
    await capabilities.offlineStore.set("/drafts/note.txt", "hello");
    await capabilities.windowing.open("/mission-control/dashboard");

    expect(await capabilities.secureStorage.get("token")).toBe("abc");
    expect(await capabilities.offlineStore.get("/drafts/note.txt")).toBe("hello");
    expect(adapter.getDebugState().windowPath).toBe("/mission-control/dashboard");
  });
});
