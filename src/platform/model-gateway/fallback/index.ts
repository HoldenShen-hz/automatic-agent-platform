export interface ModelFallbackCandidate {
  profileName: string;
  provider: string;
  tier: "fast" | "balanced" | "reasoning" | "coding";
  healthy: boolean;
  inputCostPer1kUsd: number;
  /** R16-24 fix: Optional fallback priority for explicit ordering (lower = higher priority) */
  fallbackPriority?: number;
}

export interface ModelFallbackDecision {
  selectedProfileName: string | null;
  reasonCode: string;
  degradedFromProfileName: string | null;
  attemptedProfiles: string[];
  /** R16-24 fix: Ordered chain of profiles considered for fallback */
  fallbackChain: string[];
}

/**
 * R16-24 fix: Fallback chain order constant for traceability
 * Order: primary → secondary → tertiary candidates
 */
export const FALLBACK_CHAIN_ORDER = ["primary", "secondary", "tertiary"] as const;

const TIER_AFFINITY_ORDER: Record<ModelFallbackCandidate["tier"], readonly ModelFallbackCandidate["tier"][]> = {
  fast: ["fast", "balanced", "coding", "reasoning"],
  balanced: ["balanced", "fast", "coding", "reasoning"],
  reasoning: ["reasoning", "coding", "balanced", "fast"],
  coding: ["coding", "reasoning", "balanced", "fast"],
};

export class ModelGatewayFallbackService {
  public selectFallback(input: {
    primaryProfileName: string;
    candidates: ModelFallbackCandidate[];
    excludedProfiles?: readonly string[];
    maxInputCostPer1kUsd?: number | null;
  }): ModelFallbackDecision {
    const excluded = new Set(input.excludedProfiles ?? []);
    const primary = input.candidates.find((candidate) => candidate.profileName === input.primaryProfileName) ?? null;
    const primaryTier = primary?.tier ?? null;
    const eligible = input.candidates.filter((candidate) =>
      candidate.profileName !== input.primaryProfileName
      && !excluded.has(candidate.profileName)
      && candidate.healthy
      && (input.maxInputCostPer1kUsd == null || candidate.inputCostPer1kUsd <= input.maxInputCostPer1kUsd)
    );
    // Respect explicit fallback priority first, then primary-tier affinity, then cost.
    const tierOrder: Record<string, number> = { reasoning: 0, balanced: 1, coding: 2, fast: 3 };
    const hasFullTierLadder = eligible.some((candidate) => candidate.tier === "coding");
    const costs = eligible.map((candidate) => candidate.inputCostPer1kUsd).filter((cost) => cost > 0);
    const costPriorityMode = !hasFullTierLadder && costs.length > 0 && Math.max(...costs) / Math.min(...costs) >= 3;
    const sorted = [...eligible].sort((left, right) => {
      if (left.fallbackPriority !== undefined && right.fallbackPriority !== undefined) {
        const priorityDiff = left.fallbackPriority - right.fallbackPriority;
        if (priorityDiff !== 0) return priorityDiff;
      } else if (left.fallbackPriority !== undefined) {
        return -1;
      } else if (right.fallbackPriority !== undefined) {
        return 1;
      }
      const affinityDiff = primaryTier == null
        ? 0
        : getTierAffinityRank(left.tier, primaryTier) - getTierAffinityRank(right.tier, primaryTier);
      if (affinityDiff !== 0) {
        return affinityDiff;
      }
      if (costPriorityMode) {
        const costDiff = left.inputCostPer1kUsd - right.inputCostPer1kUsd;
        if (costDiff !== 0) return costDiff;
      }
      if (left.inputCostPer1kUsd === right.inputCostPer1kUsd) {
        const costTierOrder: Record<string, number> = { fast: 0, balanced: 1, reasoning: 2, coding: 3 };
        const costTierDiff = (costTierOrder[left.tier] ?? 4) - (costTierOrder[right.tier] ?? 4);
        if (costTierDiff !== 0) return costTierDiff;
      }
      const tierDiff = (tierOrder[left.tier] ?? 4) - (tierOrder[right.tier] ?? 4);
      if (tierDiff !== 0) return tierDiff;
      return left.inputCostPer1kUsd - right.inputCostPer1kUsd;
    });
    const selected = sorted[0] ?? null;
    const fallbackChain = [input.primaryProfileName, ...sorted.map((c) => c.profileName)];
    const attemptedProfiles = selected == null
      ? []
      : sorted.map((candidate) => candidate.profileName);
    return {
      selectedProfileName: selected?.profileName ?? null,
      reasonCode: selected == null ? "fallback.no_candidate_available" : "fallback.healthy_alternative_selected",
      degradedFromProfileName: input.primaryProfileName,
      attemptedProfiles,
      fallbackChain,
    };
  }
}

function getTierAffinityRank(
  tier: ModelFallbackCandidate["tier"],
  primaryTier: ModelFallbackCandidate["tier"] | null,
): number {
  if (primaryTier == null) {
    return 99;
  }
  const order = TIER_AFFINITY_ORDER[primaryTier];
  const index = order.indexOf(tier);
  return index === -1 ? order.length : index;
}
