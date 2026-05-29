import type { ElectronBridge } from "./bridge-contract.js";
export declare const electronPreloadApi: {
    readonly shell: {
        readonly openExternal: "shell:openExternal";
    };
    readonly window: {
        readonly minimize: "window:minimize";
        readonly maximize: "window:maximize";
        readonly open: "window:open";
    };
    readonly deepLink: {
        readonly open: "deep-link:open";
    };
    readonly secureStore: {
        readonly read: "secure-store:read";
        readonly write: "secure-store:write";
        readonly delete: "secure-store:delete";
    };
    readonly privacy: {
        readonly getAnalyticsConsent: "privacy:getAnalyticsConsent";
        readonly setAnalyticsConsent: "privacy:setAnalyticsConsent";
        readonly enableScreenSecurity: "privacy:enableScreenSecurity";
    };
};
export declare function installElectronBridge(target: Window, bridge: ElectronBridge): void;
