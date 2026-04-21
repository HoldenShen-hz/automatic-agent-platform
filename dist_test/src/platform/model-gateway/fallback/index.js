export class ModelGatewayFallbackService {
    selectFallback(input) {
        const excluded = new Set(input.excludedProfiles ?? []);
        const attemptedProfiles = input.candidates.map((candidate) => candidate.profileName);
        const eligible = input.candidates.filter((candidate) => candidate.profileName !== input.primaryProfileName
            && !excluded.has(candidate.profileName)
            && candidate.healthy
            && (input.maxInputCostPer1kUsd == null || candidate.inputCostPer1kUsd <= input.maxInputCostPer1kUsd));
        const selected = eligible.sort((left, right) => left.inputCostPer1kUsd - right.inputCostPer1kUsd)[0] ?? null;
        return {
            selectedProfileName: selected?.profileName ?? null,
            reasonCode: selected == null ? "fallback.no_candidate_available" : "fallback.healthy_alternative_selected",
            degradedFromProfileName: input.primaryProfileName,
            attemptedProfiles,
        };
    }
}
//# sourceMappingURL=index.js.map