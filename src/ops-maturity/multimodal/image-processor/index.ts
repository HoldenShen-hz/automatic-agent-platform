export interface ImageMetadata {
  readonly width: number;
  readonly height: number;
}

export function normalizeImageAspectRatio(metadata: ImageMetadata): number {
  if (metadata.height === 0) {
    return 0;
  }
  return Number((metadata.width / metadata.height).toFixed(4));
}
