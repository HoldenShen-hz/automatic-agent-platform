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
    "shell:run",
    "shell:spawn",
    "window:minimize",
    "window:maximize",
    "window:open",
    "deep-link:open",
    "secure-store:read",
    "secure-store:write",
    "secure-store:delete",
    "files:read",
    "files:write",
    "privacy:getAnalyticsConsent",
    "privacy:setAnalyticsConsent",
    "privacy:enableScreenSecurity",
  ] as const,
};

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
