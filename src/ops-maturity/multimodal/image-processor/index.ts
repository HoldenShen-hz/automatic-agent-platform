export interface ImageMetadata {
  readonly width: number;
  readonly height: number;
  readonly format?: string;
  readonly containsText?: boolean;
}

export function normalizeImageAspectRatio(metadata: ImageMetadata): number {
  if (metadata.height === 0) {
    return 0;
  }
  return Number((metadata.width / metadata.height).toFixed(4));
}

export interface ImageAnalysisResult {
  readonly aspectRatio: number;
  readonly orientation: "portrait" | "landscape" | "square";
  readonly containsText: boolean;
}

export function analyzeImage(metadata: ImageMetadata): ImageAnalysisResult {
  const aspectRatio = normalizeImageAspectRatio(metadata);
  return {
    aspectRatio,
    orientation: metadata.width === metadata.height ? "square" : metadata.width > metadata.height ? "landscape" : "portrait",
    containsText: metadata.containsText ?? false,
  };
}
