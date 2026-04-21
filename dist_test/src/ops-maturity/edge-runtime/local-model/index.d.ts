export interface LocalModelProfile {
    readonly modelId: string;
    readonly modalities: readonly string[];
}
export declare function selectEdgeLocalModel(models: readonly LocalModelProfile[], modality: string): LocalModelProfile | null;
