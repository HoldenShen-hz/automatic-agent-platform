import { describe, expect, it } from "vitest";

import {
  electronMainBaseline,
  electronBridgeCapabilities,
  isShellCommandAllowed,
} from "../../../../../apps/electron-win/src/main";

describe("electronMainBaseline", () => {
  it("keeps the hardened browser security baseline enabled", () => {
    expect(electronMainBaseline.security).toEqual({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    });
  });

  it("does not expose arbitrary shell execution IPC channels", () => {
    expect(electronMainBaseline.channels).toContain("shell:openExternal");
    expect(electronMainBaseline.channels).not.toContain("shell:run");
    expect(electronMainBaseline.channels).not.toContain("shell:spawn");
  });

  it("does not expose raw file read/write IPC channels", () => {
    expect(electronMainBaseline.channels).not.toContain("files:read");
    expect(electronMainBaseline.channels).not.toContain("files:write");
  });
});

describe("electronBridgeCapabilities", () => {
  it("marks secure-store, deep-link and privacy capabilities as available", () => {
    expect(electronBridgeCapabilities.secureStore).toBe(true);
    expect(electronBridgeCapabilities.deepLink).toBe(true);
    expect(electronBridgeCapabilities.analyticsConsent).toBe(true);
    expect(electronBridgeCapabilities.screenSecurity).toBe(true);
    expect(electronBridgeCapabilities.lifecycle).toBe(true);
  });

  it("does not advertise removed shell/process bridge capabilities", () => {
    expect(electronBridgeCapabilities.shell).toBe(false);
    expect(electronBridgeCapabilities.process).toBe(false);
  });
});

describe("isShellCommandAllowed", () => {
  it("only allows the predefined diagnostic commands", () => {
    expect(isShellCommandAllowed("status")).toBe(true);
    expect(isShellCommandAllowed("health")).toBe(true);
    expect(isShellCommandAllowed("version")).toBe(true);
    expect(isShellCommandAllowed("powershell -Command whoami")).toBe(false);
  });
});
