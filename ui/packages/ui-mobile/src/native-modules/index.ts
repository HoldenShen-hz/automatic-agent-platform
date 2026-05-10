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
  readonly vibrate?: () => Promise<void>;
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
} as const;

const NATIVE_MODULE_NAME = "AAMobileBridge";

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
] as const;

function getLegacyBridge(): MobileBridgeLike | null {
  const bridge = globalThis.__AA_MOBILE__;
  return bridge == null ? null : bridge;
}

function getTurboBridge(): MobileBridgeLike | null {
  const turboProxy = globalThis.__turboModuleProxy as
    | ((name: string) => MobileBridgeLike | null | undefined)
    | undefined;
  return turboProxy?.(NATIVE_MODULE_NAME) ?? null;
}

function getNativeModulesBridge(): MobileBridgeLike | null {
  const nativeModules = globalThis.NativeModules as Record<string, unknown> | null | undefined;
  const bridge = nativeModules?.[NATIVE_MODULE_NAME];
  return bridge != null && typeof bridge === "object" ? bridge as MobileBridgeLike : null;
}

function resolveBridge(): { bridge: MobileBridgeLike | null; source: NativeModuleDescriptor["source"] } {
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

function hasBridgeMethods(
  bridge: MobileBridgeLike | null,
  methods: readonly string[],
): boolean {
  if (bridge == null) {
    return false;
  }
  return methods.every((method) => typeof bridge[method as keyof MobileBridgeLike] === "function");
}

export function describeNativeModules(): NativeModuleDescriptor[] {
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
