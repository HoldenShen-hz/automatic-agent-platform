import { app, BrowserWindow, shell, ipcMain, Menu, Tray, nativeImage, globalShortcut, Notification } from "electron";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const currentDir = dirname(fileURLToPath(import.meta.url));
const appRootDir = join(currentDir, "..");

// §R8-55: Auto-update mechanism via electron-updater - only initialize when not in dev
function resolveAutoUpdater(): { checkForUpdatesAndNotify(): void } | null {
  // Skip auto-updater in development or if ELECTRON_DISABLE_AUTOUPDATE is set
  if (process.env.NODE_ENV === "development" || process.env.ELECTRON_DISABLE_AUTOUPDATE) {
    return null;
  }
  try {
    return (require("electron-updater") as { autoUpdater?: { checkForUpdatesAndNotify(): void } }).autoUpdater ?? null;
  } catch {
    return null;
  }
}

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
    { name: "window:minimize", tier: "window-control", permission: "window-state" },
    { name: "window:maximize", tier: "window-control", permission: "window-state" },
    { name: "window:open", tier: "external-navigation", permission: "external-link" },
    { name: "deep-link:open", tier: "deep-link", permission: "deeplink" },
    { name: "secure-store:read", tier: "secure-storage", permission: "credential-read" },
    { name: "secure-store:write", tier: "secure-storage", permission: "credential-write" },
    { name: "secure-store:delete", tier: "secure-storage", permission: "credential-delete" },
    { name: "privacy:getAnalyticsConsent", tier: "privacy", permission: "analytics-consent-read" },
    { name: "privacy:setAnalyticsConsent", tier: "privacy", permission: "analytics-consent-write" },
    { name: "privacy:enableScreenSecurity", tier: "privacy", permission: "screen-protection" },
  ] as const,
};

// Shell command allowlist - only predefined safe commands permitted via shell:run
const ALLOWED_SHELL_COMMANDS = new Set(["status", "health", "version"]);

export function isShellCommandAllowed(command: string): boolean {
  return ALLOWED_SHELL_COMMANDS.has(command);
}

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

// ─────────────────────────────────────────────────────────────────────────────
// R17-43: Electron App Initialization with BrowserWindow
// ─────────────────────────────────────────────────────────────────────────────

// R17-43: Export BrowserWindow instance for external access
export let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
const secondaryWindows = new Set<BrowserWindow>();

export const electronGlobalShortcuts = [
  { accelerator: "CommandOrControl+K", action: "command-palette" },
  { accelerator: "CommandOrControl+N", action: "new-window" },
  { accelerator: "Shift+CommandOrControl+D", action: "diagnostics" },
] as const;

interface WindowCreateOptions {
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  contextIsolation?: boolean;
  nodeIntegration?: boolean;
  sandbox?: boolean;
}

function createMainWindow(options: WindowCreateOptions = {}): BrowserWindow {
  const {
    width = electronMainBaseline.window.width,
    height = electronMainBaseline.window.height,
    minWidth = electronMainBaseline.window.minWidth,
    minHeight = electronMainBaseline.window.minHeight,
    contextIsolation = electronMainBaseline.security.contextIsolation,
    nodeIntegration = electronMainBaseline.security.nodeIntegration,
    sandbox = electronMainBaseline.security.sandbox,
  } = options;

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth,
    minHeight,
    webPreferences: {
      contextIsolation,
      nodeIntegration,
      sandbox,
      preload: join(currentDir, "preload.js"),
    },
    show: false, // Don't show until ready-to-show
    backgroundColor: "#ffffff",
    titleBarStyle: "default",
    visualEffectState: "active",
  });

  void mainWindow.loadFile(join(appRootDir, "index.html"));

  // Show window when ready to prevent visual flash
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // R17-43: Only allow predefined safe commands via shell:openExternal
    if (url.startsWith("https://") || url.startsWith("http://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Cleanup on close
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

export function openSecondaryWindow(routeHash = "/mission-control/dashboard"): BrowserWindow {
  const windowHandle = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      contextIsolation: electronMainBaseline.security.contextIsolation,
      nodeIntegration: electronMainBaseline.security.nodeIntegration,
      sandbox: electronMainBaseline.security.sandbox,
      preload: join(currentDir, "preload.js"),
    },
    show: false,
    backgroundColor: "#ffffff",
    titleBarStyle: "default",
    visualEffectState: "active",
  });

  secondaryWindows.add(windowHandle);
  void windowHandle.loadFile(join(appRootDir, "index.html"), { hash: routeHash });
  windowHandle.once("ready-to-show", () => {
    windowHandle.show();
  });
  windowHandle.on("closed", () => {
    secondaryWindows.delete(windowHandle);
  });
  return windowHandle;
}

