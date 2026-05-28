export interface ShellResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface SpawnedProcessHandle {
  readonly pid: number;
  kill(): Promise<void>;
}

export interface ElectronBridge {
  readonly __aaBridgeSignature?: "aa-electron-bridge-v1";
  readSecureValue(key: string): Promise<string | null>;
  writeSecureValue(key: string, value: string): Promise<void>;
  deleteSecureValue(key: string): Promise<void>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, contents: string): Promise<void>;
  copyToClipboard(text: string): Promise<void>;
  openDeepLink(url: string): Promise<void>;
  openWindow(path: string): Promise<void>;
  runShell(command: string): Promise<ShellResult>;
  spawnProcess(command: string, args: readonly string[]): Promise<SpawnedProcessHandle>;
  getAnalyticsConsent(): Promise<boolean>;
  setAnalyticsConsent(enabled: boolean): Promise<void>;
  enableScreenSecurity(enabled: boolean): Promise<void>;
  onForeground(listener: () => void): () => void;
  onBackground(listener: () => void): () => void;
}

export interface TauriBridge {
  invoke<T>(command: string, payload?: Record<string, unknown>): Promise<T>;
  onForeground?(listener: () => void): () => void;
  onBackground?(listener: () => void): () => void;
}

export interface MobileBridge {
  readSecureValue(key: string): Promise<string | null>;
  writeSecureValue(key: string, value: string): Promise<void>;
  deleteSecureValue(key: string): Promise<void>;
  copyToClipboard(text: string): Promise<void>;
  openDeepLink(url: string): Promise<void>;
  vibrate(pattern: readonly number[]): Promise<void>;
  getAnalyticsConsent(): Promise<boolean>;
  setAnalyticsConsent(enabled: boolean): Promise<void>;
  enableScreenSecurity(enabled: boolean): Promise<void>;
  onForeground(listener: () => void): () => void;
  onBackground(listener: () => void): () => void;
  registerPushToken?(): Promise<string>;
  authenticateBiometric?(): Promise<boolean>;
  openOfflineDatabase?(name: string): Promise<void>;
  performGestureFeedback?(gesture: string): Promise<void>;
  refreshWidget?(widgetId: string): Promise<void>;
}

declare global {
  interface Window {
    __AA_ELECTRON__?: ElectronBridge;
    AA_ELECTRON?: ElectronBridge;
    __TAURI__?: TauriBridge;
  }

  interface GlobalThis {
    __AA_MOBILE__?: MobileBridge | undefined;
  }
}

export {};
