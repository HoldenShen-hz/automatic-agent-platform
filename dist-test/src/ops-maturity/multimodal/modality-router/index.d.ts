export declare function resolveInputModality(partType: string): "text" | "image" | "audio" | "document" | "video" | "unsupported";
export interface ModalityRoutingRule {
    readonly modality: "text" | "image" | "audio" | "document" | "video";
    readonly processor: string;
    readonly provider: string;
}
export declare function buildDefaultModalityRoutingTable(): readonly ModalityRoutingRule[];
