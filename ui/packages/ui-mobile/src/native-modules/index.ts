export interface NativeModuleDescriptor {
  readonly name: string;
  readonly enabled: boolean;
  readonly requiresBridge: boolean;
  readonly permission: "granted" | "unavailable";
  readonly source: "adapter" | "bridge";
}

const ADAPTER_MODULES = ["biometric", "push"] as const;
const BRIDGE_MODULES = {
  secureStorage: ["readSecureValue", "writeSecureValue", "deleteSecureValue"],
  filePicker: [],
  haptics: ["vibrate"],
  deepLink: ["openDeepLink"],
  screenSecurity: ["enableScreenSecurity"],
} as const;

function hasBridgeMethods(methods: readonly string[]): boolean {
  const bridge = globalThis.__AA_MOBILE__;
  if (bridge == null) {
    return false;
  }
  return methods.every((method) => typeof bridge[method as keyof typeof bridge] === "function");
}

export function describeNativeModules(): NativeModuleDescriptor[] {
  const adapterModules = ADAPTER_MODULES.map((name) => ({
    name,
    enabled: true,
    requiresBridge: false,
    permission: "granted" as const,
    source: "adapter" as const,
  }));
  const bridgeModules = Object.entries(BRIDGE_MODULES).map(([name, methods]) => {
    const enabled = hasBridgeMethods(methods);
    return {
      name,
      enabled,
      requiresBridge: true,
      permission: enabled ? "granted" as const : "unavailable" as const,
      source: "bridge" as const,
    };
  });

  return [...adapterModules, ...bridgeModules];
}
