export type PlatformArchitectureLayer =
  | "platform"
  | "domains"
  | "interaction"
  | "org-governance"
  | "scale-ecosystem"
  | "ops-maturity"
  | "plugins"
  | "sdk"
  | "apps";

export type PlatformPlane = "P1" | "P2" | "P3" | "P4" | "P5" | "X1";

export type PlatformAppKind = "api" | "console" | "worker";

export interface PlatformAppManifest {
  appId: string;
  kind: PlatformAppKind;
  entryModule: string;
  defaultPort: number | null;
  healthEndpoint: string | null;
  capabilities: string[];
  requiredLayers: PlatformArchitectureLayer[];
  startupCommand: string;
  startupMode: "daemon" | "job";
}

export type PlatformStartupTargetKind = "summary" | "demo" | PlatformAppKind;

/**
 * Entry mode for platform root operation.
 * Alias for PlatformStartupTargetKind to provide clearer semantics at entry point level.
 */
export type PlatformRootEntryMode = PlatformStartupTargetKind;

export interface PlatformStartupTarget {
  targetKind: PlatformStartupTargetKind;
  rootEntryModule: string;
  description: string;
  requiredLayers: PlatformArchitectureLayer[];
  startupCommand: string | null;
  appManifest: PlatformAppManifest | null;
}

// Canonical runtime types - HarnessRun/HarnessRunStatus now in executable-contracts (per §5.5)
// NodeRun is still defined here as it's used across multiple layers

export interface NodeRun {
  readonly nodeRunId: string;
  readonly harnessRunId: string;
  readonly planGraphBundleId: string;
  readonly graphVersion: number;
  readonly nodeId: string;
  readonly status: NodeRunStatus;
  readonly attemptCount: number;
  readonly leaseId?: string;
  readonly fencingToken?: string;
  readonly currentSeq: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly terminalReason?: string;
}

export type NodeRunStatus =
  | "created"
  | "ready"
  | "leased"
  | "running"
  | "retry_wait"
  | "awaiting_hitl"
  | "reconciling"
  | "succeeded"
  | "failed"
  | "skipped"
  | "cancelled"
  | "dependency_failed"
  | "policy_blocked"
  | "aborted";

export interface PlanGraphBundle {
  readonly planGraphBundleId: string;
  readonly harnessRunId: string;
  readonly graphVersion: number;
  readonly graph: PlanGraph;
  readonly schedulerPolicy: ReadyNodeSchedulingPolicy;
  readonly budgetPlanRef: string;
  readonly riskProfile: RiskPreview;
  readonly validationReport: GraphValidationReport;
  readonly artifactRefs: readonly ArtifactRef[];
  readonly createdAt: string;
}

export interface PlanGraph {
  readonly graphId: string;
  readonly nodes: readonly PlanNode[];
  readonly edges: readonly PlanEdge[];
  readonly entryNodeIds: readonly string[];
  readonly terminalNodeIds: readonly string[];
  readonly joinStrategy: "all" | "any" | "first_success" | "policy";
  readonly graphHash: string;
}

export interface PlanNode {
  readonly nodeId: string;
  readonly nodeType: PlanNodeType;
  readonly inputRefs: readonly string[];
  readonly outputSchemaRef: string;
  readonly riskClass: RiskClass;
  readonly budgetIntent: BudgetIntent;
  readonly sideEffectProfile: SideEffectProfile;
  readonly retryPolicyRef: string;
  readonly timeoutMs: number;
}

export type PlanNodeType =
  | "tool"
  | "llm"
  | "hitl_wait"
  | "subgraph"
  | "evaluator"
  | "router"
  | "compensation";

export interface PlanEdge {
  readonly edgeId: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly condition: JsonValue;
  readonly dependencyType: DependencyType;
}

export type DependencyType = "hard" | "soft" | "compensation" | "retry" | "replan";

export interface ReadyNodeSchedulingPolicy {
  readonly policyId: string;
  readonly strategy: "deterministic_fifo" | "priority_then_fifo" | "risk_isolated";
}

export interface GraphValidationReport {
  readonly valid: boolean;
  readonly findings: readonly string[];
  readonly normalizedNodeIds?: readonly string[];
}

export interface BudgetIntent {
  readonly amount: number;
  readonly currency: string;
  readonly resourceKinds: readonly BudgetResourceKind[];
}

export type BudgetResourceKind = "token" | "tool" | "api" | "compute" | "human" | "side_effect" | "other";

export interface SideEffectProfile {
  readonly mayCommitExternalEffect: boolean;
  readonly reversible: boolean;
}

export type RiskClass = "low" | "medium" | "high" | "critical";

export interface RiskPreview {
  readonly riskClass: RiskClass;
  readonly reasons: readonly string[];
}

export interface BudgetReservation {
  readonly budgetReservationId: string;
  readonly budgetLedgerId: string;
  readonly harnessRunId: string;
  readonly nodeRunId?: string;
  readonly amount: number;
  readonly resourceKind: BudgetResourceKind;
  readonly status: "reserved" | "settled" | "released" | "expired" | "rejected";
  readonly expiresAt: string;
  readonly createdAt: string;
}

export interface ArtifactRef {
  readonly artifactId: string;
  readonly uri: string;
  readonly hash?: string;
  readonly version?: string;
}

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/**
 * Crosscutting fabric classification for reliability/security/governance categorization.
 * Used in structured logging per §12.4 to categorize log entries by their crosscutting concern.
 */
export type CrosscuttingFabricCategory = "reliability" | "security" | "governance";
