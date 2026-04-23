import { describe, expect, it } from "vitest";
import {
  DefaultPlatformAdapter,
  createDesktopPlatformAdapter,
  createMobilePlatformAdapter,
  createWebPlatformAdapter,
} from "@aa/shared-platform";

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
    expect((await adapter.runShell("echo desktop")).stdout).toContain("echo desktop");
    expect((await adapter.spawnProcess("worker", ["--once"])).pid).toBeGreaterThan(0);
  });

  it("creates mobile adapter with analytics consent enabled baseline", async () => {
    const adapter = createMobilePlatformAdapter("android");
    expect(await adapter.getAnalyticsConsent()).toBe(true);
    await adapter.enableScreenSecurity(true);
    await adapter.vibrate([10, 20, 10]);
    expect(adapter.getDebugState().screenSecurityEnabled).toBe(true);
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
});
