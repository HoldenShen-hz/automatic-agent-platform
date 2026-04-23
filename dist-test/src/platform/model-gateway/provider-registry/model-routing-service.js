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
import { AppError } from "../../contracts/errors.js";
// Normalizes route class with default fallback to "default"
function normalizeRouteClass(value) {
    return value ?? "default";
}
// Normalizes risk level with default fallback to "medium"
function normalizeRiskLevel(value) {
    return value ?? "medium";
}
/**
 * Normalizes required capabilities by deduplicating and trimming whitespace.
 * Empty strings are filtered out.
 */
function normalizeRequiredCapabilities(value) {
    return [...new Set((value ?? []).map((item) => item.trim()).filter((item) => item.length > 0))];
}
// Normalizes optional name fields - trims whitespace, returns null if empty
function normalizeOptionalName(value) {
    if (value == null) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
// Normalizes turn ID using the same logic as optional names
function normalizeTurnId(value) {
    return normalizeOptionalName(value);
}
/**
 * Validates and normalizes a fallback lease from the request.
 * Throws AppError if the lease format is invalid.
 */
function normalizeFallbackLease(value) {
    if (value == null) {
        return null;
    }
    if (typeof value.turnId !== "string"
        || typeof value.primaryProfileName !== "string"
        || typeof value.fallbackProfileName !== "string"
        || typeof value.issuedAt !== "string") {
        throw new AppError("model_route.invalid_fallback_lease", "model_route.invalid_fallback_lease: Model routing fallback lease is invalid", { category: "provider", source: "provider" });
    }
    if (value.reason !== "provider_health_fallback"
        && value.reason !== "cost_cap_fallback"
        && value.reason !== "tier_fallback") {
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
function normalizeGovernanceSnapshot(value) {
    if (value == null) {
        return null;
    }
    const profileStatuses = Object.fromEntries(Object.entries(value.profileStatuses ?? {}).filter(([, status]) => status === "active" || status === "degraded" || status === "disabled"));
    const rollbackTargets = Object.fromEntries(Object.entries(value.rollbackTargets ?? {}).map(([profileName, target]) => [
        profileName,
        typeof target === "string" && target.trim().length > 0 ? target.trim() : null,
    ]));
    return {
        profileStatuses,
        rollbackTargets,
    };
}
/**
 * Builds the ordered list of tiers to try for a given route class and risk level.
 * Earlier tiers are preferred but later tiers are used as fallbacks.
 */
function buildTargetTierOrder(routeClass, riskLevel) {
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
function determineBaseRouteReason(routeClass, riskLevel, requiredCapabilities) {
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
function isFallbackLeaseReason(value) {
    return value === "provider_health_fallback" || value === "cost_cap_fallback" || value === "tier_fallback";
}
/**
 * Compares two profiles for selection priority.
 * Primary: lower input cost per 1k USD (cheaper)
 * Secondary: higher max output tokens (more capable)
 * Tertiary: alphabetical by name
 */
function compareProfiles(a, b) {
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
    registry;
    providerHealth;
    constructor(options) {
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
    route(request = {}) {
        const routeClass = normalizeRouteClass(request.routeClass);
        const riskLevel = normalizeRiskLevel(request.riskLevel);
        const requiredCapabilities = normalizeRequiredCapabilities(request.requiredCapabilities);
        const targetTierOrder = buildTargetTierOrder(routeClass, riskLevel);
        const turnId = normalizeTurnId(request.turnId);
        const fallbackLease = normalizeFallbackLease(request.fallbackLease);
        const governanceSnapshot = normalizeGovernanceSnapshot(request.governanceSnapshot);
        const filteredOut = [];
        const getGovernanceStatus = (profileName) => governanceSnapshot?.profileStatuses[profileName] ?? "unknown";
        const getGovernanceRollbackTarget = (profileName) => governanceSnapshot?.rollbackTargets[profileName] ?? null;
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
            .map(({ profileName, profile }) => ({
            profileName,
            profile,
            providerStatus: this.providerHealth[profile.provider]?.status ?? "unknown",
        }));
        const healthStatuses = Object.fromEntries(Object.keys(this.registry.providers).map((providerId) => [
            providerId,
            this.providerHealth[providerId]?.status ?? "unknown",
        ]));
        const buildTrace = (selectedProfileName, selectedProvider, reason, fallbackPrimaryProfileName, fallbackProfileName, fallbackActive, fallbackIssued, fallbackAutoRecoveryNextTurn) => ({
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
        const buildDecision = (candidate, reason, fallback = null, traceOverrides) => ({
            profileName: candidate.profileName,
            profile: candidate.profile,
            trace: buildTrace(candidate.profileName, candidate.profile.provider, reason, traceOverrides?.turnScopedFallbackPrimaryProfileName ?? null, traceOverrides?.turnScopedFallbackProfileName ?? null, traceOverrides?.turnScopedFallbackActive ?? false, traceOverrides?.turnScopedFallbackIssued ?? false, traceOverrides?.turnScopedFallbackAutoRecoveryNextTurn ?? false),
            fallbackLease: fallback,
        });
        const requireProfile = (profileName, reason) => {
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
        const governanceHealthyProfiles = normalHealthProfiles.filter((candidate) => getGovernanceStatus(candidate.profileName) !== "degraded");
        const preferredProfileName = normalizeOptionalName(request.preferredProfileName);
        const stickyProfileName = normalizeOptionalName(request.stickyProfileName);
        const findGovernanceFallbackCandidate = (profileName) => {
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
        const activeTurnFallbackLease = turnId != null && fallbackLease != null && fallbackLease.turnId === turnId
            ? fallbackLease
            : null;
        if (activeTurnFallbackLease != null) {
            const leasedFallback = normalHealthProfiles.find((candidate) => candidate.profileName === activeTurnFallbackLease.fallbackProfileName)
                ?? eligibleProfiles.find((candidate) => candidate.profileName === activeTurnFallbackLease.fallbackProfileName)
                ?? null;
            if (leasedFallback != null) {
                return buildDecision(leasedFallback, "turn_scoped_fallback_lease", activeTurnFallbackLease, {
                    turnScopedFallbackPrimaryProfileName: activeTurnFallbackLease.primaryProfileName,
                    turnScopedFallbackProfileName: activeTurnFallbackLease.fallbackProfileName,
                    turnScopedFallbackActive: true,
                    turnScopedFallbackIssued: false,
                    turnScopedFallbackAutoRecoveryNextTurn: true,
                });
            }
            filteredOut.push(`${activeTurnFallbackLease.fallbackProfileName}:turn_fallback_unavailable`);
        }
        const pickNamedProfile = (profileName, reason) => {
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
        const candidatePool = governanceHealthyProfiles.length > 0
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
        const chooseByTiers = (tiers) => {
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
        if (routeReason !== "governance_fallback"
            && (normalHealthProfiles.length === 0 ||
                normalHealthProfiles.length < eligibleProfiles.length ||
                chosen.providerStatus === "degraded")) {
            routeReason = "provider_health_fallback";
        }
        const primaryTurnProfileName = stickyProfileName ?? preferredProfileName;
        const shouldIssueTurnFallbackLease = turnId != null
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
            }
            : null;
        return buildDecision(chosen, routeReason, issuedTurnFallbackLease, {
            turnScopedFallbackPrimaryProfileName: issuedTurnFallbackLease?.primaryProfileName ?? null,
            turnScopedFallbackProfileName: issuedTurnFallbackLease?.fallbackProfileName ?? null,
            turnScopedFallbackActive: false,
            turnScopedFallbackIssued: issuedTurnFallbackLease != null,
            turnScopedFallbackAutoRecoveryNextTurn: issuedTurnFallbackLease != null,
        });
    }
}
//# sourceMappingURL=model-routing-service.js.map