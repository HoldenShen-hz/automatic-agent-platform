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
    const selected = eligible.sort((left, right) => left.inputCostPer1kUsd - right.inputCostPer1kUsd)[0] ?? null;
    return {
      selectedProfileName: selected?.profileName ?? null,
      reasonCode: selected == null ? "fallback.no_candidate_available" : "fallback.healthy_alternative_selected",
      degradedFromProfileName: input.primaryProfileName,
      attemptedProfiles,
    };
  }
}
