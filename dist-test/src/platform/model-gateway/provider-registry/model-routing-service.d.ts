/**
 * Model Routing Service
 *
 * Selects the optimal model profile for a request based on:
 * - Route class (coding, reasoning, classification, writing, default)
 * - Risk level (low, medium, high, critical)
 * - Required capabilities (e.g., "vision", "function_calling")
 * - Provider health status
 * - Governance policies (profile enable/disable status)
 * - Cost constraints (maxInputPer1kUsd)
 * - Sticky/preferred profile preferences
 * - Turn-scoped fallback leases for fault tolerance
 *
 * ## Route Class Tiers
 *
 * Each route class has an ordered list of preferred tiers:
 * - coding: coding > reasoning > balanced > fast
 * - reasoning/high-risk: reasoning > balanced > coding > fast
 * - classification: fast > balanced > reasoning > coding
 * - writing: balanced > reasoning > fast > coding
 * - default: balanced > fast > reasoning > coding
 *
 * ## Fallback Mechanism
 *
 * The service issues "turn-scoped fallback leases" when:
 * - Provider health degrades (provider_health_fallback)
 * - Cost cap is exceeded (cost_cap_fallback)
 * - Target tier has no available candidates (tier_fallback)
 *
 * These leases allow the fallback profile to be used for the current turn
 * while the primary profile recovers.
 */
import type { ModelMetadataRegistry, ModelProfileMetadata } from "../../control-plane/config-center/model-metadata-registry.js";
import type { ProviderHealthSummary } from "../../shared/observability/provider-health-tracker.js";
import type { ModelGovernanceSnapshot } from "../../prompt-engine/eval/prompt-model-policy-governance-service.js";
/**
 * Classification of the type of work being performed.
 * Affects tier preference order in route selection.
 */
export type ModelRouteClass = "default" | "classification" | "writing" | "coding" | "reasoning";
/**
 * Risk level affects tier selection and fallback behavior.
 * Higher risk prefers more capable models.
 */
export type ModelRouteRiskLevel = "low" | "medium" | "high" | "critical";
/**
 * Request for model routing decision
 */
export interface ModelRouteRequest {
    routeClass?: ModelRouteClass;
    riskLevel?: ModelRouteRiskLevel;
    requiredCapabilities?: readonly string[];
    preferredProfileName?: string | null;
    pinnedProfileName?: string | null;
    stickyProfileName?: string | null;
    turnId?: string | null;
    fallbackLease?: ModelRouteFallbackLease | null;
    governanceSnapshot?: ModelGovernanceSnapshot | null;
    maxInputPer1kUsd?: number | null;
    allowStrongUpgrade?: boolean;
}
/**
 * A turn-scoped fallback lease issued when primary profile cannot be used.
 * Allows using the fallback profile for the current turn only.
 */
export interface ModelRouteFallbackLease {
    turnId: string;
    primaryProfileName: string;
    fallbackProfileName: string;
    issuedAt: string;
    reason: "provider_health_fallback" | "cost_cap_fallback" | "tier_fallback";
}
/**
 * Detailed trace of the routing decision for debugging and auditing.
 * Records why each profile was considered and why the final choice was made.
 */
export interface ModelRouteTrace {
    routeReason: "pinned_profile" | "sticky_profile" | "preferred_profile" | "risk_driven_reasoning" | "coding_required" | "classification_cheap_default" | "writing_balanced_default" | "default_balanced" | "capability_driven_selection" | "cost_cap_fallback" | "provider_health_fallback" | "tier_fallback" | "governance_fallback" | "turn_scoped_fallback_lease";
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
/**
 * Complete routing decision with selected profile and trace
 */
export interface ModelRouteDecision {
    profileName: string;
    profile: ModelProfileMetadata;
    trace: ModelRouteTrace;
    fallbackLease: ModelRouteFallbackLease | null;
}
export interface ModelRoutingServiceOptions {
    registry: ModelMetadataRegistry;
    providerHealth?: Record<string, ProviderHealthSummary>;
}
/**
 * Model Routing Service
 *
 * Selects optimal model profiles based on request parameters, provider health,
 * and governance policies. Issues fallback leases when primary profiles
 * cannot be used due to health, cost, or availability constraints.
 */
export declare class ModelRoutingService {
    private readonly registry;
    private readonly providerHealth;
    constructor(options: ModelRoutingServiceOptions);
    /**
     * Routes a request to the optimal model profile.
     *
     * Process:
     * 1. Validate and normalize request parameters
     * 2. Filter profiles by capability and governance requirements
     * 3. Check pinned/sticky/preferred profile preferences
     * 4. Honor existing fallback leases for the turn
     * 5. Select profile by tier order, cost, and availability
     * 6. Issue new fallback lease if primary becomes unavailable
     */
    route(request?: ModelRouteRequest): ModelRouteDecision;
}
