import * as electron from "electron";
import type { BrowserWindow as BrowserWindowHandle } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const { app, BrowserWindow, globalShortcut, Notification, shell } = electron;

const currentDir = dirname(fileURLToPath(import.meta.url));
const rendererHtmlPath = join(currentDir, "../dist/index.html");
const preloadScriptPath = join(currentDir, "preload.js");
const ALLOWED_SHELL_COMMANDS = new Set(["status", "health", "version"]);

type Constructable<TValue, TArgs extends readonly unknown[]> = new(...args: TArgs) => TValue;
type CallableFactory<TValue, TArgs extends readonly unknown[]> = (...args: TArgs) => TValue;

function constructOrCall<TValue, TArgs extends readonly unknown[]>(
  factory: Constructable<TValue, TArgs> | CallableFactory<TValue, TArgs>,
  ...args: TArgs
): TValue {
  const callableFactory = factory as CallableFactory<TValue, TArgs>;
  if ("mock" in factory) {
    return callableFactory(...args);
  }
  try {
    return new (factory as Constructable<TValue, TArgs>)(...args);
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("is not a constructor")) {
      return callableFactory(...args);
    }
    throw error;
  }
}

export const electronGlobalShortcuts = [
  "CommandOrControl+K",
  "CommandOrControl+N",
  "Shift+CommandOrControl+D",
] as const;

export const electronMainBaseline = {
  window: {
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
  },
  security: {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  },
  channels: [
    { name: "shell:openExternal", tier: "restricted", permission: "external-link:open" },
    { name: "window:minimize", tier: "trusted-ui", permission: "window:control" },
    { name: "window:maximize", tier: "trusted-ui", permission: "window:control" },
    { name: "window:open", tier: "trusted-ui", permission: "window:spawn" },
    { name: "deep-link:open", tier: "trusted-ui", permission: "deep-link:open" },
    { name: "secure-store:read", tier: "restricted", permission: "secure-store:read" },
    { name: "secure-store:write", tier: "restricted", permission: "secure-store:write" },
    { name: "secure-store:delete", tier: "restricted", permission: "secure-store:delete" },
    { name: "privacy:getAnalyticsConsent", tier: "trusted-ui", permission: "privacy:read" },
    { name: "privacy:setAnalyticsConsent", tier: "trusted-ui", permission: "privacy:write" },
    { name: "privacy:enableScreenSecurity", tier: "restricted", permission: "privacy:screen-security" },
  ] as const,
};

export const electronBridgeCapabilities = {
  secureStore: true,
  filesystem: true,
  shell: false,
  deepLink: true,
  process: false,
  analyticsConsent: true,
  screenSecurity: true,
  lifecycle: true,
} as const;

function createBrowserWindowOptions() {
  return {
    width: electronMainBaseline.window.width,
    height: electronMainBaseline.window.height,
    minWidth: electronMainBaseline.window.minWidth,
    minHeight: electronMainBaseline.window.minHeight,
    show: false,
    webPreferences: {
      preload: preloadScriptPath,
      contextIsolation: electronMainBaseline.security.contextIsolation,
      nodeIntegration: electronMainBaseline.security.nodeIntegration,
      sandbox: electronMainBaseline.security.sandbox,
    },
  };
}

export function isShellCommandAllowed(command: string): boolean {
  return ALLOWED_SHELL_COMMANDS.has(command.trim());
}

function reportWindowLoadFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`electron.window_load_failed: ${message}\n`);
}

function loadWindowFile(windowHandle: BrowserWindowHandle, hash?: string): void {
  const pendingLoad = hash == null
    ? windowHandle.loadFile(rendererHtmlPath)
    : windowHandle.loadFile(rendererHtmlPath, { hash });
  if (pendingLoad != null && typeof (pendingLoad as Promise<unknown>).catch === "function") {
    void (pendingLoad as Promise<unknown>).catch(reportWindowLoadFailure);
  }
}

export function createMainWindow(): BrowserWindowHandle {
  const mainWindow = constructOrCall(BrowserWindow, createBrowserWindowOptions());
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  loadWindowFile(mainWindow);
  return mainWindow;
}

export function openSecondaryWindow(routePath: string): BrowserWindowHandle {
  const secondaryWindow = constructOrCall(BrowserWindow, createBrowserWindowOptions());
  loadWindowFile(secondaryWindow, routePath);
  return secondaryWindow;
}

export function registerGlobalShortcuts(mainWindow?: BrowserWindowHandle): void {
  globalShortcut.register("CommandOrControl+K", () => {
    mainWindow?.webContents.send("command-palette:open");
  });
  globalShortcut.register("CommandOrControl+N", () => {
    openSecondaryWindow("/shared/settings");
  });
  globalShortcut.register("Shift+CommandOrControl+D", () => {
    showPlatformNotification("Diagnostics", "Desktop diagnostics shortcut triggered");
  });
}

export function configureWindowsDesktopIntegrations(): void {
  app.setUserTasks([
    {
      program: process.execPath,
      arguments: "--open-dashboard",
      title: "Open Dashboard",
      description: "Jump directly into the operations dashboard",
      iconPath: process.execPath,
      iconIndex: 0,
    },
    {
      program: process.execPath,
      arguments: "--open-command-palette",
      title: "Open Command Palette",
      description: "Open the command palette from the taskbar",
      iconPath: process.execPath,
      iconIndex: 0,
    },
  ]);
}

export function showPlatformNotification(title: string, body: string): boolean {
  if (!Notification.isSupported()) {
    return false;
  }
  const notification = constructOrCall(Notification, { title, body });
  notification.show();
  return true;
}

export async function bootstrapElectronShell(): Promise<void> {
  await app.whenReady();
  const mainWindow = createMainWindow();
  registerGlobalShortcuts(mainWindow);
  configureWindowsDesktopIntegrations();
}
