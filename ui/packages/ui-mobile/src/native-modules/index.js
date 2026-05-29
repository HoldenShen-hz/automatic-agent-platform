const BRIDGE_METHODS = {
    secureStorage: ["readSecureValue", "writeSecureValue", "deleteSecureValue"],
    deepLink: ["openDeepLink"],
    haptics: ["vibrate"],
    screenSecurity: ["enableScreenSecurity"],
    push: ["registerPushToken"],
    biometric: ["authenticateBiometric"],
    offlineSqlite: ["openOfflineDatabase"],
    gestures: ["performGestureFeedback"],
    widgets: ["refreshWidget"],
};
const NATIVE_MODULE_NAME = "AAMobileBridge";
const mobileGlobals = globalThis;
export const nativeModulesBaseline = [
    { name: "push", requiresBridge: true },
    { name: "biometric", requiresBridge: true },
    { name: "offlineSqlite", requiresBridge: true },
    { name: "gestures", requiresBridge: true },
    { name: "widgets", requiresBridge: true },
    { name: "secureStorage", requiresBridge: true },
    { name: "deepLink", requiresBridge: true },
    { name: "haptics", requiresBridge: true },
    { name: "screenSecurity", requiresBridge: true },
];
function getLegacyBridge() {
    const bridge = mobileGlobals.__AA_MOBILE__;
    return bridge == null ? null : bridge;
}
function getTurboBridge() {
    const turboProxy = mobileGlobals.__turboModuleProxy;
    return turboProxy?.(NATIVE_MODULE_NAME) ?? null;
}
function getNativeModulesBridge() {
    const nativeModules = mobileGlobals.NativeModules;
    const bridge = nativeModules?.[NATIVE_MODULE_NAME];
    return bridge != null && typeof bridge === "object" ? bridge : null;
}
function resolveBridge() {
    const turboBridge = getTurboBridge();
    if (turboBridge) {
        return { bridge: turboBridge, source: "turbo_module" };
    }
    const nativeModulesBridge = getNativeModulesBridge();
    if (nativeModulesBridge) {
        return { bridge: nativeModulesBridge, source: "native_module" };
    }
    const legacyBridge = getLegacyBridge();
    if (legacyBridge) {
        return { bridge: legacyBridge, source: "bridge" };
    }
    return { bridge: null, source: "bridge" };
}
function hasBridgeMethods(bridge, methods) {
    if (bridge == null) {
        return false;
    }
    return methods.every((method) => typeof bridge[method] === "function");
}
export function describeNativeModules() {
    const resolved = resolveBridge();
    return nativeModulesBaseline.map((descriptor) => {
        const methods = BRIDGE_METHODS[descriptor.name];
        const enabled = hasBridgeMethods(resolved.bridge, methods);
        return {
            name: descriptor.name,
            enabled,
            requiresBridge: descriptor.requiresBridge,
            permission: enabled ? "granted" : "unavailable",
            source: enabled ? resolved.source : "bridge",
        };
    });
}
