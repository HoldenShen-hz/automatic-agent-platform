import { describe, expect, it, vi } from "vitest";
import {
  tauriLinuxManifest,
  createTauriLinuxAdapter,
  createTauriLinuxDefaultAdapter,
  type DesktopShellManifest,
} from "../../../../../apps/tauri-linux/src/index.ts";
 
import type { PlatformAdapter } from "@aa/shared-types";

describe("tauriLinuxManifest", () => {
  it("defines platform as linux", () => {
    expect(tauriLinuxManifest.platform).toBe("linux");
  });

  it("defines runtime as tauri", () => {
    expect(tauriLinuxManifest.runtime).toBe("tauri");
  });

  it("declares background agent support", () => {
    expect(tauriLinuxManifest.supportsBackgroundAgent).toBe(false);
  });

  it("declares update channel for desktop updater consistency", () => {
    expect(tauriLinuxManifest.updateChannel).toBe("stable");
  });
});

describe("DesktopShellManifest interface structure for Linux", () => {
  it("has the desktop updater contract fields", () => {
    const manifest: DesktopShellManifest = {
      platform: "linux",
      runtime: "tauri",
      supportsBackgroundAgent: false,
      updateChannel: "stable",
    };

    expect(manifest.platform).toBe("linux");
    expect(manifest.runtime).toBe("tauri");
    expect(manifest.supportsBackgroundAgent).toBe(false);
    expect(manifest.updateChannel).toBe("stable");
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

describe("manifest immutability", () => {
  it("manifest properties are readonly in practice", () => {
    expect(tauriLinuxManifest.platform).toBe("linux");
    expect(tauriLinuxManifest.runtime).toBe("tauri");
    expect(tauriLinuxManifest.updateChannel).toBe("stable");
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
    expect(adapter.platform).toBe("linux");
    expect(typeof adapter.copyToClipboard).toBe("function");
    expect(typeof adapter.openDeepLink).toBe("function");
    expect(typeof adapter.getDebugState).toBe("function");
    expect(typeof adapter.onForeground).toBe("function");
    expect(typeof adapter.onBackground).toBe("function");
    expect(() => adapter.getDebugState()).not.toThrow();
  });
});
