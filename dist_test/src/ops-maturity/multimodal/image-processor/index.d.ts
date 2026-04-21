export interface ImageMetadata {
    readonly width: number;
    readonly height: number;
}
export declare function normalizeImageAspectRatio(metadata: ImageMetadata): number;
