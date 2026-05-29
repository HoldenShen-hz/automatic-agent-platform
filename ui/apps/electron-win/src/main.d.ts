import type { BrowserWindow as BrowserWindowHandle } from "electron";
export declare const electronGlobalShortcuts: readonly ["CommandOrControl+K", "CommandOrControl+N", "Shift+CommandOrControl+D"];
export declare const electronMainBaseline: {
    window: {
        width: number;
        height: number;
        minWidth: number;
        minHeight: number;
    };
    security: {
        contextIsolation: boolean;
        nodeIntegration: boolean;
        sandbox: boolean;
    };
    channels: readonly [{
        readonly name: "shell:openExternal";
        readonly tier: "restricted";
        readonly permission: "external-link:open";
    }, {
        readonly name: "window:minimize";
        readonly tier: "trusted-ui";
        readonly permission: "window:control";
    }, {
        readonly name: "window:maximize";
        readonly tier: "trusted-ui";
        readonly permission: "window:control";
    }, {
        readonly name: "window:open";
        readonly tier: "trusted-ui";
        readonly permission: "window:spawn";
    }, {
        readonly name: "deep-link:open";
        readonly tier: "trusted-ui";
        readonly permission: "deep-link:open";
    }, {
        readonly name: "secure-store:read";
        readonly tier: "restricted";
        readonly permission: "secure-store:read";
    }, {
        readonly name: "secure-store:write";
        readonly tier: "restricted";
        readonly permission: "secure-store:write";
    }, {
        readonly name: "secure-store:delete";
        readonly tier: "restricted";
        readonly permission: "secure-store:delete";
    }, {
        readonly name: "privacy:getAnalyticsConsent";
        readonly tier: "trusted-ui";
        readonly permission: "privacy:read";
    }, {
        readonly name: "privacy:setAnalyticsConsent";
        readonly tier: "trusted-ui";
        readonly permission: "privacy:write";
    }, {
        readonly name: "privacy:enableScreenSecurity";
        readonly tier: "restricted";
        readonly permission: "privacy:screen-security";
    }];
};
export declare const electronBridgeCapabilities: {
    readonly secureStore: true;
    readonly filesystem: true;
    readonly shell: false;
    readonly deepLink: true;
    readonly process: false;
    readonly analyticsConsent: true;
    readonly screenSecurity: true;
    readonly lifecycle: true;
};
export declare function createMainWindow(): BrowserWindowHandle;
export declare function openSecondaryWindow(routePath: string): BrowserWindowHandle;
export declare function registerGlobalShortcuts(mainWindow?: BrowserWindowHandle): void;
export declare function configureWindowsDesktopIntegrations(): void;
export declare function showPlatformNotification(title: string, body: string): boolean;
export declare function registerIpcHandlers(mainWindow: BrowserWindowHandle): void;
export declare function bootstrapElectronShell(): Promise<void>;
