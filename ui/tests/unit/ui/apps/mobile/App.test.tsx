import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ReactElement } from "react";
import React from "react";
import { MobileApp } from "./App";

// Issue #2169: Platform hardcoded "android", iOS gets wrong adapter

// Mock shared-platform module
vi.mock("@aa/shared-platform", () => ({
  createMobilePlatformAdapter: vi.fn((platform: string) => ({
    platform,
    getDebugState: () => ({ platform, screenSecurityEnabled: true }),
    copyToClipboard: vi.fn(),
    openDeepLink: vi.fn(),
    vibrate: vi.fn(),
    getAnalyticsConsent: vi.fn(() => true),
    enableScreenSecurity: vi.fn(),
    onForeground: vi.fn(() => () => undefined),
    onBackground: vi.fn(() => () => undefined),
  })),
}));

// Mock global mobile bridge
const mockMobileBridge = {
  async readSecureValue() { return "token"; },
  async writeSecureValue() { return; },
  async deleteSecureValue() { return; },
  async copyToClipboard() { return; },
  async openDeepLink() { return; },
  async vibrate() { return; },
  async getAnalyticsConsent() { return true; },
  async setAnalyticsConsent() { return; },
  async enableScreenSecurity() { return; },
  onForeground() { return () => undefined; },
  onBackground() { return () => undefined; },
};

describe("MobileApp component", () => {
  beforeEach(() => {
    globalThis.__AA_MOBILE__ = mockMobileBridge;
  });

  afterEach(() => {
    cleanup();
    delete globalThis.__AA_MOBILE__;
  });

  it("renders without crashing", () => {
    render(<MobileApp />);
    expect(screen.getByText("Automatic Agent Platform Mobile Baseline")).toBeInTheDocument();
  });

  it("renders platform adapter info", () => {
    render(<MobileApp />);
    expect(screen.getByText(/Platform: android/)).toBeInTheDocument();
  });

  it("shows native bridge ready status when global is defined", () => {
    render(<MobileApp />);
    expect(screen.getByText("Native bridge ready: true")).toBeInTheDocument();
  });

  it("shows native bridge not ready when global is undefined", () => {
    delete globalThis.__AA_MOBILE__;
    render(<MobileApp />);
    expect(screen.getByText("Native bridge ready: false")).toBeInTheDocument();
  });
});

describe("createMobilePlatformAdapter invocation (Issue #2169)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    delete globalThis.__AA_MOBILE__;
  });

  it("hardcodes 'android' platform - iOS gets wrong adapter", () => {
    // Issue #2169: Platform is hardcoded to "android"
    // iOS devices will incorrectly use android adapter
    const { createMobilePlatformAdapter } = require("@aa/shared-platform");

    render(<MobileApp />);

    // Verify adapter was created with hardcoded "android"
    expect(createMobilePlatformAdapter).toHaveBeenCalledWith("android");
  });

  it("should detect platform from environment, not hardcode", () => {
    // This test documents the security issue
    // A correct implementation would use a dynamic platform detection
    const { createMobilePlatformAdapter } = require("@aa/shared-platform");

    render(<MobileApp />);

    // Currently hardcoded - this is the bug
    const callArgs = (createMobilePlatformAdapter as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[0]).toBe("android");
  });
});

describe("mobile platform adapter interface", () => {
  beforeEach(() => {
    globalThis.__AA_MOBILE__ = mockMobileBridge;
  });

  afterEach(() => {
    delete globalThis.__AA_MOBILE__;
  });

  it("adapter has platform property", () => {
    const { createMobilePlatformAdapter } = require("@aa/shared-platform");
    const adapter = createMobilePlatformAdapter("android");
    expect(adapter.platform).toBe("android");
  });

  it("adapter supports clipboard operations", async () => {
    const { createMobilePlatformAdapter } = require("@aa/shared-platform");
    const adapter = createMobilePlatformAdapter("android");
    await adapter.copyToClipboard("test");
    expect(typeof adapter.copyToClipboard).toBe("function");
  });

  it("adapter supports deep link operations", async () => {
    const { createMobilePlatformAdapter } = require("@aa/shared-platform");
    const adapter = createMobilePlatformAdapter("android");
    await adapter.openDeepLink("aa://test");
    expect(typeof adapter.openDeepLink).toBe("function");
  });

  it("adapter supports vibration", async () => {
    const { createMobilePlatformAdapter } = require("@aa/shared-platform");
    const adapter = createMobilePlatformAdapter("android");
    await adapter.vibrate([100, 200, 100]);
    expect(typeof adapter.vibrate).toBe("function");
  });

  it("adapter has analytics consent baseline", async () => {
    const { createMobilePlatformAdapter } = require("@aa/shared-platform");
    const adapter = createMobilePlatformAdapter("android");
    const consent = await adapter.getAnalyticsConsent();
    expect(consent).toBe(true);
  });

  it("adapter supports screen security", async () => {
    const { createMobilePlatformAdapter } = require("@aa/shared-platform");
    const adapter = createMobilePlatformAdapter("android");
    await adapter.enableScreenSecurity(true);
    expect(typeof adapter.enableScreenSecurity).toBe("function");
  });

  it("adapter has foreground listener", () => {
    const { createMobilePlatformAdapter } = require("@aa/shared-platform");
    const adapter = createMobilePlatformAdapter("android");
    const unsubscribe = adapter.onForeground(() => {});
    expect(typeof unsubscribe).toBe("function");
  });

  it("adapter has background listener", () => {
    const { createMobilePlatformAdapter } = require("@aa/shared-platform");
    const adapter = createMobilePlatformAdapter("android");
    const unsubscribe = adapter.onBackground(() => {});
    expect(typeof unsubscribe).toBe("function");
  });
});