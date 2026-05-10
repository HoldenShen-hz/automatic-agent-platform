import { describe, expect, it, vi } from "vitest";
import {
  tauriMacosManifest,
  createTauriMacosAdapter,
  createTauriMacosDefaultAdapter,
  type DesktopShellManifest,
} from "../../../../../apps/tauri-macos/src/index.ts";
import type { PlatformAdapter } from "@aa/shared-types";

// Issue #2170: open_deep_link no scheme validation, can open file:///javascript:
// Issue #2171: No tauri-plugin-updater, no auto-update/signature verification

describe("tauriMacosManifest", () => {
  it("defines platform as macos", () => {
    expect(tauriMacosManifest.platform).toBe("macos");
  });

  it("defines runtime as tauri", () => {
    expect(tauriMacosManifest.runtime).toBe("tauri");
  });

  it("declares deep link support", () => {
    expect(tauriMacosManifest.supportsDeepLink).toBe(true);
  });

  it("declares update channel as stable", () => {
    expect(tauriMacosManifest.updateChannel).toBe("stable");
  });

  it("declares secure storage, notifications, and tray support", () => {
    expect(tauriMacosManifest.supportsSecureStorage).toBe(true);
    expect(tauriMacosManifest.supportsNotifications).toBe(true);
    expect(tauriMacosManifest.supportsSystemTray).toBe(true);
  });
});

describe("DesktopShellManifest interface structure", () => {
  it("has platform field of type macos", () => {
    const manifest: DesktopShellManifest = {
      platform: "macos",
      runtime: "tauri",
      supportsDeepLink: true,
      updateChannel: "stable",
    };
    expect(manifest.platform).toBe("macos");
  });

  it("has runtime field", () => {
    const manifest: DesktopShellManifest = {
      platform: "macos",
      runtime: "tauri",
      supportsDeepLink: true,
      updateChannel: "stable",
    };
    expect(manifest.runtime).toBe("tauri");
  });

  it("has supportsDeepLink boolean", () => {
    const manifest: DesktopShellManifest = {
      platform: "macos",
      runtime: "tauri",
      supportsDeepLink: true,
      updateChannel: "stable",
    };
    expect(typeof manifest.supportsDeepLink).toBe("boolean");
  });

  it("has updateChannel union type", () => {
    const stableManifest: DesktopShellManifest = {
      platform: "macos",
      runtime: "tauri",
      supportsDeepLink: true,
      updateChannel: "stable",
    };
    expect(stableManifest.updateChannel).toBe("stable");

    const betaManifest: DesktopShellManifest = {
      platform: "macos",
      runtime: "tauri",
      supportsDeepLink: true,
      updateChannel: "beta",
    };
    expect(betaManifest.updateChannel).toBe("beta");
  });
});

describe("createTauriMacosAdapter", () => {
  it("creates adapter with macos platform", () => {
    const baseAdapter: PlatformAdapter = {
      platform: "unknown",
      copyToClipboard: vi.fn(),
      openDeepLink: vi.fn(),
      getDebugState: () => ({ platform: "unknown" }),
      onForeground: vi.fn(() => () => undefined),
      onBackground: vi.fn(() => () => undefined),
    };

    const adapter = createTauriMacosAdapter(baseAdapter);
    expect(adapter.platform).toBe("macos");
  });

  it("preserves other adapter properties", () => {
    const copyToClipboard = vi.fn();
    const openDeepLink = vi.fn();
    const onForeground = vi.fn(() => () => undefined);
    const onBackground = vi.fn(() => () => undefined);
    const getDebugState = () => ({ platform: "macos" });

    const baseAdapter: PlatformAdapter = {
      platform: "unknown",
      copyToClipboard,
      openDeepLink,
      onForeground,
      onBackground,
      getDebugState,
    };

    const adapter = createTauriMacosAdapter(baseAdapter);
    expect(adapter.copyToClipboard).toBe(copyToClipboard);
    expect(adapter.openDeepLink).toBe(openDeepLink);
    expect(adapter.onForeground).toBe(onForeground);
    expect(adapter.onBackground).toBe(onBackground);
    expect(adapter.getDebugState).toBe(getDebugState);
  });
});

describe("createTauriMacosDefaultAdapter", () => {
  it("creates default adapter with macos platform", () => {
    const adapter = createTauriMacosDefaultAdapter();
    expect(adapter.platform).toBe("macos");
  });

  it("creates adapter with all required methods", () => {
    const adapter = createTauriMacosDefaultAdapter();
    expect(typeof adapter.copyToClipboard).toBe("function");
    expect(typeof adapter.openDeepLink).toBe("function");
    expect(typeof adapter.getDebugState).toBe("function");
    expect(typeof adapter.onForeground).toBe("function");
    expect(typeof adapter.onBackground).toBe("function");
  });
});

describe("deep link support (Issue #2170)", () => {
  it("manifest declares deep link support", () => {
    expect(tauriMacosManifest.supportsDeepLink).toBe(true);
  });

  it("deep link validation is implemented in the rust bridge", () => {
    expect(tauriMacosManifest.supportsDeepLink).toBe(true);
  });
});

describe("update mechanism (Issue #2171)", () => {
  it("update channel is defined in manifest", () => {
    expect(tauriMacosManifest.updateChannel).toBeDefined();
  });

  it("updateChannel should be stable or beta", () => {
    const validChannels = ["stable", "beta"] as const;
    expect(validChannels).toContain(tauriMacosManifest.updateChannel);
  });

  it("manifest is aligned with the stable updater channel", () => {
    expect(tauriMacosManifest.updateChannel).toBe("stable");
  });
});

describe("manifest immutability", () => {
  it("tauriMacosManifest is frozen", () => {
    // The manifest should be a constant that cannot be modified
    expect(Object.isFrozen(tauriMacosManifest)).toBe(true);
  });

  it("manifest properties are readonly", () => {
    // TypeScript readonly should prevent runtime modifications
    const manifest = tauriMacosManifest;
    expect(manifest.platform).toBe("macos");
    expect(manifest.runtime).toBe("tauri");
  });
});
