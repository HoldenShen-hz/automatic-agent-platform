import * as electron from "electron";
import type { BrowserWindow as BrowserWindowHandle } from "electron";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  ipcMain,
  Notification,
  session,
  shell,
} = electron;

const currentDir = dirname(fileURLToPath(import.meta.url));
const rendererHtmlPath = join(currentDir, "index.html");
const webAppHtmlPath = join(currentDir, "../../web/dist/index.html");
const preloadScriptPath = join(currentDir, "preload.js");
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["https:", "mailto:"]);
const secureStore = new Map();
let analyticsConsent = false;

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

function isAllowedExternalUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (ALLOWED_EXTERNAL_PROTOCOLS.has(url.protocol)) {
      return true;
    }
    return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

function reportWindowLoadFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`electron.window_load_failed: ${message}\n`);
}

function resolveWindowHtmlPath(): string {
  return existsSync(webAppHtmlPath) ? webAppHtmlPath : rendererHtmlPath;
}

function loadWindowFile(windowHandle: BrowserWindowHandle, hash?: string): void {
  const htmlPath = resolveWindowHtmlPath();
  const pendingLoad = hash == null
    ? windowHandle.loadFile(htmlPath)
    : windowHandle.loadFile(htmlPath, { hash });
  if (pendingLoad != null && typeof (pendingLoad as Promise<unknown>).catch === "function") {
    void (pendingLoad as Promise<unknown>).catch(reportWindowLoadFailure);
  }
}

function applyElectronCsp(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = details.responseHeaders ?? {};
    headers["Content-Security-Policy"] = [
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; worker-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; report-uri /csp-report",
    ];
    callback({ responseHeaders: headers });
  });
}

function protectNavigation(windowHandle: BrowserWindowHandle): void {
  windowHandle.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });
  windowHandle.webContents.on("will-navigate", (event, url) => {
    const currentUrl = windowHandle.webContents.getURL();
    if (url === currentUrl || url.startsWith("file://")) {
      return;
    }
    event.preventDefault();
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url);
    }
  });
}

export function createMainWindow(): BrowserWindowHandle {
  const mainWindow = constructOrCall(BrowserWindow, createBrowserWindowOptions());
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });
  protectNavigation(mainWindow);
  loadWindowFile(mainWindow);
  return mainWindow;
}

export function openSecondaryWindow(routePath: string): BrowserWindowHandle {
  const secondaryWindow = constructOrCall(BrowserWindow, createBrowserWindowOptions());
  loadWindowFile(secondaryWindow, routePath);
  return secondaryWindow;
}

export function registerGlobalShortcuts(mainWindow?: BrowserWindowHandle): void {
  registerGlobalShortcut("CommandOrControl+K", () => {
    mainWindow?.webContents.send("command-palette:open");
  });
  registerGlobalShortcut("CommandOrControl+N", () => {
    openSecondaryWindow("/shared/settings");
  });
  registerGlobalShortcut("Shift+CommandOrControl+D", () => {
    showPlatformNotification("Diagnostics", "Desktop diagnostics shortcut triggered");
  });
}

function registerGlobalShortcut(accelerator: string, action: () => void): void {
  const registered = globalShortcut.register(accelerator, action);
  if (registered === false) {
    reportWindowLoadFailure(new Error(`electron.global_shortcut_registration_failed:${accelerator}`));
  }
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

function getFocusedWindow(mainWindow: BrowserWindowHandle): BrowserWindowHandle {
  return BrowserWindow.getFocusedWindow() ?? mainWindow;
}

export function registerIpcHandlers(mainWindow: BrowserWindowHandle): void {
  const currentWindow = () => getFocusedWindow(mainWindow);

  ipcMain.handle("shell:openExternal", async (_event, url: string) => {
    if (!isAllowedExternalUrl(url)) {
      throw new Error("electron.shell.external_url_denied");
    }
    await shell.openExternal(url);
  });
  ipcMain.handle("window:minimize", async () => {
    currentWindow().minimize();
  });
  ipcMain.handle("window:maximize", async () => {
    const windowHandle = currentWindow();
    if (windowHandle.isMaximized()) {
      windowHandle.unmaximize();
      return;
    }
    windowHandle.maximize();
  });
  ipcMain.handle("window:open", async (_event, path: string) => {
    openSecondaryWindow(path);
  });
  ipcMain.handle("deep-link:open", async (_event, url: string) => {
    if (!isAllowedExternalUrl(url)) {
      throw new Error("electron.deep_link_denied");
    }
    await shell.openExternal(url);
  });
  ipcMain.handle("secure-store:read", async (_event, key: string) => secureStore.get(key) ?? null);
  ipcMain.handle("secure-store:write", async (_event, key: string, value: string) => {
    secureStore.set(key, value);
  });
  ipcMain.handle("secure-store:delete", async (_event, key: string) => {
    secureStore.delete(key);
  });
  ipcMain.handle("privacy:getAnalyticsConsent", async () => analyticsConsent);
  ipcMain.handle("privacy:setAnalyticsConsent", async (_event, enabled: boolean) => {
    analyticsConsent = enabled;
  });
  ipcMain.handle("privacy:enableScreenSecurity", async (_event, enabled: boolean) => {
    currentWindow().setContentProtection(enabled);
  });
  ipcMain.handle("clipboard:writeText", async (_event, value: string) => {
    clipboard.writeText(value);
  });
}

async function wireAutoUpdater(): Promise<void> {
  try {
    const updaterModule = await import("electron-updater");
    await updaterModule.autoUpdater.checkForUpdatesAndNotify();
  } catch (error) {
    reportWindowLoadFailure(error);
  }
}

export async function bootstrapElectronShell(): Promise<void> {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  await app.whenReady();
  applyElectronCsp();
  const mainWindow = createMainWindow();
  registerIpcHandlers(mainWindow);
  registerGlobalShortcuts(mainWindow);
  configureWindowsDesktopIntegrations();
  await wireAutoUpdater();

  app.on("second-instance", () => {
    const windowHandle = getFocusedWindow(mainWindow);
    if (!windowHandle.isDestroyed()) {
      windowHandle.show();
      windowHandle.focus();
    }
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

const isDirectElectronEntrypoint = process.argv[1] != null && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectElectronEntrypoint) {
  void bootstrapElectronShell();
}
