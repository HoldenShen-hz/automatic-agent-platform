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
    // §185-2165: files:read/files:write removed - no path whitelist, allows arbitrary file access
    // These should be replaced with scoped file APIs that validate paths against allowed directories
    "privacy:getAnalyticsConsent",
    "privacy:setAnalyticsConsent",
    "privacy:enableScreenSecurity",
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
  shell: true,
  deepLink: true,
  process: true,
  analyticsConsent: true,
  screenSecurity: true,
  lifecycle: true,
} as const;
