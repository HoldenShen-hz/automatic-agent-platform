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
import { AppError } from "../../contracts/errors.js";

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
  // Type of work (affects tier preference order)
  routeClass?: ModelRouteClass;
  // Risk level (higher risk prefers more capable models)
  riskLevel?: ModelRouteRiskLevel;
  // Required capabilities (e.g., "vision", "function_calling")
  requiredCapabilities?: readonly string[];
  // Explicitly requested profile (bypasses normal selection)
  preferredProfileName?: string | null;
  // Must-use profile (throws if unavailable)
  pinnedProfileName?: string | null;
  // Preferred if available, otherwise falls back normally
  stickyProfileName?: string | null;
  // Turn identifier for fallback lease tracking
  turnId?: string | null;
  // Existing fallback lease to honor
  fallbackLease?: ModelRouteFallbackLease | null;
  // Governance snapshot for profile status
  governanceSnapshot?: ModelGovernanceSnapshot | null;
  // Maximum input cost per 1k USD (filters candidates)
  maxInputPer1kUsd?: number | null;
  // Allow fallback to higher-cost tiers if needed
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
  // Why the fallback was triggered
  reason:
    | "provider_health_fallback"
    | "cost_cap_fallback"
    | "tier_fallback";
}

/**
 * Detailed trace of the routing decision for debugging and auditing.
 * Records why each profile was considered and why the final choice was made.
 */
export interface ModelRouteTrace {
  // Why this profile was selected
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
  // Ordered tiers that were considered
  targetTierOrder: string[];
  selectedProfileName: string;
  selectedProvider: string;
  preferredProfileName: string | null;
  pinnedProfileName: string | null;
  stickyProfileName: string | null;
  turnId: string | null;
  // Fallback lease details (if issued)
  turnScopedFallbackPrimaryProfileName: string | null;
  turnScopedFallbackProfileName: string | null;
  turnScopedFallbackActive: boolean;
  turnScopedFallbackIssued: boolean;
  turnScopedFallbackAutoRecoveryNextTurn: boolean;
  // Governance status of selected profile
  selectedGovernanceStatus: "active" | "degraded" | "disabled" | "unknown";
  selectedGovernanceRollbackTarget: string | null;
  // Health status of all providers
  healthStatuses: Record<string, ProviderHealthSummary["status"] | "unknown">;
  // Why profiles were filtered out
  filteredOut: string[];
}

/**
 * Complete routing decision with selected profile and trace
 */
export interface ModelRouteDecision {
  profileName: string;
  profile: ModelProfileMetadata;
  trace: ModelRouteTrace;
  // New fallback lease issued (if any)
  fallbackLease: ModelRouteFallbackLease | null;
}

export interface ModelRoutingServiceOptions {
  registry: ModelMetadataRegistry;
  // Health status per provider
  providerHealth?: Record<string, ProviderHealthSummary>;
}

// Internal: eligible profile with provider status attached
interface EligibleProfile {
  profileName: string;
  profile: ModelProfileMetadata;
  providerStatus: "healthy" | "degraded" | "failed" | "unknown";
}

// Normalizes route class with default fallback to "default"
function normalizeRouteClass(value: ModelRouteRequest["routeClass"]): ModelRouteClass {
  return value ?? "default";
}

// Normalizes risk level with default fallback to "medium"
function normalizeRiskLevel(value: ModelRouteRequest["riskLevel"]): ModelRouteRiskLevel {
  return value ?? "medium";
}

/**
 * Normalizes required capabilities by deduplicating and trimming whitespace.
 * Empty strings are filtered out.
 */
function normalizeRequiredCapabilities(value: ModelRouteRequest["requiredCapabilities"]): string[] {
  return [...new Set((value ?? []).map((item) => item.trim()).filter((item) => item.length > 0))];
}

