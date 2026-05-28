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
