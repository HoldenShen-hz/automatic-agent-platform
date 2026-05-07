export interface ModelFallbackCandidate {
  profileName: string;
  provider: string;
  tier: "fast" | "balanced" | "reasoning" | "coding";
  healthy: boolean;
  inputCostPer1kUsd: number;
  /** Priority for fallback ordering within a tier (lower = higher priority) */
  fallbackPriority?: number;
  /**
   * Position in the fallback chain per §15.4.
   * If not specified, candidates are assigned based on fallbackPriority tiers:
   * - Priority 0-99: primary tier
   * - Priority 100-199: secondary tier
   * - Priority 200+: tertiary tier
   */
  fallbackChainPosition?: FallbackChainPosition;
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
   * Only proceeds to next tier if current tier has no healthy candidates.
   * Within each tier, selects the cheapest healthy candidate.
   */
  public selectFallback(input: {
    primaryProfileName: string;
    candidates: ModelFallbackCandidate[];
    excludedProfiles?: readonly string[];
    maxInputCostPer1kUsd?: number | null;
  }): ModelFallbackDecision {
    const excluded = new Set(input.excludedProfiles ?? []);
    const attemptedProfiles: string[] = [];

    // Helper to check if a candidate is viable
    const isViable = (candidate: ModelFallbackCandidate): boolean => {
      return candidate.profileName !== input.primaryProfileName
        && !excluded.has(candidate.profileName)
        && candidate.healthy
        && (input.maxInputCostPer1kUsd == null || candidate.inputCostPer1kUsd <= input.maxInputCostPer1kUsd);
    };

    // Helper to get the chain position for a candidate
    // Candidates with explicit fallbackChainPosition use it directly
    // Otherwise, infer from fallbackPriority ranges
    const getChainPosition = (candidate: ModelFallbackCandidate): FallbackChainPosition => {
      if (candidate.fallbackChainPosition) {
        return candidate.fallbackChainPosition;
      }
      if (candidate.fallbackPriority !== undefined) {
        if (candidate.fallbackPriority < 100) {
          return "primary";
        }
        if (candidate.fallbackPriority < 200) {
          return "secondary";
        }
        return "tertiary";
      }
      // Default: infer from profile name patterns
      const name = candidate.profileName.toLowerCase();
      if (name.includes("primary") || name.includes("fast")) {
        return "primary";
      }
      if (name.includes("secondary") || name.includes("balanced")) {
        return "secondary";
      }
      return "tertiary";
    };

    // Helper to get the sort key within a tier (cheapest first)
    const getSortKey = (candidate: ModelFallbackCandidate): number => {
      return candidate.fallbackPriority ?? candidate.inputCostPer1kUsd;
    };

    // Group candidates by their fallback chain position
    const candidatesByTier = new Map<FallbackChainPosition, ModelFallbackCandidate[]>();
    for (const position of FALLBACK_CHAIN_ORDER) {
      candidatesByTier.set(position, []);
    }

    for (const candidate of input.candidates) {
      const position = getChainPosition(candidate);
      candidatesByTier.get(position)!.push(candidate);
    }

    // Build the fallback chain in order: primary → secondary → tertiary
    const fallbackChain: string[] = [input.primaryProfileName];
    const chainTiers: FallbackChainPosition[] = [];

    // Track which tiers we've attempted
    const attemptedTiers = new Set<FallbackChainPosition>();

    // Process each tier in order
    for (const tier of FALLBACK_CHAIN_ORDER) {
      const tierCandidates = candidatesByTier.get(tier)!.filter(isViable);

      if (tierCandidates.length > 0) {
        // Sort by cost (or fallbackPriority) within the tier
        tierCandidates.sort((a, b) => getSortKey(a) - getSortKey(b));
        const bestCandidate = tierCandidates[0];

        // Add this tier's best candidate to the chain if not already present
        if (!fallbackChain.includes(bestCandidate.profileName)) {
          fallbackChain.push(bestCandidate.profileName);
          chainTiers.push(tier);
        }
      }

      attemptedTiers.add(tier);
    }

    // Now select using ordered fallback: primary → secondary → tertiary
    // Only proceed to next tier if current tier has no healthy candidates
    let selected: ModelFallbackCandidate | null = null;
    let selectedTier: FallbackChainPosition = "primary";

    // Step 1: Check if primary profile itself is viable
    const primaryCandidate = input.candidates.find(
      (c) => c.profileName === input.primaryProfileName
    );

    if (primaryCandidate && isViable(primaryCandidate)) {
      selected = primaryCandidate;
      selectedTier = "primary";
    } else {
      // Primary not viable, try to find a replacement in each tier in order
      primaryCandidate && attemptedProfiles.push(input.primaryProfileName);

      for (const tier of FALLBACK_CHAIN_ORDER) {
        const tierCandidates = candidatesByTier.get(tier)!.filter(isViable);

        if (tierCandidates.length > 0) {
          // Sort by cost within the tier
          tierCandidates.sort((a, b) => getSortKey(a) - getSortKey(b));
          selected = tierCandidates[0];
          selectedTier = tier;
          break;
        }

        // Record this tier as attempted (no viable candidates)
        attemptedProfiles.push(...candidatesByTier.get(tier)!.map((c) => c.profileName));
      }
    }

    // Build attempted profiles in fallback order
    if (selectedTier !== "primary" && primaryCandidate) {
      attemptedProfiles.unshift(input.primaryProfileName);
    }

    // If we found a selection, record all profiles attempted in the chain
    if (selected) {
      const selectedPosition = FALLBACK_CHAIN_ORDER.indexOf(selectedTier);
      // Record all profiles from tiers before and including the selected tier
      for (let i = 0; i <= selectedPosition; i++) {
        const tier = FALLBACK_CHAIN_ORDER[i];
        const tierCandidates = candidatesByTier.get(tier)!.filter(isViable);
        attemptedProfiles.push(...tierCandidates.map((c) => c.profileName));
      }
    }

    return {
      selectedProfileName: selected?.profileName ?? null,
      reasonCode: selected == null
        ? "fallback.no_candidate_available"
        : selectedTier === "primary"
          ? "fallback.primary_selected"
          : `fallback.${selectedTier}_selected`,
      degradedFromProfileName: selectedTier !== "primary" ? input.primaryProfileName : null,
      attemptedProfiles: [...new Set(attemptedProfiles)],
      fallbackChain,
    };
  }
}