// Normalizes optional name fields - trims whitespace, returns null if empty
function normalizeOptionalName(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Normalizes turn ID using the same logic as optional names
function normalizeTurnId(value: string | null | undefined): string | null {
  return normalizeOptionalName(value);
}

/**
 * Validates and normalizes a fallback lease from the request.
 * Throws AppError if the lease format is invalid.
 */
function normalizeFallbackLease(value: ModelRouteRequest["fallbackLease"]): ModelRouteFallbackLease | null {
  if (value == null) {
    return null;
  }
  if (
    typeof value.turnId !== "string"
    || typeof value.primaryProfileName !== "string"
    || typeof value.fallbackProfileName !== "string"
    || typeof value.issuedAt !== "string"
  ) {
    throw new AppError("model_route.invalid_fallback_lease", "model_route.invalid_fallback_lease: Model routing fallback lease is invalid", { category: "provider", source: "provider" });
  }
  if (
    value.reason !== "provider_health_fallback"
    && value.reason !== "cost_cap_fallback"
    && value.reason !== "tier_fallback"
  ) {
    throw new AppError("model_route.invalid_fallback_lease", "model_route.invalid_fallback_lease: Model routing fallback lease is invalid", { category: "provider", source: "provider" });
  }

  const turnId = normalizeTurnId(value.turnId);
  const primaryProfileName = normalizeOptionalName(value.primaryProfileName);
  const fallbackProfileName = normalizeOptionalName(value.fallbackProfileName);
  const issuedAt = value.issuedAt.trim();
  if (turnId == null || primaryProfileName == null || fallbackProfileName == null || issuedAt.length === 0) {
    throw new AppError("model_route.invalid_fallback_lease", "model_route.invalid_fallback_lease: Model routing fallback lease is invalid", { category: "provider", source: "provider" });
  }

  return {
    turnId,
    primaryProfileName,
    fallbackProfileName,
    issuedAt,
    reason: value.reason,
  };
}

/**
 * Normalizes governance snapshot, filtering to valid profile statuses
 * and trimming rollback targets.
 */
function normalizeGovernanceSnapshot(
  value: ModelRouteRequest["governanceSnapshot"],
): ModelGovernanceSnapshot | null {
  if (value == null) {
    return null;
  }
  const profileStatuses = Object.fromEntries(
    Object.entries(value.profileStatuses ?? {}).filter(([, status]) =>
      status === "active" || status === "degraded" || status === "disabled"
    ),
  ) as ModelGovernanceSnapshot["profileStatuses"];
  const rollbackTargets = Object.fromEntries(
    Object.entries(value.rollbackTargets ?? {}).map(([profileName, target]) => [
      profileName,
      typeof target === "string" && target.trim().length > 0 ? target.trim() : null,
    ]),
  ) as ModelGovernanceSnapshot["rollbackTargets"];
  return {
    profileStatuses,
    rollbackTargets,
  };
}

/**
 * Builds the ordered list of tiers to try for a given route class and risk level.
 * Earlier tiers are preferred but later tiers are used as fallbacks.
 */
function buildTargetTierOrder(routeClass: ModelRouteClass, riskLevel: ModelRouteRiskLevel): string[] {
  if (routeClass === "coding") {
    return ["coding", "reasoning", "balanced", "fast"];
  }
  // High risk or reasoning class prefers capable models
  if (routeClass === "reasoning" || riskLevel === "high" || riskLevel === "critical") {
    return ["reasoning", "balanced", "coding", "fast"];
  }
  if (routeClass === "classification") {
    return ["fast", "balanced", "reasoning", "coding"];
  }
  if (routeClass === "writing") {
    return ["balanced", "reasoning", "fast", "coding"];
  }
  // Low risk prefers fast/cheap models
  if (riskLevel === "low") {
    return ["fast", "balanced", "reasoning", "coding"];
  }
  // Default case
  return ["balanced", "fast", "reasoning", "coding"];
}

/**
 * Determines the base route reason based on request parameters.
 * This is the initial reason before any fallbacks are considered.
 */
function determineBaseRouteReason(
  routeClass: ModelRouteClass,
  riskLevel: ModelRouteRiskLevel,
  requiredCapabilities: readonly string[],
): ModelRouteTrace["routeReason"] {
  if (routeClass === "coding") {
    return "coding_required";
  }
  if (routeClass === "reasoning" || riskLevel === "high" || riskLevel === "critical") {
    return "risk_driven_reasoning";
  }
  // Classification with no required capabilities gets cheapest option
  if (routeClass === "classification" && requiredCapabilities.length === 0) {
    return "classification_cheap_default";
  }
  // Default class with low risk gets cheapest option
  if (routeClass === "default" && riskLevel === "low" && requiredCapabilities.length === 0) {
    return "classification_cheap_default";
  }
  if (routeClass === "writing") {
    return "writing_balanced_default";
  }
  // If specific capabilities are required, use capability-driven selection
  if (requiredCapabilities.length > 0) {
    return "capability_driven_selection";
  }
  return "default_balanced";
}

// Type guard to check if route reason is a fallback reason
function isFallbackLeaseReason(
  value: ModelRouteTrace["routeReason"],
): value is ModelRouteFallbackLease["reason"] {
  return value === "provider_health_fallback" || value === "cost_cap_fallback" || value === "tier_fallback";
}

/**
 * Compares two profiles for selection priority.
 * Primary: lower input cost per 1k USD (cheaper)
 * Secondary: higher max output tokens (more capable)
 * Tertiary: alphabetical by name
 */
function compareProfiles(a: EligibleProfile, b: EligibleProfile): number {
  if (a.profile.pricing.inputPer1kUsd !== b.profile.pricing.inputPer1kUsd) {
    return a.profile.pricing.inputPer1kUsd - b.profile.pricing.inputPer1kUsd;
  }
  if (a.profile.maxOutputTokens !== b.profile.maxOutputTokens) {
    return a.profile.maxOutputTokens - b.profile.maxOutputTokens;
  }
  return a.profileName.localeCompare(b.profileName);
}

/**
 * Model Routing Service
 *
 * Selects optimal model profiles based on request parameters, provider health,
 * and governance policies. Issues fallback leases when primary profiles
 * cannot be used due to health, cost, or availability constraints.
 */
export class ModelRoutingService {
  private readonly registry: ModelMetadataRegistry;
  private readonly providerHealth: Record<string, ProviderHealthSummary>;

  public constructor(options: ModelRoutingServiceOptions) {
    this.registry = options.registry;
    this.providerHealth = options.providerHealth ?? {};
  }

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
  public route(request: ModelRouteRequest = {}): ModelRouteDecision {
    const routeClass = normalizeRouteClass(request.routeClass);
    const riskLevel = normalizeRiskLevel(request.riskLevel);
    const requiredCapabilities = normalizeRequiredCapabilities(request.requiredCapabilities);
    const targetTierOrder = buildTargetTierOrder(routeClass, riskLevel);
    const turnId = normalizeTurnId(request.turnId);
    const fallbackLease = normalizeFallbackLease(request.fallbackLease);
    const governanceSnapshot = normalizeGovernanceSnapshot(request.governanceSnapshot);
    const filteredOut: string[] = [];

    const getGovernanceStatus = (
      profileName: string,
    ): ModelRouteTrace["selectedGovernanceStatus"] => governanceSnapshot?.profileStatuses[profileName] ?? "unknown";
    const getGovernanceRollbackTarget = (profileName: string): string | null =>
      governanceSnapshot?.rollbackTargets[profileName] ?? null;

    const eligibleProfiles = Object.entries(this.registry.profiles)
      .map(([profileName, profile]) => ({ profileName, profile }))
      .filter(({ profileName, profile }) => {
        const provider = this.registry.providers[profile.provider];
        if (provider == null) {
          filteredOut.push(`${profileName}:provider_missing`);
          return false;
        }
        if (provider.status === "disabled" || provider.status === "deprecated") {
          filteredOut.push(`${profileName}:provider_${provider.status}`);
          return false;
        }
        if (!requiredCapabilities.every((capability) => profile.capabilities.includes(capability))) {
          filteredOut.push(`${profileName}:capability_mismatch`);
          return false;
        }
        if (getGovernanceStatus(profileName) === "disabled") {
          filteredOut.push(`${profileName}:governance_disabled`);
          return false;
        }
        return true;
      })
      .map<EligibleProfile>(({ profileName, profile }) => ({
        profileName,
        profile,
        providerStatus: this.providerHealth[profile.provider]?.status ?? "unknown",
      }));

    const healthStatuses = Object.fromEntries(
      Object.keys(this.registry.providers).map((providerId) => [
        providerId,
        this.providerHealth[providerId]?.status ?? "unknown",
      ]),
    ) as Record<string, ProviderHealthSummary["status"] | "unknown">;

    const buildTrace = (
      selectedProfileName: string,
      selectedProvider: string,
      reason: ModelRouteTrace["routeReason"],
      fallbackPrimaryProfileName: string | null,
      fallbackProfileName: string | null,
      fallbackActive: boolean,
      fallbackIssued: boolean,
      fallbackAutoRecoveryNextTurn: boolean,
    ): ModelRouteTrace => ({
      routeReason: reason,
      requestedRouteClass: routeClass,
      requestedRiskLevel: riskLevel,
      requiredCapabilities,
      targetTierOrder,
      selectedProfileName,
      selectedProvider,
      preferredProfileName: request.preferredProfileName ?? null,
      pinnedProfileName: request.pinnedProfileName ?? null,
      stickyProfileName: request.stickyProfileName ?? null,
      turnId,
      turnScopedFallbackPrimaryProfileName: fallbackPrimaryProfileName,
      turnScopedFallbackProfileName: fallbackProfileName,
      turnScopedFallbackActive: fallbackActive,
      turnScopedFallbackIssued: fallbackIssued,
      turnScopedFallbackAutoRecoveryNextTurn: fallbackAutoRecoveryNextTurn,
      selectedGovernanceStatus: getGovernanceStatus(selectedProfileName),
      selectedGovernanceRollbackTarget: getGovernanceRollbackTarget(selectedProfileName),
      healthStatuses,
      filteredOut,
    });

    const buildDecision = (
      candidate: EligibleProfile,
      reason: ModelRouteTrace["routeReason"],
      fallback: ModelRouteFallbackLease | null = null,
      traceOverrides?: Partial<Pick<
        ModelRouteTrace,
        | "turnScopedFallbackPrimaryProfileName"
        | "turnScopedFallbackProfileName"
        | "turnScopedFallbackActive"
        | "turnScopedFallbackIssued"
        | "turnScopedFallbackAutoRecoveryNextTurn"
      >>,
    ): ModelRouteDecision => ({
      profileName: candidate.profileName,
      profile: candidate.profile,
      trace: buildTrace(
        candidate.profileName,
        candidate.profile.provider,
        reason,
        traceOverrides?.turnScopedFallbackPrimaryProfileName ?? null,
        traceOverrides?.turnScopedFallbackProfileName ?? null,
        traceOverrides?.turnScopedFallbackActive ?? false,
        traceOverrides?.turnScopedFallbackIssued ?? false,
        traceOverrides?.turnScopedFallbackAutoRecoveryNextTurn ?? false,
      ),
      fallbackLease: fallback,
    });

    const requireProfile = (profileName: string, reason: ModelRouteTrace["routeReason"]): ModelRouteDecision => {
      if (getGovernanceStatus(profileName) === "disabled") {
        throw new AppError(`model_route.profile_governance_disabled:${profileName}`, `model_route.profile_governance_disabled:${profileName}: Model profile ${profileName} is disabled by governance policy`, { category: "policy", source: "provider" });
      }
      const found = eligibleProfiles.find((candidate) => candidate.profileName === profileName);
      if (!found) {
        throw new AppError(`model_route.profile_unavailable:${profileName}`, `model_route.profile_unavailable:${profileName}: Model profile ${profileName} is not available`, { category: "provider", source: "provider" });
      }
      return buildDecision(found, reason);
    };

    const pinnedProfileName = normalizeOptionalName(request.pinnedProfileName);
    if (pinnedProfileName != null) {
      return requireProfile(pinnedProfileName, "pinned_profile");
    }

    const normalHealthProfiles = eligibleProfiles.filter((candidate) => candidate.providerStatus !== "failed");
    const governanceHealthyProfiles = normalHealthProfiles.filter(
      (candidate) => getGovernanceStatus(candidate.profileName) !== "degraded",
    );
    const preferredProfileName = normalizeOptionalName(request.preferredProfileName);
    const stickyProfileName = normalizeOptionalName(request.stickyProfileName);

    const findGovernanceFallbackCandidate = (profileName: string): EligibleProfile | null => {
      const rollbackTarget = getGovernanceRollbackTarget(profileName);
      if (rollbackTarget == null || rollbackTarget === profileName) {
        return null;
      }
      const found = normalHealthProfiles.find((candidate) => candidate.profileName === rollbackTarget) ?? null;
      if (found == null) {
        filteredOut.push(`${profileName}:governance_rollback_target_unavailable`);
      }
      return found;
    };

    const activeTurnFallbackLease =
      turnId != null && fallbackLease != null && fallbackLease.turnId === turnId
        ? fallbackLease
        : null;

    if (activeTurnFallbackLease != null) {
      const leasedFallback =
        normalHealthProfiles.find((candidate) => candidate.profileName === activeTurnFallbackLease.fallbackProfileName)
        ?? eligibleProfiles.find((candidate) => candidate.profileName === activeTurnFallbackLease.fallbackProfileName)
        ?? null;
      if (leasedFallback != null) {
        return buildDecision(
          leasedFallback,
          "turn_scoped_fallback_lease",
          activeTurnFallbackLease,
          {
            turnScopedFallbackPrimaryProfileName: activeTurnFallbackLease.primaryProfileName,
            turnScopedFallbackProfileName: activeTurnFallbackLease.fallbackProfileName,
            turnScopedFallbackActive: true,
            turnScopedFallbackIssued: false,
            turnScopedFallbackAutoRecoveryNextTurn: true,
          },
        );
      }
      filteredOut.push(`${activeTurnFallbackLease.fallbackProfileName}:turn_fallback_unavailable`);
    }

    const pickNamedProfile = (
      profileName: string | null,
      reason: ModelRouteTrace["routeReason"],
    ): ModelRouteDecision | null => {
      if (profileName == null) {
        return null;
      }
      if (getGovernanceStatus(profileName) === "degraded") {
        const governanceFallback = findGovernanceFallbackCandidate(profileName);
        if (governanceFallback != null) {
          return buildDecision(governanceFallback, "governance_fallback");
        }
      }
      const found = normalHealthProfiles.find((candidate) => candidate.profileName === profileName);
      if (found == null) {
        return null;
      }
      return buildDecision(found, reason);
    };

    const sticky = pickNamedProfile(stickyProfileName, "sticky_profile");
    if (sticky != null) {
      return sticky;
    }

    const preferred = pickNamedProfile(preferredProfileName, "preferred_profile");
    if (preferred != null) {
      return preferred;
    }

    const candidatePool =
      governanceHealthyProfiles.length > 0
        ? governanceHealthyProfiles
        : normalHealthProfiles.length > 0
          ? normalHealthProfiles
          : eligibleProfiles;
    if (candidatePool.length === 0) {
      throw new AppError("model_route.no_eligible_profiles", "model_route.no_eligible_profiles: No eligible model profiles found for routing request", { category: "provider", source: "provider" });
    }

    const maxInputPer1kUsd = request.maxInputPer1kUsd ?? null;
    const allowStrongUpgrade = request.allowStrongUpgrade ?? false;
    let routeReason = determineBaseRouteReason(routeClass, riskLevel, requiredCapabilities);

    const chooseByTiers = (tiers: readonly string[]): EligibleProfile | null => {
      for (const tier of tiers) {
        const withinTier = candidatePool
          .filter((candidate) => candidate.profile.tier === tier)
          .sort(compareProfiles);
        const costFiltered = maxInputPer1kUsd == null
          ? withinTier
          : withinTier.filter((candidate) => candidate.profile.pricing.inputPer1kUsd <= maxInputPer1kUsd);
        const source = costFiltered.length > 0 ? costFiltered : withinTier;
        if (source.length > 0) {
          if (maxInputPer1kUsd != null && costFiltered.length === 0) {
            routeReason = "cost_cap_fallback";
          }
          return source[0] ?? null;
        }
      }
      return null;
    };

    let chosen = chooseByTiers(targetTierOrder);

    if (chosen == null && !allowStrongUpgrade) {
      throw new AppError("model_route.no_candidate_for_target_tier", "model_route.no_candidate_for_target_tier: No model candidate found for target tier", { category: "provider", source: "provider" });
    }

    if (chosen == null) {
      chosen = [...candidatePool].sort(compareProfiles)[0] ?? null;
      routeReason = "tier_fallback";
    }

    if (chosen == null) {
      throw new AppError("model_route.no_candidate_after_fallback", "model_route.no_candidate_after_fallback: No model candidate found after fallback", { category: "provider", source: "provider" });
    }

    if (getGovernanceStatus(chosen.profileName) === "degraded") {
      const governanceFallback = findGovernanceFallbackCandidate(chosen.profileName);
      if (governanceFallback != null) {
        chosen = governanceFallback;
        routeReason = "governance_fallback";
      }
    }

    if (
      routeReason !== "governance_fallback"
      && (
      normalHealthProfiles.length === 0 ||
      normalHealthProfiles.length < eligibleProfiles.length ||
      chosen.providerStatus === "degraded"
      )
    ) {
      routeReason = "provider_health_fallback";
    }

    const primaryTurnProfileName = stickyProfileName ?? preferredProfileName;
    const shouldIssueTurnFallbackLease =
      turnId != null
      && primaryTurnProfileName != null
      && primaryTurnProfileName !== chosen.profileName
      && (routeReason === "provider_health_fallback" || routeReason === "cost_cap_fallback" || routeReason === "tier_fallback");
    const issuedTurnFallbackLease = shouldIssueTurnFallbackLease && isFallbackLeaseReason(routeReason)
      ? {
          turnId,
          primaryProfileName: primaryTurnProfileName,
          fallbackProfileName: chosen.profileName,
          issuedAt: new Date().toISOString(),
          reason: routeReason,
        } satisfies ModelRouteFallbackLease
      : null;

    return buildDecision(
      chosen,
      routeReason,
      issuedTurnFallbackLease,
      {
        turnScopedFallbackPrimaryProfileName: issuedTurnFallbackLease?.primaryProfileName ?? null,
        turnScopedFallbackProfileName: issuedTurnFallbackLease?.fallbackProfileName ?? null,
        turnScopedFallbackActive: false,
        turnScopedFallbackIssued: issuedTurnFallbackLease != null,
        turnScopedFallbackAutoRecoveryNextTurn: issuedTurnFallbackLease != null,
      },
    );
  }
}
