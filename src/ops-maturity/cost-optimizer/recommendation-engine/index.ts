import {
  DEFAULT_MODEL_METADATA_REGISTRY,
  type ModelMetadataRegistry,
  type ModelProfileMetadata,
} from "../../../platform/control-plane/config-center/model-metadata-registry.js";

export interface CostOptimizationRecommendation {
  readonly recommendationId: string;
  readonly subjectId: string;
  readonly estimatedSavingsUsd: number;
  readonly riskLevel: "low" | "medium" | "high";
  readonly action: "right_size" | "downgrade_model" | "increase_cache_hit" | "schedule_shift";
  readonly currentModelRef?: string;
  readonly recommendedModelRef?: string;
}

export function buildCostOptimizationRecommendation(
  subjectId: string,
  currentCostUsd: number,
  options: {
    modelRef?: string;
    registry?: ModelMetadataRegistry;
  } = {},
): CostOptimizationRecommendation | null {
  if (currentCostUsd < 10) {
    return null;
  }
  const registry = options.registry ?? DEFAULT_MODEL_METADATA_REGISTRY;
  const currentProfile = options.modelRef == null ? null : resolveCurrentProfile(registry, options.modelRef);
  const recommendedProfile = currentProfile == null
    ? options.modelRef == null ? null : findLowestCostProfile(registry)
    : findLowerCostPeerProfile(registry, currentProfile);
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
    riskLevel: downgradePath ? "high" : currentCostUsd >= 50 ? "medium" : "low",
    action: downgradePath ? "downgrade_model" : currentCostUsd >= 50 ? "right_size" : "increase_cache_hit",
    ...(options.modelRef != null ? { currentModelRef: options.modelRef as string } : {}),
    ...(recommendedProfile != null && (downgradePath || (options.modelRef != null && currentProfile == null))
      ? { recommendedModelRef: `${recommendedProfile.provider}/${recommendedProfile.modelId}` as string }
      : {}),
  };
}

export function prioritizeCostOptimizationRecommendations(
  items: readonly CostOptimizationRecommendation[],
): CostOptimizationRecommendation[] {
  return [...items].sort((left, right) => right.estimatedSavingsUsd - left.estimatedSavingsUsd);
}

function findLowerCostPeerProfile(
  registry: ModelMetadataRegistry,
  currentProfile: ModelProfileMetadata,
): ModelProfileMetadata | null {
  return Object.values(registry.profiles)
    .filter((profile) => profile.provider === currentProfile.provider)
    .filter((profile) => profile.modelId !== currentProfile.modelId)
    .sort((left, right) =>
      (left.pricing.inputPer1kUsd + left.pricing.outputPer1kUsd)
      - (right.pricing.inputPer1kUsd + right.pricing.outputPer1kUsd),
    )[0] ?? null;
}

function findLowestCostProfile(registry: ModelMetadataRegistry): ModelProfileMetadata | null {
  return Object.values(registry.profiles)
    .sort((left, right) =>
      (left.pricing.inputPer1kUsd + left.pricing.outputPer1kUsd)
      - (right.pricing.inputPer1kUsd + right.pricing.outputPer1kUsd),
    )[0] ?? null;
}

function resolveCurrentProfile(
  registry: ModelMetadataRegistry,
  modelRef: string,
): ModelProfileMetadata | null {
  return registry.profiles[modelRef]
    ?? Object.values(registry.profiles).find((profile) => `${profile.provider}/${profile.modelId}` === modelRef)
    ?? Object.values(registry.profiles).find((profile) => profile.modelId === modelRef)
    ?? null;
}
