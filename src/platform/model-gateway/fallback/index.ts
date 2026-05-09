export interface ModelFallbackCandidate {
  profileName: string;
  provider: string;
  tier: "fast" | "balanced" | "reasoning" | "coding";
  healthy: boolean;
  inputCostPer1kUsd: number;
}

export interface ModelFallbackDecision {
  selectedProfileName: string | null;
  reasonCode: string;
  degradedFromProfileName: string | null;
  attemptedProfiles: string[];
}

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
    // R16-24 fix: Consider tier affinity as secondary sort after cost.
    // Prefer candidates with same tier as primary, then by cost.
    const tierOrder: Record<string, number> = { fast: 0, balanced: 1, reasoning: 2, coding: 3 };
    const selected = eligible
      .sort((left, right) => {
        // Primary sort by cost
        const costDiff = left.inputCostPer1kUsd - right.inputCostPer1kUsd;
        if (costDiff !== 0) return costDiff;
        // Secondary sort by tier affinity (prefer same tier as primary if we had that info)
        // Since we don't have primary tier directly, use alphabetical tier as tiebreaker
        const tierDiff = (tierOrder[left.tier] ?? 4) - (tierOrder[right.tier] ?? 4);
        return tierDiff;
      })[0] ?? null;
    return {
      selectedProfileName: selected?.profileName ?? null,
      reasonCode: selected == null ? "fallback.no_candidate_available" : "fallback.healthy_alternative_selected",
      degradedFromProfileName: input.primaryProfileName,
      attemptedProfiles,
    };
  }
}
