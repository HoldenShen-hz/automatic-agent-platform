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

import type { ModelMetadataRegistry, ModelProfileMetadata } from "../../five-plane-control-plane/config-center/model-metadata-registry.js";
import type { ProviderHealthSummary } from "../../shared/observability/provider-health-tracker.js";
import type { ModelGovernanceSnapshot } from "../../contracts/types/governance.js";
import { AppError } from "../../contracts/errors.js";
import type {
  ModelRouteClass,
  ModelRouteDecision,
  ModelRouteFallbackLease,
  ModelRouteRequest,
  ModelRouteRiskLevel,
  ModelRouteTrace,
  ModelRoutingServiceOptions,
  RouteFailureCode,
} from "./model-routing-types.js";
export type {
  ModelRouteClass,
  ModelRouteDecision,
  ModelRouteFallbackLease,
  ModelRoutePurpose,
  ModelRouteRequest,
  ModelRouteRiskLevel,
  ModelRouteTrace,
  ModelRoutingServiceOptions,
  ModelRoutingStrategy,
  RouteFailureCode,
} from "./model-routing-types.js";

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

function normalizeRouteClassFromCanonicalRequest(request: ModelRouteRequest): ModelRouteClass {
  if (request.routeClass != null) {
    return normalizeRouteClass(request.routeClass);
  }
  switch (request.purpose) {
    case "plan":
    case "evaluate":
      return "reasoning";
    case "summarize":
      return "writing";
    case "execute":
      return request.requiredCapabilities?.includes("coding") ? "coding" : "default";
    case "chat":
    default:
      return "default";
  }
}

function normalizeRiskLevelFromCanonicalRequest(request: ModelRouteRequest): ModelRouteRiskLevel {
  if (request.riskLevel != null) {
    return normalizeRiskLevel(request.riskLevel);
  }
  switch (request.routingStrategy) {
    case "compliance_constrained":
      return "critical";
    case "quality_optimized":
      return "high";
    case "latency_optimized":
      return "low";
    case "cost_optimized":
      return "low";
    case "hybrid":
    default:
      return "medium";
  }
}

function resolvePreferredProfileName(request: ModelRouteRequest): string | null {
  return normalizeOptionalName(request.preferredProfileName ?? request.preferredModel);
}

function resolveMaxInputPer1kUsd(request: ModelRouteRequest): number | null {
  if (typeof request.maxInputPer1kUsd === "number") {
    return request.maxInputPer1kUsd;
  }
  if (typeof request.maxCostUsd === "number") {
    return request.maxCostUsd;
  }
  return null;
}

function resolveRoutingReasons(
  reason: ModelRouteTrace["routeReason"],
  candidate: EligibleProfile,
  request: ModelRouteRequest,
): string[] {
  const reasons = [
    reason,
    `provider:${candidate.profile.provider}`,
    `tier:${candidate.profile.tier}`,
  ];
  if (request.routingStrategy != null) {
    reasons.push(`routing_strategy:${request.routingStrategy}`);
  }
  if (request.purpose != null) {
    reasons.push(`purpose:${request.purpose}`);
  }
  if (request.maxLatencyMs != null) {
    reasons.push(`latency_guard:${request.maxLatencyMs}`);
  }
  if (request.maxCostUsd != null || request.maxInputPer1kUsd != null) {
    reasons.push(`cost_guard:${request.maxCostUsd ?? request.maxInputPer1kUsd}`);
  }
  return reasons;
}

function resolveAuthProfileId(
  registry: ModelMetadataRegistry,
  providerId: string,
): string {
  const authMethod = registry.providers[providerId]?.authMethods[0] ?? "default";
  return `${providerId}:${authMethod}`;
}

export function classifyModelRoutingFailure(error: unknown): RouteFailureCode | null {
  if (!(error instanceof AppError)) {
    return null;
  }
  if (error.code.includes("capability")) {
    return "route.capability_mismatch";
  }
  if (error.code.includes("governance") || error.code.includes("policy")) {
    return "route.policy_denied";
  }
  if (error.code.includes("cost_cap")) {
    return "route.cost_guard";
  }
  if (error.code.includes("provider_health") || error.code.includes("cooldown")) {
    return "route.provider_cooldown";
  }
  if (error.code.startsWith("model_route.")) {
    return "route.no_candidate";
  }
  return null;
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
    return b.profile.maxOutputTokens - a.profile.maxOutputTokens;
  }
  return a.profileName.localeCompare(b.profileName);
}

