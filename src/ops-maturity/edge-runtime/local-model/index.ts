export interface LocalModelProfile {
  readonly modelId: string;
  readonly modalities: readonly string[];
}

export function selectEdgeLocalModel(models: readonly LocalModelProfile[], modality: string): LocalModelProfile | null {
  return models.find((item) => item.modalities.includes(modality)) ?? null;
}
