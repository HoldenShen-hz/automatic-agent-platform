import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    on: vi.fn(),
    whenReady: vi.fn(async () => undefined),
    quit: vi.fn(),
    setUserTasks: vi.fn(),
    requestSingleInstanceLock: vi.fn(() => true),
  },
  clipboard: {
    writeText: vi.fn(),
  },
  BrowserWindow: Object.assign(
    vi.fn(() => ({
      once: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
      isDestroyed: vi.fn(() => false),
      on: vi.fn(),
      loadFile: vi.fn(),
      minimize: vi.fn(),
      isMaximized: vi.fn(() => false),
      unmaximize: vi.fn(),
      maximize: vi.fn(),
      setContentProtection: vi.fn(),
      webContents: {
        setWindowOpenHandler: vi.fn(),
        on: vi.fn(),
        getURL: vi.fn(() => "file:///index.html"),
        send: vi.fn(),
      },
    })),
    {
      getAllWindows: vi.fn(() => []),
      getFocusedWindow: vi.fn(() => null),
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
  session: {
    defaultSession: {
      webRequest: {
        onHeadersReceived: vi.fn(),
      },
    },
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
  openSecondaryWindow,
  registerGlobalShortcuts,
  registerIpcHandlers,
  showPlatformNotification,
} from "../../../../../apps/electron-win/src/main";
import { app, globalShortcut, ipcMain, Notification, shell } from "electron";

describe("electronMainBaseline", () => {
  const channelNames = electronMainBaseline.channels.map((channel) => channel.name);

  it("keeps the hardened browser security baseline enabled", () => {
    expect(electronMainBaseline.security).toEqual({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    });
  });

  it("does not expose arbitrary shell execution IPC channels", () => {
    expect(channelNames).toContain("shell:openExternal");
    expect(channelNames).not.toContain("shell:run");
    expect(channelNames).not.toContain("shell:spawn");
  });

  it("does not expose raw file read/write IPC channels", () => {
    expect(channelNames).not.toContain("files:read");
    expect(channelNames).not.toContain("files:write");
  });

  it("describes channels with tier and permission metadata", () => {
    expect(electronMainBaseline.channels).toContainEqual({
      name: "secure-store:read",
      tier: "restricted",
      permission: "secure-store:read",
    });
    expect(electronMainBaseline.channels).toContainEqual({
      name: "shell:openExternal",
      tier: "restricted",
      permission: "external-link:open",
    });
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

describe("createMainWindow", () => {
  it("loads the packaged electron html shell and keeps preload isolated", () => {
    const windowHandle = createMainWindow();

    expect(windowHandle.loadFile).toHaveBeenCalledWith(expect.stringContaining("index.html"));
  });

  it("denies arbitrary external window opens and only forwards allowlisted URLs", async () => {
    const windowHandle = createMainWindow();
    const openHandler = vi.mocked(windowHandle.webContents.setWindowOpenHandler).mock.calls[0]?.[0];

    expect(openHandler?.({ url: "javascript:alert(1)" } as never)).toEqual({ action: "deny" });
    expect(shell.openExternal).not.toHaveBeenCalled();

    expect(openHandler?.({ url: "https://example.com" } as never)).toEqual({ action: "deny" });
    expect(shell.openExternal).toHaveBeenCalledWith("https://example.com");
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

  it("registers the preload-exposed IPC handlers", () => {
    const mainWindow = createMainWindow();
    registerIpcHandlers(mainWindow);

    expect(ipcMain.handle).toHaveBeenCalledWith("shell:openExternal", expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith("window:minimize", expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith("window:maximize", expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith("window:open", expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith("privacy:getAnalyticsConsent", expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith("privacy:setAnalyticsConsent", expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith("privacy:enableScreenSecurity", expect.any(Function));
  });
});
