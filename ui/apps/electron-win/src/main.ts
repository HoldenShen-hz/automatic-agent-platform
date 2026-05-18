import { app, BrowserWindow, globalShortcut, Notification, shell, type BrowserWindow as BrowserWindowHandle } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const rendererHtmlPath = join(currentDir, "../dist/index.html");
const preloadScriptPath = join(currentDir, "preload.js");
const ALLOWED_SHELL_COMMANDS = new Set(["status", "health", "version"]);

type FactoryLike<TValue, TArgs extends readonly unknown[]> = {
  new(...args: TArgs): TValue;
  (...args: TArgs): TValue;
};

function constructOrCall<TValue, TArgs extends readonly unknown[]>(
  factory: FactoryLike<TValue, TArgs>,
  ...args: TArgs
): TValue {
  if ("mock" in factory) {
    return factory(...args);
  }
  try {
    return new factory(...args);
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("is not a constructor")) {
      return factory(...args);
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
    "shell:openExternal",
    "window:minimize",
    "window:maximize",
    "window:open",
    "deep-link:open",
    "secure-store:read",
    "secure-store:write",
    "secure-store:delete",
    "privacy:getAnalyticsConsent",
    "privacy:setAnalyticsConsent",
    "privacy:enableScreenSecurity",
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

export function createMainWindow(): BrowserWindowHandle {
  const mainWindow = constructOrCall(BrowserWindow, createBrowserWindowOptions());
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

export function openSecondaryWindow(routePath: string): BrowserWindowHandle {
  const secondaryWindow = constructOrCall(BrowserWindow, createBrowserWindowOptions());
  void secondaryWindow.loadFile(rendererHtmlPath, { hash: routePath });
  return secondaryWindow;
}

export function registerGlobalShortcuts(mainWindow?: BrowserWindowHandle): void {
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
