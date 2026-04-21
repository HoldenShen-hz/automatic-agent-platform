export interface LocalModelProfile {
  readonly modelId: string;
  readonly modalities: readonly string[];
  readonly priority?: number;
}

export function selectEdgeLocalModel(models: readonly LocalModelProfile[], modality: string): LocalModelProfile | null {
  return models
    .filter((item) => item.modalities.includes(modality))
    .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))[0] ?? null;
}
