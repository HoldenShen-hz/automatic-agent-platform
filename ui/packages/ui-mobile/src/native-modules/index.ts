export type NativeModulePermissionState = "granted" | "prompt" | "unavailable";

export interface NativeModuleBaselineEntry {
  readonly requiresBridge: boolean;
  readonly permission: NativeModulePermissionState;
  readonly bridgeMethods: readonly string[];
}

export const nativeModulesBaseline = {
  biometric: { requiresBridge: false, permission: "prompt", bridgeMethods: [] },
  push: { requiresBridge: false, permission: "prompt", bridgeMethods: [] },
  secureStorage: { requiresBridge: true, permission: "granted", bridgeMethods: ["readSecureValue", "writeSecureValue", "deleteSecureValue"] },
  filePicker: { requiresBridge: false, permission: "prompt", bridgeMethods: [] },
  haptics: { requiresBridge: true, permission: "granted", bridgeMethods: ["vibrate"] },
  deepLink: { requiresBridge: true, permission: "granted", bridgeMethods: ["openDeepLink"] },
  screenSecurity: { requiresBridge: true, permission: "granted", bridgeMethods: ["enableScreenSecurity"] },
} as const satisfies Record<string, NativeModuleBaselineEntry>;

type NativeModuleName = keyof typeof nativeModulesBaseline;

function resolveMobileBridge(): Record<string, unknown> | null {
  const bridge = globalThis.__AA_MOBILE__;
  if (bridge == null || typeof bridge !== "object") {
    return null;
  }
  return bridge as Record<string, unknown>;
}

function hasBridgeMethods(bridge: Record<string, unknown> | null, methods: readonly string[]): boolean {
  if (methods.length === 0) {
    return true;
  }
  if (bridge == null) {
    return false;
  }
  return methods.every((method) => typeof bridge[method] === "function");
}

export function describeNativeModules(): Array<{
  name: NativeModuleName;
  enabled: boolean;
  requiresBridge: boolean;
  permission: NativeModulePermissionState;
  source: "bridge" | "adapter";
}> {
  const bridge = resolveMobileBridge();
  return (Object.entries(nativeModulesBaseline) as Array<[NativeModuleName, NativeModuleBaselineEntry]>).map(([name, baseline]) => ({
    name,
    enabled: baseline.requiresBridge ? hasBridgeMethods(bridge, baseline.bridgeMethods) : true,
    requiresBridge: baseline.requiresBridge,
    permission: baseline.requiresBridge && bridge == null ? "unavailable" : baseline.permission,
    source: baseline.requiresBridge ? "bridge" : "adapter",
  }));
}
