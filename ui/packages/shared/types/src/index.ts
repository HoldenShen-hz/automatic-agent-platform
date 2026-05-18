export type ApiLayer = "A" | "B" | "C";
export type ImplementationStatus =
  | "Implemented/Contracted"
  | "Implemented/Internal"
  | "Implemented/Partial"
  | "Planned"
  | (string & {});

export type PlatformId = "web" | "windows" | "macos" | "linux" | "android" | "ios" | (string & {});
export type FeatureGroup = "Mission Control" | "Operations" | "Governance" | "Admin" | "Extended" | "Shared" | (string & {});
export type FeatureKind = "implemented" | "planned" | (string & {});
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
  getDebugState(): unknown;
}

export interface PlatformAdapterCapabilityView {
  readonly secureStorage: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
  };
  readonly offlineStore: {
    get(path: string): Promise<string>;
    set(path: string, contents: string): Promise<void>;
  };
  readonly clipboard: {
    write(text: string): Promise<void>;
  };
  readonly deeplink: {
    open(url: string): Promise<void>;
  };
  readonly lifecycle: {
    onForeground(listener: () => void): () => void;
    onBackground(listener: () => void): () => void;
  };
  readonly haptics: {
    vibrate(pattern: readonly number[]): Promise<void>;
  };
  readonly windowing: {
    open(path: string): Promise<void>;
  };
  readonly shell: {
    run(command: string): Promise<{ code: number; stdout: string; stderr: string }>;
  };
  readonly process: {
    spawn(command: string, args: readonly string[]): Promise<{ pid: number; kill(): Promise<void> }>;
  };
  readonly analyticsConsent: {
    get(): Promise<boolean>;
    set(enabled: boolean): Promise<void>;
  };
  readonly screenSecurity: {
    setEnabled(enabled: boolean): Promise<void>;
  };
}

export interface FeatureGuardContext {
  readonly authenticated: boolean;
  readonly tenantId: string | null;
  readonly domainId: string | null;
  readonly permissions: readonly string[];
  readonly roles: readonly string[];
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly featureVisibility: Readonly<Record<string, boolean>>;
  readonly mode: "solo" | "enterprise";
}

export interface RouteGuardResult {
  readonly allowed: boolean;
  readonly reason: string | null;
  readonly evaluatedLayers?: readonly string[];
}

export interface RouteGuardChain {
  readonly id?: string;
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
  readonly path?: string;
  readonly status: ImplementationStatus;
  readonly kind: FeatureKind;
  readonly platforms?: readonly PlatformId[];
  readonly permission?: string;
  readonly apiLayer?: ApiLayer;
  readonly summary?: string;
}

export interface DashboardSnapshotDTO {
  readonly overallHealth: string;
  readonly queueDepth: number;
  readonly activeExecutions: number;
  readonly approvalBacklog: number;
  readonly alertSummary: string;
  readonly successRate?: number;
  readonly avgDurationMs?: number;
  readonly activeAgents?: number;
  readonly errorRate?: number;
  readonly p50LatencyMs?: number | null;
  readonly p99LatencyMs?: number | null;
  readonly budgetUtilizationPercent?: number | null;
  readonly uptimePercent?: number | null;
}

export interface WorkflowStepDTO {
  readonly id: string;
  readonly title: string;
  readonly phase: "Observe" | "Assess" | "Plan" | "Execute" | "Feedback" | "Learn" | "Improve" | "Release";
  readonly status: "pending" | "running" | "completed" | "failed";
  readonly branchId?: string;
  readonly dependsOnStepIds?: readonly string[];
  readonly evidenceRefs?: readonly string[];
}

export interface WorkflowApprovalNodeDTO {
  readonly nodeId: string;
  readonly title: string;
  readonly status: "pending" | "approved" | "rejected" | "delegated";
  readonly assignee?: string;
}

export interface WorkflowEvidenceRefDTO {
  readonly refId: string;
  readonly type: "artifact" | "log" | "report" | "trace";
  readonly uri: string;
  readonly description?: string;
}

export interface WorkflowDTO {
  readonly id: string;
  readonly title: string;
  readonly status: "draft" | "running" | "paused" | "completed";
  readonly currentStage: string;
  readonly owner: string;
  readonly steps: readonly WorkflowStepDTO[];
  readonly approvalNodes?: readonly WorkflowApprovalNodeDTO[];
  readonly evidenceRefs?: readonly WorkflowEvidenceRefDTO[];
}

export interface WorkflowRunStepDTO {
  readonly id: string;
  readonly title: string;
  readonly status: "pending" | "running" | "completed" | "failed";
  readonly executor: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
}

