import { app, BrowserWindow, Notification, globalShortcut, shell } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface ElectronIpcChannel {
  readonly name: string;
  readonly tier: "external-navigation" | "window-management" | "secure-storage" | "privacy";
  readonly permission: string;
}

const currentDir = dirname(fileURLToPath(import.meta.url));
const rendererHtmlPath = join(currentDir, "../dist/index.html");
const preloadScriptPath = join(currentDir, "preload.js");
const ALLOWED_SHELL_COMMANDS = new Set(["status", "health", "version"]);

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
    { name: "shell:openExternal", tier: "external-navigation", permission: "external-link" },
    { name: "window:minimize", tier: "window-management", permission: "window-control" },
    { name: "window:maximize", tier: "window-management", permission: "window-control" },
    { name: "window:open", tier: "window-management", permission: "window-control" },
    { name: "deep-link:open", tier: "external-navigation", permission: "deep-link" },
    { name: "secure-store:read", tier: "secure-storage", permission: "credential-read" },
    { name: "secure-store:write", tier: "secure-storage", permission: "credential-write" },
    { name: "secure-store:delete", tier: "secure-storage", permission: "credential-delete" },
    { name: "privacy:getAnalyticsConsent", tier: "privacy", permission: "analytics-consent-read" },
    { name: "privacy:setAnalyticsConsent", tier: "privacy", permission: "analytics-consent-write" },
    { name: "privacy:enableScreenSecurity", tier: "privacy", permission: "screen-protection" },
  ] as const satisfies readonly ElectronIpcChannel[],
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

export function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow(createBrowserWindowOptions());
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  void mainWindow.loadFile(rendererHtmlPath);
  return mainWindow;
}

export function openSecondaryWindow(routePath: string): BrowserWindow {
  const secondaryWindow = new BrowserWindow(createBrowserWindowOptions());
  void secondaryWindow.loadFile(rendererHtmlPath, { hash: routePath });
  return secondaryWindow;
}

export function registerGlobalShortcuts(mainWindow?: BrowserWindow): void {
  globalShortcut.register("CommandOrControl+K", () => {
    mainWindow?.webContents.send("command-palette:open");
  });
  globalShortcut.register("CommandOrControl+N", () => {
    void openSecondaryWindow("/shared/settings");
  });
  globalShortcut.register("Shift+CommandOrControl+D", () => {
    void showPlatformNotification("Diagnostics", "Desktop diagnostics shortcut triggered");
  });
}

export function configureWindowsDesktopIntegrations(): void {
  app.setUserTasks([
    {
      program: process.execPath,
      arguments: "--open-dashboard",
      title: "Open Dashboard",
      description: "Jump directly into the operations dashboard",
    },
    {
      program: process.execPath,
      arguments: "--open-command-palette",
      title: "Open Command Palette",
      description: "Open the command palette from the taskbar",
    },
  ]);
}

export function showPlatformNotification(title: string, body: string): boolean {
  if (!Notification.isSupported()) {
    return false;
  }
  const notification = new Notification({ title, body });
  notification.show();
  return true;
}

export async function bootstrapElectronShell(): Promise<void> {
  await app.whenReady();
  const mainWindow = createMainWindow();
  registerGlobalShortcuts(mainWindow);
  configureWindowsDesktopIntegrations();
}