function createTray(): Tray | null {
  // Create a simple tray icon (16x16 transparent image as placeholder)
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip("Agent Platform");

  const contextMenu = Menu.buildFromTemplate([
    { label: "Show", click: () => mainWindow?.show() },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("click", () => mainWindow?.show());

  return tray;
}

export function showPlatformNotification(title: string, body: string): boolean {
  if (typeof Notification.isSupported === "function" && Notification.isSupported() === false) {
    return false;
  }
  const notification = new Notification({ title, body });
  notification.show();
  return true;
}

export function configureWindowsDesktopIntegrations(): void {
  if (typeof app.setUserTasks === "function") {
    app.setUserTasks([
      {
        program: process.execPath,
        arguments: "--open-dashboard",
        iconPath: process.execPath,
        iconIndex: 0,
        title: "Open Dashboard",
        description: "Launch the main mission control dashboard",
      },
      {
        program: process.execPath,
        arguments: "--open-command-palette",
        iconPath: process.execPath,
        iconIndex: 0,
        title: "Open Command Palette",
        description: "Open the desktop command palette",
      },
    ]);
  }
}

export function registerGlobalShortcuts(): void {
  for (const shortcut of electronGlobalShortcuts) {
    globalShortcut.register(shortcut.accelerator, () => {
      if (shortcut.action === "command-palette") {
        mainWindow?.show();
        mainWindow?.webContents.send("desktop:shortcut", { action: "command-palette" });
        return;
      }
      if (shortcut.action === "new-window") {
        openSecondaryWindow("/mission-control/dashboard");
        return;
      }
      showPlatformNotification("Diagnostics", "Desktop diagnostics shortcut triggered");
    });
  }
}

function setupIpcHandlers(): void {
  // Window controls
  ipcMain.handle("window:minimize", () => {
    mainWindow?.minimize();
  });

  ipcMain.handle("window:maximize", () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle("window:open", (_event, url: string) => {
    shell.openExternal(url);
  });

  // Secure store handlers
  ipcMain.handle("secure-store:read", async (_event, key: string) => {
    // R17-43: Implement secure store read - placeholder implementation
    return null;
  });

  ipcMain.handle("secure-store:write", async (_event, key: string, value: string) => {
    // R17-43: Implement secure store write - placeholder implementation
    return true;
  });

  ipcMain.handle("secure-store:delete", async (_event, key: string) => {
    // R17-43: Implement secure store delete - placeholder implementation
    return true;
  });

  // Privacy handlers
  ipcMain.handle("privacy:getAnalyticsConsent", () => {
    return false;
  });

  ipcMain.handle("privacy:setAnalyticsConsent", (_event, consent: boolean) => {
    // R17-43: Implement analytics consent storage
    return true;
  });

  ipcMain.handle("privacy:enableScreenSecurity", () => {
    // R17-43: Prevent screen capture for security
    if (mainWindow) {
      mainWindow.setContentProtection(true);
    }
    return true;
  });
}

async function initializeApp(): Promise<void> {
  // Wait for app ready
  await app.whenReady();

  // Setup IPC handlers before window creation
  setupIpcHandlers();

  // Create main window
  createMainWindow();

  // Create system tray
  createTray();

  configureWindowsDesktopIntegrations();
  registerGlobalShortcuts();

  // Register global exception handlers
  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Rejection:", reason);
  });

  // §R8-55: Auto-update mechanism via electron-updater after app ready
  resolveAutoUpdater()?.checkForUpdatesAndNotify();
}

// macOS: Re-create window when dock icon is clicked
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// Quit when all windows are closed (except on macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// App lifecycle
app.on("ready", () => {
  initializeApp().catch((err) => {
    console.error("Failed to initialize app:", err);
  });
});

app.on("before-quit", () => {
  // Cleanup tray on quit
  tray?.destroy();
  globalShortcut.unregisterAll();
});

// Export for testing
export { createMainWindow, setupIpcHandlers };
