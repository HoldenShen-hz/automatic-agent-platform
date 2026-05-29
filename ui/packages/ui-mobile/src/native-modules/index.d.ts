export interface NativeModuleDescriptor {
    readonly name: string;
    readonly enabled: boolean;
    readonly requiresBridge: boolean;
    readonly permission: "granted" | "unavailable";
    readonly source: "adapter" | "bridge" | "native_module" | "turbo_module";
}
interface MobileBridgeLike {
    readonly readSecureValue?: (key: string) => Promise<string | null>;
    readonly writeSecureValue?: (key: string, value: string) => Promise<void>;
    readonly deleteSecureValue?: (key: string) => Promise<void>;
    readonly openDeepLink?: (url: string) => Promise<void>;
    readonly vibrate?: (pattern: readonly number[]) => Promise<void>;
    readonly enableScreenSecurity?: () => Promise<void>;
    readonly registerPushToken?: () => Promise<string>;
    readonly authenticateBiometric?: () => Promise<boolean>;
    readonly openOfflineDatabase?: (name: string) => Promise<void>;
    readonly performGestureFeedback?: (gesture: string) => Promise<void>;
    readonly refreshWidget?: (widgetId: string) => Promise<void>;
}
declare global {
    interface GlobalThis {
        __turboModuleProxy?: (name: string) => MobileBridgeLike | null | undefined;
        NativeModules?: Record<string, unknown>;
    }
}
export declare const nativeModulesBaseline: readonly [{
    readonly name: "push";
    readonly requiresBridge: true;
}, {
    readonly name: "biometric";
    readonly requiresBridge: true;
}, {
    readonly name: "offlineSqlite";
    readonly requiresBridge: true;
}, {
    readonly name: "gestures";
    readonly requiresBridge: true;
}, {
    readonly name: "widgets";
    readonly requiresBridge: true;
}, {
    readonly name: "secureStorage";
    readonly requiresBridge: true;
}, {
    readonly name: "deepLink";
    readonly requiresBridge: true;
}, {
    readonly name: "haptics";
    readonly requiresBridge: true;
}, {
    readonly name: "screenSecurity";
    readonly requiresBridge: true;
}];
export declare function describeNativeModules(): NativeModuleDescriptor[];
export {};
