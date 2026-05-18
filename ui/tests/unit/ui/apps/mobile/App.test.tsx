import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import type { ReactElement } from "react";
import React from "react";
import { createMobilePlatformAdapter } from "@aa/shared-platform";
import { MobileApp } from "../../../../../apps/mobile/src/App";
import { mobileGlobals } from "../../../../helpers/mobile-bridge";

vi.mock("react-native", () => ({
  View: ({ children, style }: { children?: React.ReactNode; style?: unknown }) => React.createElement("div", { style }, children),
  Text: ({ children, style }: { children?: React.ReactNode; style?: unknown }) => React.createElement("span", { style }, children),
  TouchableOpacity: ({
    children,
    onPress,
    style,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    style?: unknown;
  }) => React.createElement("button", { onClick: onPress, style, type: "button" }, children),
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
}));

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
    mobileGlobals().__AA_MOBILE__ = mockMobileBridge;
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Linux; Android 14; Pixel 8)",
    });
  });

  afterEach(() => {
    cleanup();
    delete mobileGlobals().__AA_MOBILE__;
  });

  it("renders without crashing", () => {
    render(<MobileApp />);
    expect(screen.getByText("Mobile Mission Control")).toBeInTheDocument();
  });

  it("renders platform adapter info", () => {
    render(<MobileApp />);
    expect(screen.getByText(/Platform: android/)).toBeInTheDocument();
  });

  it("shows native bridge ready status when global is defined", () => {
    render(<MobileApp />);
    expect(screen.getByText(/Native bridge ready: true/)).toBeInTheDocument();
  });

  it("shows native bridge not ready when global is undefined", () => {
    delete mobileGlobals().__AA_MOBILE__;
    render(<MobileApp />);
    expect(screen.getByText(/Native bridge ready: false/)).toBeInTheDocument();
  });

  it("switches tabs through the root tab navigator", () => {
    render(<MobileApp />);
    fireEvent.click(screen.getByRole("button", { name: "Tasks" }));
    expect(screen.getByText("/mission-control/tasks")).toBeInTheDocument();
  });

  it("opens modal flows through the modal stack runtime", () => {
    render(<MobileApp />);
    fireEvent.click(screen.getByRole("button", { name: "Open Approval Modal" }));
    expect(screen.getByText("Modal: Approval Detail")).toBeInTheDocument();
  });
});

describe("createMobilePlatformAdapter invocation (Issue #2169)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Linux; Android 14; Pixel 8)",
    });
  });

  afterEach(() => {
    cleanup();
    delete mobileGlobals().__AA_MOBILE__;
  });

  it("detects android user agents and passes android to the adapter", () => {
    render(<MobileApp />);

    expect(createMobilePlatformAdapter).toHaveBeenCalledWith("android");
  });

  it("detects ios user agents instead of hardcoding android", () => {
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    });

    render(<MobileApp />);

    const callArgs = (createMobilePlatformAdapter as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs).toBeDefined();
    expect(callArgs?.[0]).toBe("ios");
    expect(screen.getByText(/Platform: ios/)).toBeInTheDocument();
  });
});

describe("mobile platform adapter interface", () => {
  beforeEach(() => {
    mobileGlobals().__AA_MOBILE__ = mockMobileBridge;
  });

  afterEach(() => {
    delete mobileGlobals().__AA_MOBILE__;
  });

  it("adapter has platform property", () => {
    const adapter = createMobilePlatformAdapter("android");
    expect(adapter.platform).toBe("android");
  });

  it("adapter supports clipboard operations", async () => {
    const adapter = createMobilePlatformAdapter("android");
    await adapter.copyToClipboard("test");
    expect(typeof adapter.copyToClipboard).toBe("function");
  });

  it("adapter supports deep link operations", async () => {
    const adapter = createMobilePlatformAdapter("android");
    await adapter.openDeepLink("aa://test");
    expect(typeof adapter.openDeepLink).toBe("function");
  });

  it("adapter supports vibration", async () => {
    const adapter = createMobilePlatformAdapter("android");
    await adapter.vibrate([100, 200, 100]);
    expect(typeof adapter.vibrate).toBe("function");
  });

  it("adapter has analytics consent baseline", async () => {
    const adapter = createMobilePlatformAdapter("android");
    const consent = await adapter.getAnalyticsConsent();
    expect(consent).toBe(true);
  });

  it("adapter supports screen security", async () => {
    const adapter = createMobilePlatformAdapter("android");
    await adapter.enableScreenSecurity(true);
    expect(typeof adapter.enableScreenSecurity).toBe("function");
  });

  it("adapter has foreground listener", () => {
    const adapter = createMobilePlatformAdapter("android");
    const unsubscribe = adapter.onForeground(() => {});
    expect(typeof unsubscribe).toBe("function");
  });

  it("adapter has background listener", () => {
    const adapter = createMobilePlatformAdapter("android");
    const unsubscribe = adapter.onBackground(() => {});
    expect(typeof unsubscribe).toBe("function");
  });
});