export interface IncidentDTO {
  readonly id: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly title: string;
  readonly summary: string;
  readonly createdAt: string;
}

export interface WorkerDTO {
  readonly id: string;
  readonly status: "idle" | "busy" | "draining";
  readonly queue: string;
  readonly heartbeatLagMs: number;
}

export interface QueueDTO {
  readonly id: string;
  readonly ready: number;
  readonly inFlight: number;
  readonly retries: number;
  readonly dlq: number;
}

export interface AgentDTO {
  readonly id: string;
  readonly name: string;
  readonly domainId: string;
  readonly status: "healthy" | "degraded" | "offline";
  readonly load: number;
}

export interface AnalyticsMetricDTO {
  readonly id: string;
  readonly label: string;
  readonly value: string | number;
  readonly trend: "up" | "flat" | "down";
  readonly changePercent?: number;
  readonly layer?: "overview" | "tasks" | "workflows" | "approvals" | "cost" | "agents";
  readonly description?: string;
}

export interface CostReportDTO {
  readonly id: string;
  readonly scope: string;
  readonly amountUsd: number;
  readonly budgetUsd: number;
}

export interface MarketplacePackDTO {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly version: string;
}

export interface PackVersionDTO {
  readonly id: string;
  readonly version: string;
  readonly createdAt: string;
  readonly status: "draft" | "published" | "deprecated";
}

export interface PluginDTO {
  readonly id: string;
  readonly name: string;
  readonly provider: string;
  readonly enabled: boolean;
}

export interface PromptDTO {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly updatedAt: string;
}

export interface KnowledgeItemDTO {
  readonly id: string;
  readonly title: string;
  readonly kind: "document" | "note" | "playbook" | "artifact";
  readonly updatedAt: string;
}

export interface ExplanationDTO {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly evidenceCount: number;
}

export interface RoleDTO {
  readonly id: string;
  readonly name: string;
  readonly scope: "personal" | "domain" | "platform" | "global";
  readonly permissionCount: number;
  readonly userCount: number;
}

export interface FeatureFlagDTO {
  readonly id: string;
  readonly enabled: boolean;
  readonly rolloutPercentage: number;
  readonly target: string;
}

export interface ModelConfigDTO {
  readonly id: string;
  readonly provider: string;
  readonly model: string;
  readonly boundDomains: readonly string[];
  readonly budgetUsd: number;
}

export interface DomainConfigDTO {
  readonly id: string;
  readonly displayName: string;
  readonly owner: string;
  readonly defaultDrillDepth: DrillDepth;
  readonly featureVisibilityCount: number;
}

export interface TenantDTO {
  readonly id: string;
  readonly name: string;
  readonly domains: readonly string[];
  readonly status: "active" | "paused";
}

export interface WebhookDTO {
  readonly id: string;
  readonly targetUrl: string;
  readonly eventCount: number;
  readonly enabled: boolean;
}

export interface UserDTO {
  readonly id: string;
  readonly displayName: string;
  readonly roleIds: readonly string[];
  readonly tenantId: string;
  readonly status: "active" | "invited" | "disabled";
}

export interface SystemConfigDTO {
  readonly environment: "dev" | "staging" | "prod";
  readonly cspMode: "report-only" | "enforced";
  readonly csrfEnabled: boolean;
  readonly telemetryEndpoint: string;
}

export interface TaskDTO {
  readonly id: string;
  readonly title: string;
  readonly status: "queued" | "running" | "blocked" | "completed" | "failed";
  readonly domainId: string;
  readonly currentStep: string;
  readonly owner?: string;
  readonly evidenceCount?: number;
  readonly timelineDepth?: number;
}

export interface ApprovalDTO {
  readonly approvalId: string;
  readonly taskId: string;
  readonly riskLevel: "low" | "medium" | "high" | "critical";
  readonly reasonSummary: string;
  readonly deadline?: string;
  readonly policySource?: string;
  readonly recommendedOption?: "approve" | "reject" | "delegate" | "request_context";
  readonly currentLevel?: number;
  readonly totalLevels?: number;
  readonly escalationTarget?: string;
}

export interface UserPreferenceDTO {
  readonly locale: string;
  readonly theme: "light" | "dark" | "high-contrast";
  readonly defaultDashboardLayout: readonly string[];
}

export interface SystemStatusVM {
  readonly wsStatus: string;
  readonly offlineQueueSize: number;
  readonly syncStatus: "idle" | "queued" | "syncing";
  readonly panicActivated: boolean;
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
