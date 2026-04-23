export interface ImageMetadata {
    readonly width: number;
    readonly height: number;
    readonly format?: string;
    readonly containsText?: boolean;
}
export declare function normalizeImageAspectRatio(metadata: ImageMetadata): number;
export interface ImageAnalysisResult {
    readonly aspectRatio: number;
    readonly orientation: "portrait" | "landscape" | "square";
    readonly containsText: boolean;
}
export declare function analyzeImage(metadata: ImageMetadata): ImageAnalysisResult;
