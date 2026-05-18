import { describe, expect, it, vi } from "vitest";
import {
  electronWinManifest,
  createElectronWinAdapter,
  createElectronWinDefaultAdapter,
  type DesktopShellManifest,
} from "../../../../../apps/electron-win/src/index";
import type { PlatformAdapter } from "@aa/shared-types";

describe("electronWinManifest", () => {
  it("defines platform as windows", () => {
    expect(electronWinManifest.platform).toBe("windows");
  });

  it("defines runtime as electron", () => {
    expect(electronWinManifest.runtime).toBe("electron");
  });

  it("declares secureScreen support", () => {
    expect(electronWinManifest.secureScreen).toBe(true);
  });

  it("declares tray support", () => {
    expect(electronWinManifest.supportsTray).toBe(true);
  });

  it("declares global shortcuts support", () => {
    expect(electronWinManifest.supportsGlobalShortcuts).toBe(true);
  });

  it("declares update channel as stable", () => {
    expect(electronWinManifest.updateChannel).toBe("stable");
  });
});

describe("DesktopShellManifest interface structure", () => {
  it("has platform field of type windows", () => {
    const manifest: DesktopShellManifest = {
      platform: "windows",
      runtime: "electron",
      secureScreen: true,
      supportsTray: true,
      supportsGlobalShortcuts: true,
      updateChannel: "stable",
    };
    expect(manifest.platform).toBe("windows");
  });

  it("has runtime field", () => {
    const manifest: DesktopShellManifest = {
      platform: "windows",
      runtime: "electron",
      secureScreen: true,
      supportsTray: true,
      supportsGlobalShortcuts: true,
      updateChannel: "stable",
    };
    expect(manifest.runtime).toBe("electron");
  });

  it("has secureScreen boolean", () => {
    const manifest: DesktopShellManifest = {
      platform: "windows",
      runtime: "electron",
      secureScreen: true,
      supportsTray: true,
      supportsGlobalShortcuts: true,
      updateChannel: "stable",
    };
    expect(typeof manifest.secureScreen).toBe("boolean");
  });

  it("has supportsTray boolean", () => {
    const manifest: DesktopShellManifest = {
      platform: "windows",
      runtime: "electron",
      secureScreen: true,
      supportsTray: true,
      supportsGlobalShortcuts: true,
      updateChannel: "stable",
    };
    expect(typeof manifest.supportsTray).toBe("boolean");
  });

  it("has supportsGlobalShortcuts boolean", () => {
    const manifest: DesktopShellManifest = {
      platform: "windows",
      runtime: "electron",
      secureScreen: true,
      supportsTray: true,
      supportsGlobalShortcuts: true,
      updateChannel: "stable",
    };
    expect(typeof manifest.supportsGlobalShortcuts).toBe("boolean");
  });

  it("has updateChannel union type", () => {
    const stableManifest: DesktopShellManifest = {
      platform: "windows",
      runtime: "electron",
      secureScreen: true,
      supportsTray: true,
      supportsGlobalShortcuts: true,
      updateChannel: "stable",
    };
    expect(stableManifest.updateChannel).toBe("stable");

    const betaManifest: DesktopShellManifest = {
      platform: "windows",
      runtime: "electron",
      secureScreen: true,
      supportsTray: true,
      supportsGlobalShortcuts: true,
      updateChannel: "beta",
    };
    expect(betaManifest.updateChannel).toBe("beta");
  });
});

describe("createElectronWinAdapter", () => {
  it("creates adapter with windows platform", () => {
    const baseAdapter: PlatformAdapter = {
      platform: "unknown",
      copyToClipboard: vi.fn(),
      openDeepLink: vi.fn(),
      getDebugState: () => ({ platform: "unknown" }),
      onForeground: vi.fn(() => () => undefined),
      onBackground: vi.fn(() => () => undefined),
    };

    const adapter = createElectronWinAdapter(baseAdapter);
    expect(adapter.platform).toBe("windows");
  });

  it("preserves other adapter properties", () => {
    const copyToClipboard = vi.fn();
    const openDeepLink = vi.fn();
    const onForeground = vi.fn(() => () => undefined);
    const onBackground = vi.fn(() => () => undefined);
    const getDebugState = () => ({ platform: "windows" });

    const baseAdapter: PlatformAdapter = {
      platform: "unknown",
      copyToClipboard,
      openDeepLink,
      onForeground,
      onBackground,
      getDebugState,
    };

    const adapter = createElectronWinAdapter(baseAdapter);
    expect(adapter.copyToClipboard).toBe(copyToClipboard);
    expect(adapter.openDeepLink).toBe(openDeepLink);
    expect(adapter.onForeground).toBe(onForeground);
    expect(adapter.onBackground).toBe(onBackground);
    expect(adapter.getDebugState).toBe(getDebugState);
  });
});

describe("createElectronWinDefaultAdapter", () => {
  it("creates default adapter with windows platform", () => {
    const adapter = createElectronWinDefaultAdapter();
    expect(adapter.platform).toBe("windows");
  });

  it("creates adapter with all required methods", () => {
    const adapter = createElectronWinDefaultAdapter();
    expect(typeof adapter.copyToClipboard).toBe("function");
    expect(typeof adapter.openDeepLink).toBe("function");
    expect(typeof adapter.getDebugState).toBe("function");
    expect(typeof adapter.onForeground).toBe("function");
    expect(typeof adapter.onBackground).toBe("function");
  });
});

describe("electron-win feature completeness", () => {
  it("has all security features enabled", () => {
    expect(electronWinManifest.secureScreen).toBe(true);
  });

  it("has all desktop integration features", () => {
    expect(electronWinManifest.supportsTray).toBe(true);
    expect(electronWinManifest.supportsGlobalShortcuts).toBe(true);
  });

  it("has stable update channel", () => {
    expect(electronWinManifest.updateChannel).toBe("stable");
  });
});

describe("manifest immutability", () => {
  it("electronWinManifest is frozen", () => {
    expect(Object.isFrozen(electronWinManifest)).toBe(true);
  });

  it("manifest properties are readonly", () => {
    const manifest = electronWinManifest;
    expect(manifest.platform).toBe("windows");
    expect(manifest.runtime).toBe("electron");
    expect(manifest.secureScreen).toBe(true);
    expect(manifest.supportsTray).toBe(true);
    expect(manifest.supportsGlobalShortcuts).toBe(true);
    expect(manifest.updateChannel).toBe("stable");
  });
});

describe("adapter factory functions", () => {
  it("createElectronWinAdapter preserves platform override", () => {
    const baseAdapter: PlatformAdapter = {
      platform: "linux",
      copyToClipboard: vi.fn(),
      openDeepLink: vi.fn(),
      getDebugState: () => ({ platform: "linux" }),
      onForeground: vi.fn(() => () => undefined),
      onBackground: vi.fn(() => () => undefined),
    };

    const adapter = createElectronWinAdapter(baseAdapter);
    expect(adapter.platform).toBe("windows");
  });

  it("createElectronWinDefaultAdapter creates complete adapter", () => {
    const adapter = createElectronWinDefaultAdapter();

    // Verify it's a proper PlatformAdapter
    expect(adapter.platform).toBe("windows");
    expect(typeof adapter.copyToClipboard).toBe("function");
    expect(typeof adapter.openDeepLink).toBe("function");
    expect(typeof adapter.getDebugState).toBe("function");
    expect(typeof adapter.onForeground).toBe("function");
    expect(typeof adapter.onBackground).toBe("function");

    // Test basic operations
    expect(() => adapter.getDebugState()).not.toThrow();
  });
});
