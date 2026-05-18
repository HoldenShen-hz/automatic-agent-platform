// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

import { MobileApp } from "../../apps/mobile/src/App";
import { mobileGlobals } from "../helpers/mobile-bridge";

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

describe("accessibility regression baseline", () => {
  afterEach(() => {
    delete mobileGlobals().__AA_MOBILE__;
  });

  it("keeps native shell controls reachable by accessible names", () => {
    mobileGlobals().__AA_MOBILE__ = mockMobileBridge;
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    });

    render(<MobileApp />);

    expect(screen.getByRole("button", { name: "Tasks" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Approval Modal" })).toBeTruthy();
  });

  it("keeps assistive-tech checklist and CI accessibility workflow wired", () => {
    const checklist = readFileSync(resolve(process.cwd(), "tests/a11y/assistive-technology-checklist.md"), "utf8");
    const workflow = readFileSync(resolve(process.cwd(), "..", ".github", "workflows", "ui-quality.yml"), "utf8");

    expect(checklist).toContain("TalkBack or VoiceOver");
    expect(checklist).toContain("android");
    expect(checklist).toContain("ios");
    expect(workflow).toContain("npm run test:a11y");
  });
});
