import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    on: vi.fn(),
    whenReady: vi.fn(async () => undefined),
    quit: vi.fn(),
    setUserTasks: vi.fn(),
  },
  BrowserWindow: Object.assign(
    vi.fn(() => ({
      once: vi.fn(),
      show: vi.fn(),
      on: vi.fn(),
      loadFile: vi.fn(),
      minimize: vi.fn(),
      isMaximized: vi.fn(() => false),
      unmaximize: vi.fn(),
      maximize: vi.fn(),
      setContentProtection: vi.fn(),
      webContents: {
        setWindowOpenHandler: vi.fn(),
        send: vi.fn(),
      },
    })),
    {
      getAllWindows: vi.fn(() => []),
    },
  ),
  shell: {
    openExternal: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
  },
  globalShortcut: {
    register: vi.fn(),
    unregisterAll: vi.fn(),
  },
  Notification: Object.assign(
    vi.fn(() => ({
      show: vi.fn(),
    })),
    {
      isSupported: vi.fn(() => true),
    },
  ),
  Menu: {
    buildFromTemplate: vi.fn(() => ({})),
  },
  Tray: vi.fn(() => ({
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    on: vi.fn(),
    destroy: vi.fn(),
  })),
  nativeImage: {
    createEmpty: vi.fn(() => ({})),
  },
}));

import {
  configureWindowsDesktopIntegrations,
  createMainWindow,
  electronGlobalShortcuts,
  electronMainBaseline,
  electronBridgeCapabilities,
  isShellCommandAllowed,
  openSecondaryWindow,
  registerGlobalShortcuts,
  showPlatformNotification,
} from "../../../../../apps/electron-win/src/main";
import { app, globalShortcut, Notification } from "electron";

describe("electronMainBaseline", () => {
  it("keeps the hardened browser security baseline enabled", () => {
    expect(electronMainBaseline.security).toEqual({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    });
  });

  it("does not expose arbitrary shell execution IPC channels", () => {
    expect(electronMainBaseline.channels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "shell:openExternal",
          tier: "external-navigation",
          permission: "external-link",
        }),
      ]),
    );
    expect(electronMainBaseline.channels.find((channel) => channel.name === "shell:run")).toBeUndefined();
    expect(electronMainBaseline.channels.find((channel) => channel.name === "shell:spawn")).toBeUndefined();
  });

  it("does not expose raw file read/write IPC channels", () => {
    expect(electronMainBaseline.channels.find((channel) => channel.name === "files:read")).toBeUndefined();
    expect(electronMainBaseline.channels.find((channel) => channel.name === "files:write")).toBeUndefined();
  });

  it("assigns secure-storage and navigation channels to different trust tiers", () => {
    const secureStoreRead = electronMainBaseline.channels.find((channel) => channel.name === "secure-store:read");
    const externalShell = electronMainBaseline.channels.find((channel) => channel.name === "shell:openExternal");

    expect(secureStoreRead?.tier).toBe("secure-storage");
    expect(externalShell?.tier).toBe("external-navigation");
    expect(secureStoreRead?.permission).toBe("credential-read");
    expect(externalShell?.permission).toBe("external-link");
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

describe("createMainWindow", () => {
  it("loads the packaged electron html shell and keeps preload isolated", () => {
    const windowHandle = createMainWindow();

    expect(windowHandle.loadFile).toHaveBeenCalledWith(expect.stringContaining("index.html"));
  });
});

describe("desktop integrations", () => {
  it("registers the documented global shortcuts", () => {
    registerGlobalShortcuts();

    expect(globalShortcut.register).toHaveBeenCalledTimes(electronGlobalShortcuts.length);
    expect(globalShortcut.register).toHaveBeenCalledWith("CommandOrControl+K", expect.any(Function));
    expect(globalShortcut.register).toHaveBeenCalledWith("CommandOrControl+N", expect.any(Function));
    expect(globalShortcut.register).toHaveBeenCalledWith("Shift+CommandOrControl+D", expect.any(Function));
  });

  it("configures Windows jump-list tasks for dashboard and command palette entrypoints", () => {
    configureWindowsDesktopIntegrations();

    expect(app.setUserTasks).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ title: "Open Dashboard" }),
        expect.objectContaining({ title: "Open Command Palette" }),
      ]),
    );
  });

  it("shows a platform notification when desktop notifications are supported", () => {
    expect(showPlatformNotification("Diagnostics", "Desktop diagnostics shortcut triggered")).toBe(true);
    expect(Notification).toHaveBeenCalledWith({
      title: "Diagnostics",
      body: "Desktop diagnostics shortcut triggered",
    });
  });

  it("opens a secondary window for multi-window desktop flows", () => {
    const windowHandle = openSecondaryWindow("/shared/settings");

    expect(windowHandle.loadFile).toHaveBeenCalledWith(expect.stringContaining("index.html"), {
      hash: "/shared/settings",
    });
  });
});
