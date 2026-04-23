import { DEFAULT_MODEL_METADATA_REGISTRY, } from "../../../platform/control-plane/config-center/model-metadata-registry.js";
export function buildCostOptimizationRecommendation(subjectId, currentCostUsd, options = {}) {
    if (currentCostUsd < 10) {
        return null;
    }
    const registry = options.registry ?? DEFAULT_MODEL_METADATA_REGISTRY;
    const currentProfile = options.modelRef == null ? null : resolveCurrentProfile(registry, options.modelRef);
    const recommendedProfile = currentProfile == null ? null : findLowerCostPeerProfile(registry, currentProfile);
    const downgradePath = currentProfile != null
        && recommendedProfile != null
        && currentCostUsd >= 100
        && recommendedProfile.pricing.inputPer1kUsd + recommendedProfile.pricing.outputPer1kUsd
            < currentProfile.pricing.inputPer1kUsd + currentProfile.pricing.outputPer1kUsd;
    const estimatedSavingsUsd = Number((currentCostUsd * (downgradePath ? 0.22 : 0.15)).toFixed(2));
    return {
        recommendationId: `rec_${subjectId}`,
        subjectId,
        estimatedSavingsUsd,
        riskLevel: downgradePath ? "high" : currentCostUsd > 100 ? "medium" : "low",
        action: downgradePath ? "downgrade_model" : currentCostUsd > 100 ? "right_size" : "increase_cache_hit",
        ...(options.modelRef != null ? { currentModelRef: options.modelRef } : {}),
        ...(recommendedProfile != null && downgradePath ? { recommendedModelRef: `${recommendedProfile.provider}/${recommendedProfile.modelId}` } : {}),
    };
}
export function prioritizeCostOptimizationRecommendations(items) {
    return [...items].sort((left, right) => right.estimatedSavingsUsd - left.estimatedSavingsUsd);
}
function findLowerCostPeerProfile(registry, currentProfile) {
    return Object.values(registry.profiles)
        .filter((profile) => profile.provider === currentProfile.provider)
        .filter((profile) => profile.modelId !== currentProfile.modelId)
        .sort((left, right) => (left.pricing.inputPer1kUsd + left.pricing.outputPer1kUsd)
        - (right.pricing.inputPer1kUsd + right.pricing.outputPer1kUsd))[0] ?? null;
}
function resolveCurrentProfile(registry, modelRef) {
    return registry.profiles[modelRef]
        ?? Object.values(registry.profiles).find((profile) => `${profile.provider}/${profile.modelId}` === modelRef)
        ?? Object.values(registry.profiles).find((profile) => profile.modelId === modelRef)
        ?? null;
}
//# sourceMappingURL=index.js.map