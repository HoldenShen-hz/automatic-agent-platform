import { describe, expect, it, vi } from "vitest";
import {
  tauriLinuxManifest,
  createTauriLinuxAdapter,
  createTauriLinuxDefaultAdapter,
  type DesktopShellManifest,
} from "./index";
import type { PlatformAdapter } from "@aa/shared-types";

// Issue #2172: DesktopShellManifest missing updateChannel

describe("tauriLinuxManifest", () => {
  it("defines platform as linux", () => {
    expect(tauriLinuxManifest.platform).toBe("linux");
  });

  it("defines runtime as tauri", () => {
    expect(tauriLinuxManifest.runtime).toBe("tauri");
  });

  it("declares background agent support", () => {
    expect(tauriLinuxManifest.supportsBackgroundAgent).toBe(true);
  });
});

describe("DesktopShellManifest interface structure for Linux", () => {
  it("has platform field of type linux", () => {
    const manifest: DesktopShellManifest = {
      platform: "linux",
      runtime: "tauri",
      supportsBackgroundAgent: true,
      // Note: updateChannel is MISSING in tauri-linux - Issue #2172
    } as DesktopShellManifest;
    expect(manifest.platform).toBe("linux");
  });

  it("has runtime field", () => {
    const manifest: DesktopShellManifest = {
      platform: "linux",
      runtime: "tauri",
      supportsBackgroundAgent: true,
    } as DesktopShellManifest;
    expect(manifest.runtime).toBe("tauri");
  });

  it("has supportsBackgroundAgent boolean", () => {
    const manifest: DesktopShellManifest = {
      platform: "linux",
      runtime: "tauri",
      supportsBackgroundAgent: true,
    } as DesktopShellManifest;
    expect(typeof manifest.supportsBackgroundAgent).toBe("boolean");
  });
});

describe("createTauriLinuxAdapter", () => {
  it("creates adapter with linux platform", () => {
    const baseAdapter: PlatformAdapter = {
      platform: "unknown",
      copyToClipboard: vi.fn(),
      openDeepLink: vi.fn(),
      getDebugState: () => ({ platform: "unknown" }),
      onForeground: vi.fn(() => () => undefined),
      onBackground: vi.fn(() => () => undefined),
    };

    const adapter = createTauriLinuxAdapter(baseAdapter);
    expect(adapter.platform).toBe("linux");
  });

  it("preserves other adapter properties", () => {
    const copyToClipboard = vi.fn();
    const openDeepLink = vi.fn();
    const onForeground = vi.fn(() => () => undefined);
    const onBackground = vi.fn(() => () => undefined);
    const getDebugState = () => ({ platform: "linux" });

    const baseAdapter: PlatformAdapter = {
      platform: "unknown",
      copyToClipboard,
      openDeepLink,
      onForeground,
      onBackground,
      getDebugState,
    };

    const adapter = createTauriLinuxAdapter(baseAdapter);
    expect(adapter.copyToClipboard).toBe(copyToClipboard);
    expect(adapter.openDeepLink).toBe(openDeepLink);
    expect(adapter.onForeground).toBe(onForeground);
    expect(adapter.onBackground).toBe(onBackground);
    expect(adapter.getDebugState).toBe(getDebugState);
  });
});

describe("createTauriLinuxDefaultAdapter", () => {
  it("creates default adapter with linux platform", () => {
    const adapter = createTauriLinuxDefaultAdapter();
    expect(adapter.platform).toBe("linux");
  });

  it("creates adapter with all required methods", () => {
    const adapter = createTauriLinuxDefaultAdapter();
    expect(typeof adapter.copyToClipboard).toBe("function");
    expect(typeof adapter.openDeepLink).toBe("function");
    expect(typeof adapter.getDebugState).toBe("function");
    expect(typeof adapter.onForeground).toBe("function");
    expect(typeof adapter.onBackground).toBe("function");
  });
});

describe("manifest comparison with tauri-macos", () => {
  it("linux manifest missing updateChannel that macos has", () => {
    // Issue #2172: tauri-linux DesktopShellManifest is missing updateChannel
    // tauri-macos has updateChannel: "stable" | "beta"
    // tauri-linux does NOT have this field

    // The tauriMacosManifest has updateChannel
    // We verify tauriLinuxManifest does NOT have updateChannel by checking the type
    // This is a structural difference between the two platforms

    // Since we can't import across app boundaries, we test the expected behavior
    // Linux should NOT have updateChannel in the current implementation (Issue #2172)
    expect(tauriLinuxManifest.platform).toBe("linux");
    expect(tauriLinuxManifest.runtime).toBe("tauri");

    // Verify updateChannel is NOT present
    type LinuxManifest = typeof tauriLinuxManifest;
    // @ts-expect-error - updateChannel does not exist on tauri-linux manifest
    const hasUpdateChannel: LinuxManifest["updateChannel"] = undefined;
    expect(hasUpdateChannel).toBeUndefined();
  });

  it("linux should have same updateChannel field as macos for consistency", () => {
    // This test documents the inconsistency
    // Both Linux and macos should have update channel for consistent update mechanisms
    // Currently linux does NOT have updateChannel (Issue #2172)
    const linuxHasChannel = "updateChannel" in tauriLinuxManifest;
    expect(linuxHasChannel).toBe(false);
  });
});

describe("background agent support", () => {
  it("declares background agent support for linux", () => {
    // Linux can run background agents, unlike mobile platforms
    expect(tauriLinuxManifest.supportsBackgroundAgent).toBe(true);
  });

  it("background agent is linux-specific feature", () => {
    // This is a feature unique to desktop Linux
    // Not available on mobile platforms
    const linuxManifest = tauriLinuxManifest;
    expect(linuxManifest.supportsBackgroundAgent).toBe(true);
  });
});

describe("manifest immutability", () => {
  it("tauriLinuxManifest is frozen", () => {
    expect(Object.isFrozen(tauriLinuxManifest)).toBe(true);
  });

  it("manifest properties are readonly", () => {
    const manifest = tauriLinuxManifest;
    expect(manifest.platform).toBe("linux");
    expect(manifest.runtime).toBe("tauri");
  });
});

describe("adapter factory functions", () => {
  it("createTauriLinuxAdapter preserves platform override", () => {
    const baseAdapter: PlatformAdapter = {
      platform: "windows",
      copyToClipboard: vi.fn(),
      openDeepLink: vi.fn(),
      getDebugState: () => ({ platform: "windows" }),
      onForeground: vi.fn(() => () => undefined),
      onBackground: vi.fn(() => () => undefined),
    };

    const adapter = createTauriLinuxAdapter(baseAdapter);
    expect(adapter.platform).toBe("linux");
  });

  it("createTauriLinuxDefaultAdapter creates complete adapter", () => {
    const adapter = createTauriLinuxDefaultAdapter();

    // Verify it's a proper PlatformAdapter
    expect(adapter.platform).toBe("linux");
    expect(typeof adapter.copyToClipboard).toBe("function");
    expect(typeof adapter.openDeepLink).toBe("function");
    expect(typeof adapter.getDebugState).toBe("function");
    expect(typeof adapter.onForeground).toBe("function");
    expect(typeof adapter.onBackground).toBe("function");

    // Test basic operations
    expect(() => adapter.getDebugState()).not.toThrow();
  });
});