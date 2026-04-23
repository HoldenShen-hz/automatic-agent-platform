export const nativeModulesBaseline = {
  biometric: true,
  push: true,
  secureStorage: true,
  filePicker: true,
  haptics: true,
  deepLink: true,
  screenSecurity: true,
} as const;

export function describeNativeModules() {
  return Object.entries(nativeModulesBaseline).map(([name, enabled]) => ({
    name,
    enabled,
  }));
}
