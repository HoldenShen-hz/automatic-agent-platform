export type ApiLayer = "A" | "B" | "C";
export type ImplementationStatus =
  | "Implemented/Contracted"
  | "Implemented/Internal"
  | "Implemented/Partial"
  | "Planned";

export type PlatformId = "web" | "windows" | "macos" | "linux" | "android" | "ios";
export type FeatureGroup = "Mission Control" | "Operations" | "Governance" | "Admin" | "Extended" | "Shared";
export type FeatureKind = "implemented" | "planned";
export type DrillDepth = 1 | 2 | 3 | 4 | 5;

export interface PlatformAdapter {
  readonly platform: PlatformId;
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  readSecureValue(key: string): Promise<string | null>;
  writeSecureValue(key: string, value: string): Promise<void>;
  deleteSecureValue(key: string): Promise<void>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, contents: string): Promise<void>;
  copyToClipboard(text: string): Promise<void>;
  openDeepLink(url: string): Promise<void>;
  onForeground(listener: () => void): () => void;
  onBackground(listener: () => void): () => void;
  vibrate(pattern: readonly number[]): Promise<void>;
  openWindow(path: string): Promise<void>;
  runShell(command: string): Promise<{ code: number; stdout: string; stderr: string }>;
  spawnProcess(command: string, args: readonly string[]): Promise<{ pid: number; kill(): Promise<void> }>;
  getAnalyticsConsent(): Promise<boolean>;
  setAnalyticsConsent(enabled: boolean): Promise<void>;
  enableScreenSecurity(enabled: boolean): Promise<void>;
}

export interface FeatureGuardContext {
  readonly authenticated: boolean;
  readonly tenantId: string | null;
  readonly permissions: readonly string[];
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly mode: "solo" | "enterprise";
}

export interface RouteGuardResult {
  readonly allowed: boolean;
  readonly reason: string | null;
}

export interface RouteGuardChain {
  readonly id: string;
  readonly evaluate: (context: FeatureGuardContext) => RouteGuardResult;
}

export interface FieldVisibilityPolicy {
  readonly rules: readonly RedactionRule[];
  readonly defaultLevel: RedactionLevel;
  readonly piiFields: readonly string[];
  readonly auditOnAccess: boolean;
}

export type RedactionLevel = "visible" | "summary" | "redacted" | "hidden";

export interface RedactionRule {
  readonly fieldPattern: string;
  readonly roleLevel: string;
  readonly redactionLevel: RedactionLevel;
  readonly summaryTemplate?: string;
  readonly redactionMask?: string;
}

export interface DomainUIConfig {
  readonly domainId: string;
  readonly featureVisibility: Readonly<Record<string, boolean>>;
  readonly actionPolicy: Readonly<Record<string, "allow" | "confirm" | "deny">>;
  readonly defaultDrillDepth: DrillDepth;
  readonly glossaryOverrides: Readonly<Record<string, string>>;
  readonly slotRegistry: readonly string[];
}

export interface AppRoute {
  readonly path: string;
  readonly featureId: string;
  readonly group: FeatureGroup;
  readonly title: string;
  readonly permission: string;
  readonly platforms: readonly PlatformId[];
  readonly codeSplit: boolean;
}

export interface PlatformFeatureManifest {
  readonly id: string;
  readonly title: string;
  readonly group: FeatureGroup;
  readonly path: string;
  readonly status: ImplementationStatus;
  readonly kind: FeatureKind;
  readonly platforms: readonly PlatformId[];
  readonly permission: string;
  readonly apiLayer: ApiLayer;
  readonly summary: string;
}

export interface DashboardSnapshotDTO {
  readonly overallHealth: string;
  readonly queueDepth: number;
  readonly activeExecutions: number;
  readonly approvalBacklog: number;
  readonly alertSummary: string;
}

export interface TaskDTO {
  readonly id: string;
  readonly title: string;
  readonly status: "queued" | "running" | "blocked" | "completed" | "failed";
  readonly domainId: string;
  readonly currentStep: string;
}

export interface ApprovalDTO {
  readonly approvalId: string;
  readonly taskId: string;
  readonly riskLevel: "low" | "medium" | "high" | "critical";
  readonly reasonSummary: string;
}

export interface UserPreferenceDTO {
  readonly locale: string;
  readonly theme: "light" | "dark" | "high-contrast";
  readonly defaultDashboardLayout: readonly string[];
}

export interface TaskVM {
  readonly id: string;
  readonly title: string;
  readonly statusLabel: string;
  readonly statusColor: string;
  readonly domainLabel: string;
  readonly drillDepth: DrillDepth;
}

export interface FeatureRouteRegistration {
  readonly manifest: PlatformFeatureManifest;
  readonly route: AppRoute;
}
