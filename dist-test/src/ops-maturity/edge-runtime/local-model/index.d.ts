export interface LocalModelProfile {
    readonly modelId: string;
    readonly modalities: readonly string[];
    readonly priority?: number;
}
export declare function selectEdgeLocalModel(models: readonly LocalModelProfile[], modality: string): LocalModelProfile | null;