function resolveLatencySloTargetMs(
  routeClass: ModelRouteClass,
  riskLevel: ModelRouteRiskLevel,
  explicitTarget: number | null | undefined,
): number {
  if (typeof explicitTarget === "number" && explicitTarget > 0) {
    return explicitTarget;
  }
  if (routeClass === "classification") {
    return riskLevel === "high" || riskLevel === "critical" ? 1500 : 1000;
  }
  if (routeClass === "coding" || routeClass === "reasoning") {
    return 5000;
  }
  if (routeClass === "writing") {
    return 2500;
  }
  return 2000;
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
  private readonly persistence: ModelRoutingServiceOptions["persistence"];

  public constructor(options: ModelRoutingServiceOptions) {
    this.registry = options.registry;
    this.providerHealth = options.providerHealth ?? {};
    this.persistence = options.persistence;
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
    const routeClass = normalizeRouteClassFromCanonicalRequest(request);
    const riskLevel = normalizeRiskLevelFromCanonicalRequest(request);
    const requiredCapabilities = normalizeRequiredCapabilities(request.requiredCapabilities);
    const targetTierOrder = buildTargetTierOrder(routeClass, riskLevel);
    const turnId = normalizeTurnId(request.turnId ?? request.requestId ?? request.sessionId);
    const fallbackLease = normalizeFallbackLease(request.fallbackLease);
    const governanceSnapshot = normalizeGovernanceSnapshot(request.governanceSnapshot);
    const dataResidency = normalizeOptionalName(request.data_residency);
    const piiInputDetected = request.pii_input_detected === true;
    const piiOutputPossible = request.pii_output_possible === true;
    const modelTrainingOptOut = request.model_training_opt_out === true;
    const judgeIndependence = request.judge_independence === true;
    const latencySloTargetMs = resolveLatencySloTargetMs(routeClass, riskLevel, request.maxLatencyMs ?? request.latency_slo_target_ms);
    const pinnedProfileName = normalizeOptionalName(request.pinnedProfileName);
    const preferredProfileName = resolvePreferredProfileName(request);
    const stickyProfileName = normalizeOptionalName(request.stickyProfileName);
    const maxInputPer1kUsd = resolveMaxInputPer1kUsd(request);
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
        if (
          dataResidency != null
          && (profile.region != null || provider.region != null)
          && profile.region !== dataResidency
          && provider.region !== dataResidency
        ) {
          filteredOut.push(`${profileName}:data_residency_mismatch`);
          return false;
        }
        if (piiInputDetected && profile.piiSafe === false) {
          filteredOut.push(`${profileName}:pii_unsafe`);
          return false;
        }
        if (piiOutputPossible && profile.piiSafe === false) {
          filteredOut.push(`${profileName}:pii_output_governance_missing`);
          return false;
        }
        if (modelTrainingOptOut && profile.trainingOptOutSupported === false) {
          filteredOut.push(`${profileName}:training_opt_out_unsupported`);
          return false;
        }
        if (judgeIndependence && profile.judgeIndependent !== true) {
          filteredOut.push(`${profileName}:judge_independence_missing`);
          return false;
        }
        // Explicit latency limits are hard constraints. Default SLO targets are
        // recorded as routing evidence but must not eliminate otherwise valid
        // profiles, or residency/safety routing can dead-end.
        const profileLatencyP99Ms = profile.latencyP99Ms ?? this.registry.providers[profile.provider]?.latencyP99Ms ?? null;
        const hasExplicitLatencyLimit = request.maxLatencyMs != null || request.latency_slo_target_ms != null;
        if (hasExplicitLatencyLimit && profileLatencyP99Ms != null && profileLatencyP99Ms > latencySloTargetMs) {
          filteredOut.push(`${profileName}:latency_slo_exceeded:${profileLatencyP99Ms}ms>${latencySloTargetMs}ms`);
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
      preferredProfileName,
      pinnedProfileName,
      stickyProfileName,
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
    ): ModelRouteDecision => {
      const decision: ModelRouteDecision = {
        profileName: candidate.profileName,
        profile: candidate.profile,
        providerId: candidate.profile.provider,
        modelId: candidate.profile.modelId,
        authProfileId: resolveAuthProfileId(this.registry, candidate.profile.provider),
        fallbackChain: fallback == null ? [candidate.profileName] : [fallback.primaryProfileName, fallback.fallbackProfileName],
        stickySession: request.sessionId != null || stickyProfileName != null,
        decisionReason: resolveRoutingReasons(reason, candidate, request),
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
      };
      this.persistence?.persistRoutingDecision({
        profileName: candidate.profileName,
        provider: candidate.profile.provider,
        dataResidencyMet: dataResidency == null || candidate.profile.region === dataResidency || this.registry.providers[candidate.profile.provider]?.region === dataResidency,
        latencySloTargetMs,
        latencyP99Ms: candidate.profile.latencyP99Ms ?? this.registry.providers[candidate.profile.provider]?.latencyP99Ms ?? null,
        piiSafe: candidate.profile.piiSafe === true,
        piiOutputGoverned: !piiOutputPossible || candidate.profile.piiSafe === true,
        trainingOptOutSupported: candidate.profile.trainingOptOutSupported === true,
        judgeIndependent: candidate.profile.judgeIndependent === true,
        occurredAt: new Date().toISOString(),
      });
      return decision;
    };

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

    if (pinnedProfileName != null) {
      return requireProfile(pinnedProfileName, "pinned_profile");
    }

    const normalHealthProfiles = eligibleProfiles.filter((candidate) => candidate.providerStatus !== "failed");
    const governanceHealthyProfiles = normalHealthProfiles.filter(
      (candidate) => getGovernanceStatus(candidate.profileName) !== "degraded",
    );
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
      if (maxInputPer1kUsd != null && found.profile.pricing.inputPer1kUsd > maxInputPer1kUsd) {
        filteredOut.push(`${profileName}:cost_cap_exceeded`);
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

    for (const tier of targetTierOrder) {
      const degradedWithRollback = normalHealthProfiles
        .filter((candidate) => candidate.profile.tier === tier && getGovernanceStatus(candidate.profileName) === "degraded")
        .sort(compareProfiles)
        .map((candidate) => ({
          primary: candidate,
          fallback: findGovernanceFallbackCandidate(candidate.profileName),
        }))
        .find((candidate) => candidate.fallback != null);
      if (degradedWithRollback?.fallback != null) {
        return buildDecision(degradedWithRollback.fallback, "governance_fallback");
      }
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

    const allowStrongUpgrade = request.allowStrongUpgrade ?? false;
    let routeReason = determineBaseRouteReason(routeClass, riskLevel, requiredCapabilities);
    let costCapFallbackTriggered = false;

    const chooseByTiers = (tiers: readonly string[]): EligibleProfile | null => {
      let costFallbackCandidate: EligibleProfile | null = null;
      for (const tier of tiers) {
        const withinTier = candidatePool
          .filter((candidate) => candidate.profile.tier === tier)
          .sort(compareProfiles);
        const costFiltered = maxInputPer1kUsd == null
          ? withinTier
          : withinTier.filter((candidate) => candidate.profile.pricing.inputPer1kUsd <= maxInputPer1kUsd);
        const source = costFiltered;
        if (maxInputPer1kUsd != null && withinTier.length > 0 && costFiltered.length === 0) {
          costCapFallbackTriggered = true;
          costFallbackCandidate ??= withinTier[0] ?? null;
        }
        if (source.length > 0) {
          if (costCapFallbackTriggered || (maxInputPer1kUsd != null && costFiltered.length < withinTier.length)) {
            routeReason = "cost_cap_fallback";
          }
          return source[0] ?? null;
        }
      }
      if (costFallbackCandidate != null) {
        routeReason = "cost_cap_fallback";
      }
      return costFallbackCandidate;
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
