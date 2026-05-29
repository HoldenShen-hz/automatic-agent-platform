import { describe, expect, it } from "vitest";
import { describeNativeModules } from "../../packages/ui-mobile/src/native-modules";
import { mobileGlobals } from "../helpers/mobile-bridge";
describe("ui-mobile native modules", () => {
    it("marks bridge-backed modules unavailable when no mobile bridge is present", () => {
        delete mobileGlobals().__AA_MOBILE__;
        const modules = describeNativeModules();
        const secureStorage = modules.find((item) => item.name === "secureStorage");
        const biometric = modules.find((item) => item.name === "biometric");
        const offlineSqlite = modules.find((item) => item.name === "offlineSqlite");
        expect(secureStorage).toMatchObject({
            enabled: false,
            requiresBridge: true,
            permission: "unavailable",
            source: "bridge",
        });
        expect(biometric).toMatchObject({
            enabled: false,
            requiresBridge: true,
            source: "bridge",
        });
        expect(offlineSqlite).toMatchObject({
            enabled: false,
            requiresBridge: true,
            permission: "unavailable",
        });
    });
    it("detects bridge-backed capabilities from the mobile bridge", () => {
        mobileGlobals().__AA_MOBILE__ = {
            readSecureValue: async () => "token",
            writeSecureValue: async () => undefined,
            deleteSecureValue: async () => undefined,
            copyToClipboard: async () => undefined,
            openDeepLink: async () => undefined,
            vibrate: async () => undefined,
            getAnalyticsConsent: async () => true,
            setAnalyticsConsent: async () => undefined,
            enableScreenSecurity: async () => undefined,
            onForeground: () => () => undefined,
            onBackground: () => () => undefined,
            registerPushToken: async () => "token",
            authenticateBiometric: async () => true,
            openOfflineDatabase: async () => undefined,
            performGestureFeedback: async () => undefined,
            refreshWidget: async () => undefined,
        };
        const modules = describeNativeModules();
        expect(modules.find((item) => item.name === "secureStorage")?.enabled).toBe(true);
        expect(modules.find((item) => item.name === "deepLink")?.enabled).toBe(true);
        expect(modules.find((item) => item.name === "haptics")?.enabled).toBe(true);
        expect(modules.find((item) => item.name === "push")?.enabled).toBe(true);
        expect(modules.find((item) => item.name === "biometric")?.enabled).toBe(true);
        expect(modules.find((item) => item.name === "offlineSqlite")?.enabled).toBe(true);
        expect(modules.find((item) => item.name === "gestures")?.enabled).toBe(true);
        expect(modules.find((item) => item.name === "widgets")?.enabled).toBe(true);
        delete mobileGlobals().__AA_MOBILE__;
    });
});
