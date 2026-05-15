import type { ModelMetadataRegistry, ModelProfileMetadata } from "../../five-plane-control-plane/config-center/model-metadata-registry.js";
import type { RiskLevel } from "../../five-plane-control-plane/risk-control/types.js";
import type { ProviderHealthSummary } from "../../shared/observability/provider-health-tracker.js";
import type { ModelGovernanceSnapshot } from "../../contracts/types/governance.js";

export type ModelRouteClass = "default" | "classification" | "writing" | "coding" | "reasoning";
export type ModelRouteRiskLevel = RiskLevel;
export type ModelRoutePurpose = "plan" | "execute" | "evaluate" | "summarize" | "chat";
export type ModelRoutingStrategy =
  | "cost_optimized"
  | "latency_optimized"
  | "quality_optimized"
  | "compliance_constrained"
  | "hybrid";
export type RouteFailureCode =
  | "route.no_candidate"
  | "route.policy_denied"
  | "route.cost_guard"
  | "route.provider_cooldown"
  | "route.capability_mismatch";

export interface ModelRouteRequest {
  requestId?: string;
  harnessRunId?: string;
  nodeRunId?: string | null;
  attemptId?: string | null;
  taskId?: string | null;
  sessionId?: string | null;
  tenantId?: string | null;
  purpose?: ModelRoutePurpose;
  routingStrategy?: ModelRoutingStrategy;
  routeClass?: ModelRouteClass;
  riskLevel?: ModelRouteRiskLevel;
  requiredCapabilities?: readonly string[];
  preferredModel?: string | null;
  maxLatencyMs?: number | null;
  maxCostUsd?: number | null;
  preferredProfileName?: string | null;
  pinnedProfileName?: string | null;
  stickyProfileName?: string | null;
  turnId?: string | null;
  fallbackLease?: ModelRouteFallbackLease | null;
  governanceSnapshot?: ModelGovernanceSnapshot | null;
  data_residency?: string | null;
  pii_input_detected?: boolean;
  pii_output_possible?: boolean;
  model_training_opt_out?: boolean;
  judge_independence?: boolean;
  latency_slo_target_ms?: number | null;
  maxInputPer1kUsd?: number | null;
  allowStrongUpgrade?: boolean;
}

export interface ModelRouteFallbackLease {
  turnId: string;
  primaryProfileName: string;
  fallbackProfileName: string;
  issuedAt: string;
  reason:
    | "provider_health_fallback"
    | "cost_cap_fallback"
    | "tier_fallback";
}

export interface ModelRouteTrace {
  routeReason:
    | "pinned_profile"
    | "sticky_profile"
    | "preferred_profile"
    | "risk_driven_reasoning"
    | "coding_required"
    | "classification_cheap_default"
    | "writing_balanced_default"
    | "default_balanced"
    | "capability_driven_selection"
    | "cost_cap_fallback"
    | "provider_health_fallback"
    | "tier_fallback"
    | "governance_fallback"
    | "turn_scoped_fallback_lease";
  requestedRouteClass: ModelRouteClass;
  requestedRiskLevel: ModelRouteRiskLevel;
  requiredCapabilities: string[];
  targetTierOrder: string[];
  selectedProfileName: string;
  selectedProvider: string;
  preferredProfileName: string | null;
  pinnedProfileName: string | null;
  stickyProfileName: string | null;
  turnId: string | null;
  turnScopedFallbackPrimaryProfileName: string | null;
  turnScopedFallbackProfileName: string | null;
  turnScopedFallbackActive: boolean;
  turnScopedFallbackIssued: boolean;
  turnScopedFallbackAutoRecoveryNextTurn: boolean;
  selectedGovernanceStatus: "active" | "degraded" | "disabled" | "unknown";
  selectedGovernanceRollbackTarget: string | null;
  healthStatuses: Record<string, ProviderHealthSummary["status"] | "unknown">;
  filteredOut: string[];
}

export interface ModelRouteDecision {
  profileName: string;
  profile: ModelProfileMetadata;
  providerId: string;
  modelId: string;
  authProfileId: string;
  fallbackChain: string[];
  stickySession: boolean;
  decisionReason: string[];
  trace: ModelRouteTrace;
  fallbackLease: ModelRouteFallbackLease | null;
}

export interface ModelRoutingServiceOptions {
  registry: ModelMetadataRegistry;
  providerHealth?: Record<string, ProviderHealthSummary>;
  persistence?: {
    persistRoutingDecision: (decision: {
      profileName: string;
      provider: string;
      dataResidencyMet: boolean;
      latencySloTargetMs: number;
      latencyP99Ms: number | null;
      piiSafe: boolean;
      piiOutputGoverned: boolean;
      trainingOptOutSupported: boolean;
      judgeIndependent: boolean;
      occurredAt: string;
    }) => void;
  };
}
