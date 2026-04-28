export interface ModelFallbackCandidate {
  profileName: string;
  provider: string;
  tier: "fast" | "balanced" | "reasoning" | "coding";
  healthy: boolean;
  inputCostPer1kUsd: number;
  /** Priority for fallback ordering (lower = higher priority) */
  fallbackPriority?: number;
}

export interface ModelFallbackDecision {
  selectedProfileName: string | null;
  reasonCode: string;
  degradedFromProfileName: string | null;
  attemptedProfiles: string[];
  /** The fallback chain used for this selection */
  fallbackChain: string[];
}

/**
 * Default fallback chain order per §15.4: primary → secondary → tertiary
 * This is the ordered fallback chain for model selection.
 */
export const FALLBACK_CHAIN_ORDER = ["primary", "secondary", "tertiary"] as const;
export type FallbackChainPosition = (typeof FALLBACK_CHAIN_ORDER)[number];

export class ModelGatewayFallbackService {
  /**
   * Selects a fallback model using an ordered fallback chain.
   * §15.4: Fallback selects in order: primary → secondary → tertiary
   * Only selects from healthy providers in priority order.
   */
  public selectFallback(input: {
    primaryProfileName: string;
    candidates: ModelFallbackCandidate[];
    excludedProfiles?: readonly string[];
    maxInputCostPer1kUsd?: number | null;
  }): ModelFallbackDecision {
    const excluded = new Set(input.excludedProfiles ?? []);
    const attemptedProfiles: string[] = [];

    // Build ordered fallback chain from candidates
    // Sort by fallback priority (if provided), then by cost
    const sortedCandidates = [...input.candidates]
      .filter((candidate) =>
        candidate.profileName !== input.primaryProfileName
        && !excluded.has(candidate.profileName)
        && candidate.healthy
        && (input.maxInputCostPer1kUsd == null || candidate.inputCostPer1kUsd <= input.maxInputCostPer1kUsd)
      )
      .sort((a, b) => {
        // First priority: fallbackPriority if available
        if (a.fallbackPriority !== undefined && b.fallbackPriority !== undefined) {
          return a.fallbackPriority - b.fallbackPriority;
        }
        if (a.fallbackPriority !== undefined) {
          return -1; // Candidates with priority come first
        }
        if (b.fallbackPriority !== undefined) {
          return 1;
        }
        // Second priority: tier order (reasoning > balanced > coding > fast)
        const tierOrder: Record<string, number> = { reasoning: 0, balanced: 1, coding: 2, fast: 3 };
        const tierDiff = (tierOrder[a.tier] ?? 99) - (tierOrder[b.tier] ?? 99);
        if (tierDiff !== 0) {
          return tierDiff;
        }
        // Third priority: cost (cheapest)
        return a.inputCostPer1kUsd - b.inputCostPer1kUsd;
      });

    // Build the fallback chain
    const fallbackChain = [input.primaryProfileName];
    for (const candidate of sortedCandidates) {
      if (!fallbackChain.includes(candidate.profileName)) {
        fallbackChain.push(candidate.profileName);
      }
    }

    // Select the first available candidate (highest priority healthy one)
    const selected = sortedCandidates[0] ?? null;

    // Record all attempted profiles
    attemptedProfiles.push(...sortedCandidates.map((c) => c.profileName));

    return {
      selectedProfileName: selected?.profileName ?? null,
      reasonCode: selected == null
        ? "fallback.no_candidate_available"
        : `fallback.healthy_alternative_selected:${fallbackChain.indexOf(selected.profileName) + 1}`,
      degradedFromProfileName: input.primaryProfileName,
      attemptedProfiles,
      fallbackChain,
    };
  }
}
