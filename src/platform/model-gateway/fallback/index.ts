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

export class ModelGatewayFallbackService {
  public selectFallback(input: {
    primaryProfileName: string;
    candidates: ModelFallbackCandidate[];
    excludedProfiles?: readonly string[];
    maxInputCostPer1kUsd?: number | null;
  }): ModelFallbackDecision {
    const excluded = new Set(input.excludedProfiles ?? []);
    const attemptedProfiles = input.candidates.map((candidate) => candidate.profileName);
    const eligible = input.candidates.filter((candidate) =>
      candidate.profileName !== input.primaryProfileName
      && !excluded.has(candidate.profileName)
      && candidate.healthy
      && (input.maxInputCostPer1kUsd == null || candidate.inputCostPer1kUsd <= input.maxInputCostPer1kUsd)
    );
    // R16-24 fix: Consider tier affinity and fallbackPriority in selection.
    // Priority: 1) fallbackPriority (lower = higher priority), 2) cost, 3) tier affinity
    const tierOrder: Record<string, number> = { fast: 0, balanced: 1, reasoning: 2, coding: 3 };
    const sorted = [...eligible].sort((left, right) => {
      // Primary sort by fallbackPriority if specified
      if (left.fallbackPriority !== undefined && right.fallbackPriority !== undefined) {
        const priorityDiff = left.fallbackPriority - right.fallbackPriority;
        if (priorityDiff !== 0) return priorityDiff;
      } else if (left.fallbackPriority !== undefined) {
        return -1; // left has priority, right doesn't
      } else if (right.fallbackPriority !== undefined) {
        return 1; // right has priority, left doesn't
      }
      // Secondary sort by cost
      const costDiff = left.inputCostPer1kUsd - right.inputCostPer1kUsd;
      if (costDiff !== 0) return costDiff;
      // Tertiary sort by tier order
      const tierDiff = (tierOrder[left.tier] ?? 4) - (tierOrder[right.tier] ?? 4);
      return tierDiff;
    });
    const selected = sorted[0] ?? null;
    // R16-24 fix: Build fallbackChain with primary first, then sorted candidates
    const fallbackChain = [input.primaryProfileName, ...sorted.map((c) => c.profileName)];
    return {
      selectedProfileName: selected?.profileName ?? null,
      reasonCode: selected == null ? "fallback.no_candidate_available" : "fallback.healthy_alternative_selected",
      degradedFromProfileName: input.primaryProfileName,
      attemptedProfiles,
      fallbackChain,
    };
  }
}
